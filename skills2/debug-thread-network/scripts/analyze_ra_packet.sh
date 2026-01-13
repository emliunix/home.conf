#!/bin/bash
# analyze_ra_packet.sh - Capture and analyze Router Advertisement packets
# Usage: ./analyze_ra_packet.sh <interface> [duration_seconds]

INTERFACE="${1:-en0}"
DURATION="${2:-10}"

echo "=== Router Advertisement Packet Capture and Analysis ==="
echo "Interface: $INTERFACE"
echo "Duration: ${DURATION}s"
echo ""

# Check if tcpdump is available
if ! command -v tcpdump &> /dev/null; then
    echo "ERROR: tcpdump not found. Please install it first."
    exit 1
fi

# Check if running with sufficient privileges
if [ "$EUID" -ne 0 ] && ! sudo -n true 2>/dev/null; then
    echo "NOTE: This script requires sudo privileges to capture packets."
    echo "You may be prompted for your password."
    echo ""
fi

# Create temporary file for capture
TMPFILE=$(mktemp /tmp/ra_capture.XXXXXX)
trap "rm -f $TMPFILE" EXIT

echo "Capturing Router Advertisements on $INTERFACE for ${DURATION} seconds..."
echo "(Press Ctrl+C to stop early)"
echo ""

# Capture RAs (ICMPv6 type 134) with timeout
sudo timeout "$DURATION" tcpdump -i "$INTERFACE" -vvv -n \
    'icmp6 and ip6[40] == 134' \
    > "$TMPFILE" 2>&1 || true

# Check if we captured anything
if [ ! -s "$TMPFILE" ]; then
    echo "No Router Advertisements captured during the monitoring period."
    echo ""
    echo "Possible reasons:"
    echo "  - No IPv6 router on this network"
    echo "  - Router Advertisement interval > ${DURATION}s"
    echo "  - Interface $INTERFACE is not connected"
    echo ""
    echo "Try increasing the duration: $0 $INTERFACE 30"
    exit 0
fi

echo "=== Captured Router Advertisements ==="
echo ""

# Display raw capture
cat "$TMPFILE"
echo ""

# Parse and summarize key information
echo "=== Summary Analysis ==="
echo ""

# Extract router addresses
echo "Router Addresses:"
grep -E "^[0-9]{2}:" "$TMPFILE" | awk '{print "  " $2 " > " $4}' | sort -u

echo ""

# Look for Router Lifetime
echo "Router Lifetime:"
if grep -q "router lifetime" "$TMPFILE"; then
    grep "router lifetime" "$TMPFILE" | sed 's/^/  /'
else
    echo "  (not found in capture)"
fi

echo ""

# Look for Prefix Information Options (PIO)
echo "Prefix Information Options (PIO):"
if grep -q "prefix info option" "$TMPFILE"; then
    grep -A 3 "prefix info option" "$TMPFILE" | sed 's/^/  /'
else
    echo "  (none found)"
fi

echo ""

# Look for Route Information Options (RIO)
echo "Route Information Options (RIO):"
if grep -q "route info option" "$TMPFILE"; then
    grep -A 2 "route info option" "$TMPFILE" | sed 's/^/  /'
else
    echo "  (none found)"
fi

echo ""

# Look for RDNSS (Recursive DNS Server)
echo "Recursive DNS Server (RDNSS):"
if grep -q "rdnss option" "$TMPFILE"; then
    grep -A 2 "rdnss option" "$TMPFILE" | sed 's/^/  /'
else
    echo "  (none found)"
fi

echo ""
echo "=== Thread Border Router Detection ==="

# Check if this looks like a Thread border router
HAS_RIO=false
HAS_ZERO_LIFETIME=false

if grep -q "route info option" "$TMPFILE"; then
    HAS_RIO=true
fi

if grep -q "router lifetime 0s" "$TMPFILE"; then
    HAS_ZERO_LIFETIME=true
fi

if [ "$HAS_RIO" = true ] && [ "$HAS_ZERO_LIFETIME" = true ]; then
    echo "✓ This appears to be a Thread Border Router:"
    echo "  - Has Route Information Options (RIO)"
    echo "  - Router lifetime = 0 (not default gateway)"
    echo ""
    echo "Expected configuration:"
    echo "  - PIO prefix: for infrastructure SLAAC"
    echo "  - RIO prefix: for Thread mesh routing (OMR)"
elif [ "$HAS_RIO" = true ]; then
    echo "⚠ Has RIO but non-zero router lifetime"
    echo "  May be Thread BR with non-standard config"
elif [ "$HAS_ZERO_LIFETIME" = true ]; then
    echo "⚠ Has router lifetime=0 but no RIO"
    echo "  Unusual configuration"
else
    echo "✗ Does not appear to be a Thread Border Router"
    echo "  Standard IPv6 router"
fi

echo ""
echo "=== Next Steps ==="
echo ""
echo "To see current IPv6 routes based on these RAs:"
echo "  netstat -rn -f inet6"
echo ""
echo "To see more details about the prefix:"
echo "  ndp -p"
echo ""
echo "To query the border router API (if Thread BR):"
ROUTER_IP=$(grep -E "^[0-9]{2}:" "$TMPFILE" | head -1 | awk '{print $2}' | grep -oE 'fe80::[^%]+')
if [ -n "$ROUTER_IP" ]; then
    echo "  First, find the router's global IPv6 address, then:"
    echo "  ./query_otbr_api.sh <router_ipv6_or_ipv4>"
else
    echo "  ./query_otbr_api.sh <router_address>"
fi
