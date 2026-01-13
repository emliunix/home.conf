# Router Advertisement Analysis for Thread Networks

## RA Packet Structure

Router Advertisements (ICMPv6 Type 134) are critical for Thread Border Router operation.

### Basic RA Header

```
Type: Router Advertisement (134)
Code: 0
Checksum: [calculated]
Cur hop limit: 0 or 64
Flags: Managed/Other config/Router preference
Router lifetime (seconds): 0 for Thread BR (intentional)
Reachable time (ms): 0 or specific value
Retrans timer (ms): 0 or specific value
```

### Key RA Options

#### 1. Prefix Information Option (PIO) - Type 3

**Purpose**: On-link prefix for SLAAC

**Structure**:
- Type: 3
- Length: 4 (32 bytes)
- Prefix Length: /64
- Flags: L (On-link), A (Autonomous/SLAAC)
- Valid Lifetime: seconds
- Preferred Lifetime: seconds
- Prefix: IPv6 prefix bytes

**Thread Usage**: Infrastructure network prefix for Wi-Fi/Ethernet devices

**Example**:
```
Prefix: fd18:b585:5b78:5104::/64
Flags: L=1, A=1
Valid Lifetime: 1800s
```

#### 2. Route Information Option (RIO) - Type 24 (RFC 4191)

**Purpose**: Off-link route to specific prefix

**Structure**:
- Type: 24
- Length: variable
- Prefix Length: /64
- Flags: Route Preference (High/Medium/Low)
- Route Lifetime: seconds
- Prefix: IPv6 prefix bytes

**Thread Usage**: Route to Thread mesh OMR prefix

**Example**:
```
Route: fd03:46e3:b547:1::/64
Preference: Medium
Lifetime: 1800s
```

#### 3. Source Link-Layer Address - Type 1

**Purpose**: Router's MAC address for neighbor cache

**Structure**:
- Type: 1
- Length: 1 (8 bytes)
- Link-Layer Address: MAC address

**Example**: `90:70:69:99:64:38`

## Thread Border Router RA Pattern

### Typical Thread BR RA Characteristics

```
Router Lifetime: 0 seconds ← Not advertising as default gateway
Flags: Preference = Medium

Option 1 (PIO): fd18:b585:5b78:5104::/64
  - On-link prefix for infrastructure
  - SLAAC enabled (A flag)
  - Infrastructure devices auto-configure here

Option 2 (RIO): fd03:46e3:b547:1::/64
  - Route to Thread mesh OMR prefix
  - Via border router gateway
  - External devices learn route

Option 3 (SLLA): 90:70:69:99:64:38
  - Border router MAC address
```

### Why Router Lifetime = 0?

**Intentional Design**:
- Border Router does NOT want to be default gateway
- Only provides routes to Thread-specific prefixes
- Prevents intercepting general internet traffic
- Avoids routing conflicts with primary gateway

**Result**:
- Devices do NOT set Thread BR as default route
- Thread BR only receives traffic destined for Thread prefixes
- Primary gateway handles general internet traffic

## Split-Prefix Architecture

Thread Border Routers typically use split-prefix design:

**Infrastructure Prefix (PIO)**:
- Advertised as Prefix Information Option
- Infrastructure devices perform SLAAC
- On-link (no gateway needed)
- Example: fd18:b585:5b78:5104::/64

**Thread Mesh Prefix (RIO)**:
- Advertised as Route Information Option
- Off-link route via border router
- Thread devices use this for OMR
- Example: fd03:46e3:b547:1::/64

## RA Reception and Processing

### macOS Behavior

**Check RA reception**:
```bash
ndp -p    # Show prefixes and advertising routers
ndp -r    # Show default routers
```

**Effect of IPv6 forwarding**:
- forwarding=0: Accepts RAs, performs SLAAC
- forwarding=1: Ignores RAs by default

### Linux Behavior

**Check RA settings**:
```bash
sysctl net.ipv6.conf.eth0.accept_ra
# 0 = Don't accept RAs
# 1 = Accept if forwarding=0
# 2 = Always accept RAs
```

**Override for Border Routers**:
```bash
sysctl -w net.ipv6.conf.eth0.accept_ra=2
```

## Analyzing RA Packets

### Wireshark Filters

**Capture filter** (before starting):
```
icmp6 and ip6[40] == 134
```

**Display filter** (after capture):
```
icmpv6.type == 134
```

### What to Look For

**1. Router Lifetime**
- 0 = Not default gateway (normal for Thread BR)
- >0 = Advertising as default gateway

**2. Prefix Information Options**
- Check prefix (should be ULA fd00::/8)
- Verify A flag (SLAAC enabled)
- Note lifetime values

**3. Route Information Options**
- Verify Thread OMR prefix present
- Check preference (usually Medium)
- Confirm gateway is border router link-local

**4. Frequency**
- RAs sent every 30-300 seconds typically
- More frequent after Router Solicitation

## Troubleshooting

### Not Receiving RAs

**Causes**:
1. IPv6 forwarding enabled (blocks RA acceptance)
2. Wrong interface being monitored
3. Border router not sending RAs
4. Firewall blocking ICMPv6

**Solutions**:
- Check: `sysctl net.inet6.ip6.forwarding` (macOS)
- Verify interface: `ifconfig` or `ip link`
- Capture with Wireshark to confirm RAs being sent
- Check firewall rules for ICMPv6

### RA Received but No Route

**Causes**:
1. RIO not present in RA
2. Route lifetime expired
3. Routing table full

**Solutions**:
- Verify RIO present: Capture and analyze RA
- Check route in table: `netstat -rn -f inet6`
- Clear old routes if needed

### Multiple Conflicting RAs

**Causes**:
1. Multiple border routers
2. Rogue RA attacks
3. Misconfigured routers

**Solutions**:
- Identify all RA sources: `ndp -r`
- Verify border router configuration
- Use RA Guard if available (managed networks)
