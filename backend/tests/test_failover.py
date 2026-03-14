"""
Test: Verify failover when a backend container is killed.
Usage: python tests/test_failover.py
"""

import requests
import subprocess
import time


def test_failover():
    url = "http://localhost:8080/api/"

    print("=" * 60)
    print("  FAILOVER TEST")
    print("=" * 60)

    # 1. Discover active servers
    print("\n  Phase 1: Discovering active servers...")
    servers = set()
    for _ in range(20):
        try:
            r = requests.get(url, timeout=5)
            servers.add(r.json()["server_id"])
        except Exception:
            pass

    print(f"  Active servers: {len(servers)}")
    if len(servers) < 2:
        print("  ⚠️ Need at least 2 servers for failover test")
        return False

    # 2. Kill one container
    target = list(servers)[0]
    print(f"\n  Phase 2: Stopping container '{target}'...")
    subprocess.run(["docker", "stop", target], capture_output=True)
    time.sleep(10)

    # 3. Verify traffic continues
    print("\n  Phase 3: Verifying traffic still flows...")
    post_servers = set()
    failures = 0
    for _ in range(20):
        try:
            r = requests.get(url, timeout=5)
            post_servers.add(r.json()["server_id"])
        except Exception:
            failures += 1

    print(f"  Servers after failure: {len(post_servers)}")
    print(f"  Failed requests: {failures}")

    passed = target not in post_servers and failures < 5

    if passed:
        print("\n  ✅ PASSED — Failover working correctly!")
    else:
        print("\n  ❌ FAILED — System did not handle failure properly")

    # 4. Restore
    print(f"\n  Phase 4: Restoring container '{target}'...")
    subprocess.run(["docker", "start", target], capture_output=True)

    return passed


if __name__ == "__main__":
    test_failover()
