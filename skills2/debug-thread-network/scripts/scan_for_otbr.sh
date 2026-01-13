#!/bin/bash
# Scan network for OpenThread Border Routers

set -euo pipefail

NETWORK_PREFIX="${1:-192.168.1}"

echo "========================================"
echo "Scanning for OpenThread Border Routers"
echo "========================================"
echo "Network: $NETWORK_PREFIX.0/24"
echo "Time: $(date)"
echo ""

echo "Scanning ports 80 and 8081..."
echo ""

FOUND=0

for i in {1..254}; do
    IP="$NETWORK_PREFIX.$i"
    
    # Test port 80 (ESP32 OTBR)
    if timeout 1 bash -c "cat < /dev/null > /dev/tcp/$IP/80" 2>/dev/null; then
        echo "Checking $IP:80..."
        if RESPONSE=$(curl -s -m 2 "http://$IP/get_properties" 2>/dev/null); then
            if echo "$RESPONSE" | grep -q "Network:Name" 2>/dev/null; then
                echo "✓ Found OpenThread Border Router at $IP:80"
                if command -v jq > /dev/null 2>&1; then
                    NETWORK=$(echo "$RESPONSE" | jq -r '.result."Network:Name" // "Unknown"')
                    STATE=$(echo "$RESPONSE" | jq -r '.result."RCP:State" // "Unknown"')
                    echo "  Network: $NETWORK"
                    echo "  State: $STATE"
                fi
                FOUND=$((FOUND + 1))
                echo ""
            fi
        fi
    fi
    
    # Test port 8081 (standard ot-br-posix)
    if timeout 1 bash -c "cat < /dev/null > /dev/tcp/$IP/8081" 2>/dev/null; then
        echo "Checking $IP:8081..."
        if RESPONSE=$(curl -s -m 2 "http://$IP:8081/node/dataset/active" 2>/dev/null); then
            if echo "$RESPONSE" | grep -q "NetworkName" 2>/dev/null; then
                echo "✓ Found OpenThread Border Router at $IP:8081"
                if command -v jq > /dev/null 2>&1; then
                    NETWORK=$(echo "$RESPONSE" | jq -r '.NetworkName // "Unknown"')
                    echo "  Network: $NETWORK"
                fi
                FOUND=$((FOUND + 1))
                echo ""
            fi
        fi
    fi
done

echo "========================================"
echo "Scan Complete"
echo "========================================"
echo "Found $FOUND border router(s)"
