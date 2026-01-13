#!/bin/bash
# Comprehensive Thread Border Router connectivity test

set -euo pipefail

BR_IP="${1:-}"

if [ -z "$BR_IP" ]; then
    echo "Usage: $0 <border-router-ip>"
    echo "Example: $0 192.168.1.100"
    exit 1
fi

echo "========================================"
echo "Thread Border Router Connectivity Test"
echo "========================================"
echo "Border Router IP: $BR_IP"
echo "Test Time: $(date)"
echo ""

PASSED=0
FAILED=0

# Test 1: ICMP Reachability
echo "Test 1: ICMP Reachability"
echo "----------------------------------------"
if ping -c 3 -W 2 "$BR_IP" > /dev/null 2>&1; then
    echo "✓ PASSED - Border router responds to ping"
    PASSED=$((PASSED + 1))
else
    echo "✗ FAILED - Border router does not respond to ping"
    FAILED=$((FAILED + 1))
fi
echo ""

# Test 2: HTTP REST API (port 80)
echo "Test 2: HTTP REST API (port 80)"
echo "----------------------------------------"
if HTTP_RESPONSE=$(curl -s -m 5 "http://$BR_IP/get_properties" 2>&1) && [ -n "$HTTP_RESPONSE" ]; then
    echo "✓ PASSED - REST API accessible on port 80"
    echo "  Network: $(echo "$HTTP_RESPONSE" | jq -r '.result."Network:Name" // "N/A"' 2>/dev/null || echo "N/A")"
    echo "  Role: $(echo "$HTTP_RESPONSE" | jq -r '.result."RCP:State" // "N/A"' 2>/dev/null || echo "N/A")"
    PASSED=$((PASSED + 1))
else
    echo "✗ FAILED - REST API not accessible on port 80"
    FAILED=$((FAILED + 1))
fi
echo ""

# Test 3: Alternative port 8081
echo "Test 3: HTTP REST API (port 8081)"
echo "----------------------------------------"
if HTTP_RESPONSE_8081=$(curl -s -m 5 "http://$BR_IP:8081/node/dataset/active" 2>&1) && [ -n "$HTTP_RESPONSE_8081" ]; then
    echo "✓ PASSED - REST API accessible on port 8081"
    PASSED=$((PASSED + 1))
else
    echo "✗ FAILED - REST API not accessible on port 8081"
    echo "  (This is normal for ESP32-based OTBR)"
    FAILED=$((FAILED + 1))
fi
echo ""

# Test 4: IPv6 Router Advertisement
echo "Test 4: IPv6 Configuration"
echo "----------------------------------------"
if command -v ndp > /dev/null 2>&1; then
    # macOS
    RA_INFO=$(ndp -p 2>/dev/null | grep -i "advertised by" | head -1 || echo "")
    if [ -n "$RA_INFO" ]; then
        echo "✓ PASSED - Receiving Router Advertisements"
        echo "  $RA_INFO"
        PASSED=$((PASSED + 1))
    else
        echo "✗ FAILED - Not receiving Router Advertisements"
        FAILED=$((FAILED + 1))
    fi
else
    echo "⊘ SKIPPED - ndp command not available (not macOS)"
fi
echo ""

# Test 5: Thread Network Data
echo "Test 5: Thread Network Data"
echo "----------------------------------------"
if command -v jq > /dev/null 2>&1; then
    NETDATA=$(curl -s -m 5 "http://$BR_IP/diagnostics" 2>/dev/null | jq -r '.[0].NetworkData // empty' 2>/dev/null || echo "")
    if [ -n "$NETDATA" ]; then
        echo "✓ PASSED - Thread Network Data retrieved"
        echo "  Length: ${#NETDATA} characters"
        PASSED=$((PASSED + 1))
    else
        echo "✗ FAILED - Could not retrieve Thread Network Data"
        FAILED=$((FAILED + 1))
    fi
else
    echo "⊘ SKIPPED - jq not installed"
fi
echo ""

# Summary
echo "========================================"
echo "Test Summary"
echo "========================================"
echo "Passed: $PASSED"
echo "Failed: $FAILED"
echo ""

if [ $FAILED -eq 0 ]; then
    echo "✓ All tests passed!"
    exit 0
else
    echo "✗ Some tests failed"
    exit 1
fi
