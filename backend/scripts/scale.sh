#!/bin/bash
# Scale backend services
# Usage: ./scripts/scale.sh <number_of_replicas>

REPLICAS=${1:-3}

echo "📐 Scaling backend to $REPLICAS replicas..."
docker compose up -d --scale backend=$REPLICAS --no-recreate

echo ""
echo "⏳ Waiting for containers to start..."
sleep 5

echo ""
echo "📊 Current backend containers:"
docker compose ps backend

echo ""
echo "✅ Scaling complete! $REPLICAS backend instances running."
echo ""
echo "🔗 Access points:"
echo "   Frontend:       http://localhost:80"
echo "   HAProxy LB:     http://localhost:8080"
echo "   HAProxy Stats:  http://localhost:8404/stats"
echo "   Controller:     http://localhost:9000"
