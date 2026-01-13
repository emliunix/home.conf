#!/bin/bash
# Comprehensive IPv6 diagnostics for Thread networks

set -euo pipefail

INTERFACE="${1:-}"

echo "========================================"
echo "IPv6 Diagnostics for Thread Networks"
echo "========================================"
echo "Time: $(date)"
echo ""

# Function to print section header
print_header() {
    echo ""
    echo "----------------------------------------"
    echo "$1"
    echo "----------------------------------------"
}

# IPv6 Addresses
print_header "IPv6 Addresses"
if [ -n "$INTERFACE" ]; then
    ifconfig "$INTERFACE" | grep inet6 || echo "No IPv6 addresses found"
else
    ifconfig | grep -A 1 "inet6" | grep -v "^--" || echo "No IPv6 addresses found"
fi

# IPv6 Routing Table
print_header "IPv6 Routing Table"
if command -v netstat > /dev/null 2>&1; then
    netstat -rn -f inet6 | head -30
else
    ip -6 route 2>/dev/null || echo "Neither netstat nor ip command available"
fi

# Neighbor Discovery Cache
print_header "Neighbor Discovery Cache"
if command -v ndp > /dev/null 2>&1; then
    # macOS
    ndp -an | grep -E "(fe80|fd)" || echo "No Thread-related neighbors found"
else
    # Linux
    ip -6 neigh 2>/dev/null || echo "ip command not available"
fi

# Router Advertisement Prefixes
print_header "Router Advertisement Prefixes"
if command -v ndp > /dev/null 2>&1; then
    # macOS
    ndp -p
else
    # Linux - show accept_ra settings
    if [ -d /proc/sys/net/ipv6/conf ]; then
        echo "accept_ra settings:"
        for iface in /proc/sys/net/ipv6/conf/*/accept_ra; do
            iface_name=$(basename $(dirname "$iface"))
            value=$(cat "$iface")
            echo "  $iface_name: $value"
        done
    fi
fi

# Default Routers
print_header "Default Routers"
if command -v ndp > /dev/null 2>&1; then
    # macOS
    ndp -r
else
    # Linux
    ip -6 route show default 2>/dev/null || echo "No default IPv6 route"
fi

# IPv6 Forwarding Status
print_header "IPv6 Forwarding Status"
if [ -f /proc/sys/net/ipv6/conf/all/forwarding ]; then
    # Linux
    FORWARDING=$(cat /proc/sys/net/ipv6/conf/all/forwarding)
    echo "IPv6 Forwarding: $FORWARDING (0=disabled, 1=enabled)"
elif command -v sysctl > /dev/null 2>&1; then
    # macOS
    sysctl net.inet6.ip6.forwarding 2>/dev/null || echo "Could not check forwarding status"
fi

# Thread-specific prefix check
print_header "Thread Prefix Detection"
echo "Checking for Thread-related prefixes (fd00::/8)..."
if command -v netstat > /dev/null 2>&1; then
    THREAD_ROUTES=$(netstat -rn -f inet6 2>/dev/null | grep -E "^fd[0-9a-f]" || echo "")
else
    THREAD_ROUTES=$(ip -6 route 2>/dev/null | grep -E "^fd[0-9a-f]" || echo "")
fi

if [ -n "$THREAD_ROUTES" ]; then
    echo "✓ Thread prefixes found:"
    echo "$THREAD_ROUTES"
else
    echo "✗ No Thread prefixes (fd00::/8) found in routing table"
fi

echo ""
echo "========================================"
echo "Diagnostics Complete"
echo "========================================"
