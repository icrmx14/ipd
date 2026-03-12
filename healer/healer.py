"""
AI-Driven Self-Healing Service
Monitors Elasticsearch for error patterns and automatically
restarts unhealthy containers via the Docker socket.
"""

import time
import os
import logging
import docker
from elasticsearch import Elasticsearch
from datetime import datetime, timedelta

# ──────────── Configuration ────────────
ES_HOST = os.environ.get("ES_HOST", "http://elasticsearch:9200")
CHECK_INTERVAL = int(os.environ.get("CHECK_INTERVAL", 10))
ERROR_THRESHOLD = int(os.environ.get("ERROR_THRESHOLD", 3))
LOOKBACK_SECONDS = int(os.environ.get("LOOKBACK_SECONDS", 30))

# ──────────── Logging ────────────
logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [HEALER] %(levelname)s: %(message)s",
)
logger = logging.getLogger(__name__)

# ──────────── Clients ────────────
docker_client = docker.from_env()
es = Elasticsearch([ES_HOST])

# ──────────── Stats ────────────
stats = {
    "total_checks": 0,
    "total_heals": 0,
    "failed_heals": 0,
    "last_heal_time": None,
}


def wait_for_elasticsearch(max_retries=30, delay=10):
    """Wait for Elasticsearch to become available."""
    for attempt in range(max_retries):
        try:
            if es.ping():
                logger.info("✅ Connected to Elasticsearch")
                return True
        except Exception:
            pass
        logger.info(f"⏳ Waiting for Elasticsearch... ({attempt + 1}/{max_retries})")
        time.sleep(delay)

    logger.error("❌ Could not connect to Elasticsearch")
    return False


def get_error_counts():
    """Query ES for containers with high error rates in the lookback window."""
    now = datetime.utcnow()
    past = now - timedelta(seconds=LOOKBACK_SECONDS)

    query = {
        "size": 0,
        "query": {
            "bool": {
                "must": [
                    {
                        "bool": {
                            "should": [
                                {"match": {"message": "500"}},
                                {"match": {"message": "502"}},
                                {"match": {"message": "503"}},
                                {"match_phrase": {"message": "Internal Server Error"}},
                                {"match_phrase": {"message": "Traceback"}},
                            ]
                        }
                    },
                    {
                        "range": {
                            "@timestamp": {
                                "gte": past.isoformat(),
                                "lte": now.isoformat(),
                            }
                        }
                    },
                ]
            }
        },
        "aggs": {
            "bad_containers": {
                "terms": {"field": "host.keyword", "size": 20}
            }
        },
    }

    try:
        response = es.search(index="logstash-*", body=query)
        return response["aggregations"]["bad_containers"]["buckets"]
    except Exception as e:
        logger.error(f"ES query error: {e}")
        return []


def restart_container(container_id):
    """Restart a Docker container by ID."""
    try:
        container = docker_client.containers.get(container_id)
        name = container.name
        logger.warning(f"🔄 Restarting: {name} ({container_id[:12]})")
        container.restart(timeout=10)
        logger.info(f"✅ Restarted: {name}")
        stats["total_heals"] += 1
        stats["last_heal_time"] = datetime.now().isoformat()
        return True
    except docker.errors.NotFound:
        logger.error(f"❌ Container {container_id[:12]} not found")
        stats["failed_heals"] += 1
        return False
    except Exception as e:
        logger.error(f"❌ Restart failed for {container_id[:12]}: {e}")
        stats["failed_heals"] += 1
        return False


def heal_system():
    """Main healing cycle."""
    stats["total_checks"] += 1
    logger.info(f"🔍 Scan #{stats['total_checks']} — Checking system health...")

    bad_containers = get_error_counts()

    if not bad_containers:
        logger.info("💚 All containers healthy")
        return

    for bucket in bad_containers:
        cid = bucket["key"]
        count = bucket["doc_count"]

        if count >= ERROR_THRESHOLD:
            logger.warning(
                f"⚠️ Container {cid[:12]} has {count} errors "
                f"(threshold: {ERROR_THRESHOLD}). Self-healing..."
            )
            restart_container(cid)
        else:
            logger.info(
                f"🟡 Container {cid[:12]}: {count} errors (below threshold)"
            )


if __name__ == "__main__":
    logger.info("=" * 60)
    logger.info("🚀 AI Self-Healing Service Starting...")
    logger.info(f"   ES Host:         {ES_HOST}")
    logger.info(f"   Check Interval:  {CHECK_INTERVAL}s")
    logger.info(f"   Error Threshold: {ERROR_THRESHOLD}")
    logger.info(f"   Lookback Window: {LOOKBACK_SECONDS}s")
    logger.info("=" * 60)

    if not wait_for_elasticsearch():
        exit(1)

    cycle = 0
    while True:
        heal_system()
        cycle += 1
        if cycle % 10 == 0:
            logger.info(f"📊 Stats — Checks: {stats['total_checks']}, "
                        f"Heals: {stats['total_heals']}, "
                        f"Failed: {stats['failed_heals']}")
        time.sleep(CHECK_INTERVAL)
