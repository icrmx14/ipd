import time
import docker
from elasticsearch import Elasticsearch
from datetime import datetime, timedelta

# Configuration
ES_HOST = "http://elasticsearch:9200"
CHECK_INTERVAL = 10  # Seconds between checks
ERROR_THRESHOLD = 3  # Number of errors to trigger a restart
LOOKBACK_SECONDS = 30 # How far back to look in logs

# Connect to Docker Socket (to perform restarts)
docker_client = docker.from_env()

# Connect to Elasticsearch (to read logs)
es = Elasticsearch([ES_HOST])

def get_error_counts():
    """Queries ES for logs with 'error' or 500 status in the last window."""
    
    # Calculate time window
    now = datetime.utcnow()
    past = now - timedelta(seconds=LOOKBACK_SECONDS)
    
    # Elasticsearch Query
    query = {
        "query": {
            "bool": {
                "must": [
                    {"match": {"message": "500"}}, # Look for 500 errors
                    {"range": {"@timestamp": {"gte": past.isoformat(), "lte": now.isoformat()}}}
                ]
            }
        },
        "aggs": {
            "bad_containers": {
                "terms": {
                    "field": "host.keyword", # GELF driver sends container ID as 'host'
                    "size": 10
                }
            }
        }
    }

    try:
        response = es.search(index="logstash-*", body=query)
        return response['aggregations']['bad_containers']['buckets']
    except Exception as e:
        print(f"Error querying ES: {e}")
        return []

def heal_system():
    print(f"[{datetime.now()}] Scanning system health...")
    
    bad_containers = get_error_counts()
    
    for bucket in bad_containers:
        container_id = bucket['key']
        error_count = bucket['doc_count']
        
        if error_count >= ERROR_THRESHOLD:
            print(f"⚠️  ALERT: Container {container_id} has {error_count} errors. Initiating Self-Healing...")
            
            try:
                # 1. Find the container
                container = docker_client.containers.get(container_id)
                
                # 2. Restart it
                container.restart()
                
                print(f"✅ HEALED: Container {container_id} was successfully restarted.")
                
            except Exception as e:
                print(f"❌ FAILED to heal container {container_id}: {e}")

if __name__ == "__main__":
    print("AI Healer Service Started...")
    # Give ES some time to come up
    time.sleep(30) 
    
    while True:
        heal_system()
        time.sleep(CHECK_INTERVAL)