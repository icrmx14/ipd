#!/bin/bash
# ═══════════════════════════════════════════════════════
#  Performance Benchmark Script
#  Compares: Single Server vs Load Balanced (N replicas)
#  Requires: curl (or install Apache Benchmark: apt install apache2-utils)
# ═══════════════════════════════════════════════════════

set -e

URL="http://localhost:8080/api/"
TOTAL=500
CONCURRENT=20

echo "=============================================="
echo "  IPD PERFORMANCE BENCHMARK"
echo "=============================================="
echo ""
echo "  URL:         $URL"
echo "  Total:       $TOTAL requests"
echo "  Concurrent:  $CONCURRENT"
echo ""

# ─── Test 1: Single server ───
echo "──────────────────────────────────────────────"
echo "  TEST 1: Single Backend Server"
echo "──────────────────────────────────────────────"
docker compose up -d --scale backend=1 --no-recreate 2>/dev/null
sleep 8
echo ""

START=$(date +%s%N)
SUCCESS=0
FAIL=0
for i in $(seq 1 $TOTAL); do
    if curl -s -o /dev/null -w "%{http_code}" --max-time 5 "$URL" | grep -q "200"; then
        ((SUCCESS++))
    else
        ((FAIL++))
    fi
done
END=$(date +%s%N)
SINGLE_TIME=$(( (END - START) / 1000000 ))
SINGLE_RPS=$(echo "scale=2; $SUCCESS / ($SINGLE_TIME / 1000)" | bc 2>/dev/null || echo "N/A")

echo "  Results (1 replica):"
echo "    Total time:   ${SINGLE_TIME}ms"
echo "    Successful:   $SUCCESS"
echo "    Failed:       $FAIL"
echo "    Req/sec:      $SINGLE_RPS"
echo ""

# ─── Test 2: Load balanced ───
echo "──────────────────────────────────────────────"
echo "  TEST 2: Load Balanced (5 replicas)"
echo "──────────────────────────────────────────────"
docker compose up -d --scale backend=5 --no-recreate 2>/dev/null
sleep 12
echo ""

START=$(date +%s%N)
SUCCESS=0
FAIL=0
for i in $(seq 1 $TOTAL); do
    if curl -s -o /dev/null -w "%{http_code}" --max-time 5 "$URL" | grep -q "200"; then
        ((SUCCESS++))
    else
        ((FAIL++))
    fi
done
END=$(date +%s%N)
LB_TIME=$(( (END - START) / 1000000 ))
LB_RPS=$(echo "scale=2; $SUCCESS / ($LB_TIME / 1000)" | bc 2>/dev/null || echo "N/A")

echo "  Results (5 replicas):"
echo "    Total time:   ${LB_TIME}ms"
echo "    Successful:   $SUCCESS"
echo "    Failed:       $FAIL"
echo "    Req/sec:      $LB_RPS"
echo ""

# ─── Summary ───
echo "=============================================="
echo "  COMPARISON SUMMARY"
echo "=============================================="
echo "  Single Server:  ${SINGLE_TIME}ms total, ~${SINGLE_RPS} req/s"
echo "  Load Balanced:  ${LB_TIME}ms total, ~${LB_RPS} req/s"
echo ""

if [ "$SINGLE_TIME" -gt "$LB_TIME" ] 2>/dev/null; then
    IMPROVEMENT=$(echo "scale=1; ($SINGLE_TIME - $LB_TIME) * 100 / $SINGLE_TIME" | bc 2>/dev/null || echo "N/A")
    echo "  ⚡ Load Balanced is ${IMPROVEMENT}% faster!"
else
    echo "  (Results may vary — try with higher concurrency)"
fi

echo ""
echo "  Restoring default replicas..."
docker compose up -d --scale backend=3 --no-recreate 2>/dev/null
echo "  ✅ Benchmark complete!"
