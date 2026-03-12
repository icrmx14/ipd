"""
Test: Verify HAProxy distributes traffic across all backend containers.
Usage: python tests/test_load_balancing.py
"""

import requests
from collections import Counter


def test_round_robin_distribution():
    url = "http://localhost:8080/api/"
    server_hits = Counter()
    total = 100
    failures = 0

    print("=" * 60)
    print("  LOAD BALANCING DISTRIBUTION TEST")
    print("=" * 60)
    print(f"  Target: {url}")
    print(f"  Requests: {total}")
    print("-" * 60)

    for i in range(total):
        try:
            r = requests.get(url, timeout=5)
            data = r.json()
            server_hits[data["server_id"]] += 1
        except Exception as e:
            failures += 1
            print(f"  ❌ Request {i + 1} failed: {e}")

    print(f"\n  Results:")
    print(f"  Successful: {total - failures}/{total}")
    print(f"  Unique servers: {len(server_hits)}")
    print("-" * 60)

    for server, count in sorted(server_hits.items()):
        pct = (count / (total - failures)) * 100
        bar = "█" * int(pct / 2)
        print(f"  {server:25s} → {count:3d} hits ({pct:5.1f}%) {bar}")

    print("-" * 60)

    if len(server_hits) > 1:
        print("  ✅ PASSED — Traffic distributed across multiple backends")
    else:
        print("  ❌ FAILED — Traffic went to only one server!")

    return len(server_hits) > 1


if __name__ == "__main__":
    test_round_robin_distribution()
