#!/bin/bash
# Query OpenThread Border Router REST API endpoints

set -euo pipefail

BR_IP="${1:-}"
PORT="${2:-80}"

if [ -z "$BR_IP" ]; then
    echo "Usage: $0 <border-router-ip> [port]"
    echo "Example: $0 192.168.1.100 80"
    exit 1
fi

BASE_URL="http://$BR_IP:$PORT"

echo "========================================"
echo "OpenThread Border Router API Query"
echo "========================================"
echo "Border Router: $BR_IP:$PORT"
echo "Time: $(date)"
echo ""

# Function to query endpoint
query_endpoint() {
    local endpoint="$1"
    local name="$2"
    
    echo "----------------------------------------"
    echo "$name"
    echo "Endpoint: $endpoint"
    echo "----------------------------------------"
    
    if RESPONSE=$(curl -s -m 10 "$BASE_URL$endpoint" 2>&1); then
        if command -v jq > /dev/null 2>&1; then
            echo "$RESPONSE" | jq '.' 2>/dev/null || echo "$RESPONSE"
        else
            echo "$RESPONSE"
        fi
    else
        echo "✗ Failed to query endpoint"
    fi
    echo ""
}

# Query all major endpoints
query_endpoint "/get_properties" "Network Properties"
query_endpoint "/node_information" "Node Information"
query_endpoint "/topology" "Network Topology"
query_endpoint "/diagnostics" "Diagnostics"
query_endpoint "/node/dataset/active" "Active Dataset (Credentials)"
query_endpoint "/available_network" "Available Networks"

echo "========================================"
echo "Query Complete"
echo "========================================"
