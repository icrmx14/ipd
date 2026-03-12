"""
Test: Verify the ELK pipeline — logs flow from containers to Elasticsearch.
Usage: python tests/test_elk_pipeline.py
"""

import requests
import time


def test_elk_pipeline():
    es_url = "http://localhost:9200"

    print("=" * 60)
    print("  ELK PIPELINE TEST")
    print("=" * 60)

    # 1. Check Elasticsearch health
    print("\n  Phase 1: Checking Elasticsearch...")
    try:
        r = requests.get(f"{es_url}/_cluster/health", timeout=10)
        health = r.json()
        status = health["status"]
        print(f"  Cluster status: {status}")
        print(f"  Nodes: {health['number_of_nodes']}")
    except Exception as e:
        print(f"  ❌ Elasticsearch unreachable: {e}")
        return False

    # 2. Check for log indices
    print("\n  Phase 2: Checking log indices...")
    try:
        r = requests.get(f"{es_url}/_cat/indices/logstash-*?format=json", timeout=10)
        indices = r.json()
        print(f"  Log indices found: {len(indices)}")
        for idx in indices:
            print(f"    - {idx['index']}: {idx['docs.count']} docs, {idx['store.size']}")
    except Exception as e:
        print(f"  ⚠️ No indices yet: {e}")

    # 3. Generate traffic and check logs appear
    print("\n  Phase 3: Generating traffic...")
    for _ in range(10):
        try:
            requests.get("http://localhost:8080/api/", timeout=5)
        except Exception:
            pass

    time.sleep(5)  # Wait for logs to be processed

    # 4. Search for recent logs
    print("\n  Phase 4: Searching for recent logs...")
    try:
        r = requests.post(
            f"{es_url}/logstash-*/_search",
            json={"size": 5, "sort": [{"@timestamp": {"order": "desc"}}]},
            timeout=10,
        )
        data = r.json()
        total = data["hits"]["total"]["value"]
        print(f"  Total log entries: {total}")

        if total > 0:
            print(f"  Latest logs:")
            for hit in data["hits"]["hits"][:3]:
                src = hit["_source"]
                print(f"    [{src.get('tag', '?')}] {src.get('message', '')[:80]}")
            print(f"\n  ✅ PASSED — ELK pipeline is working!")
            return True
        else:
            print(f"\n  ❌ FAILED — No logs found in Elasticsearch")
            return False
    except Exception as e:
        print(f"  ❌ Error querying ES: {e}")
        return False


if __name__ == "__main__":
    test_elk_pipeline()
