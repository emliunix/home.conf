# Thread IPv6 Addressing Reference

## Address Types Overview

Thread networks use four distinct IPv6 address types, each serving a specific purpose:

| Type | Prefix | Scope | Purpose | Example |
|------|--------|-------|---------|---------|
| Link-Local | fe80::/10 | 1-hop | Neighbor discovery | fe80::38d0:a2b4:72fa:f618 |
| Mesh-Local | fd00::/8 (ULA) | Thread mesh | Stable identity | fd65:5b84:829e:dcc6:6004:3416:6205:5fe1 |
| RLOC | Mesh-Local prefix | Thread mesh | Routing | fd65:5b84:829e:dcc6:0:ff:fe00:7800 |
| OMR | fd00::/8 (ULA) | External | Off-mesh connectivity | fd03:46e3:b547:1:b22:9f5d:b00c:ea6e |

## Link-Local Address (fe80::/10)

**Purpose**: Direct neighbor communication (1-hop only)

**Characteristics**:
- Automatically configured on every IPv6 interface
- Only valid for communication on the same physical link
- Used for neighbor discovery and router discovery
- Required for Router Advertisements

**Thread Usage**:
- Border Router link-local for receiving RAs from upstream
- Device-to-device communication for immediate neighbors
- Not routable beyond the link

**Example**: `fe80::38d0:a2b4:72fa:f618`

## Mesh-Local Address

**Purpose**: Stable identity across entire Thread mesh (multi-hop)

**Characteristics**:
- ULA (Unique Local Address) prefix: fd00::/8
- Routable throughout the Thread mesh
- Persists across topology changes
- Not routable to external networks
- Thread-specific extension of IPv6

**Format**: `<Mesh-Local-Prefix>:<64-bit EID>`

**Why Needed**: Link-local only works for 1-hop. In a multi-hop mesh (A ↔ B ↔ C), Device A cannot reach Device C using link-local. Mesh-local enables communication across the entire mesh regardless of hop count.

**Example**: `fd65:5b84:829e:dcc6:6004:3416:6205:5fe1`

## Routing Locator (RLOC)

**Purpose**: Topology-based routing within Thread network

**Characteristics**:
- Derived from Mesh-Local Prefix
- Changes when device moves or topology changes
- Used by Thread routing protocol
- Format: `<Mesh-Local-Prefix>::ff:fe00:<RLOC16>`

**RLOC16 Composition**:
- Router ID (6 bits) + Child ID (10 bits)
- Example: 0x7800 = Router 30 (0x1e), Child 0

**Example**: `fd65:5b84:829e:dcc6:0:ff:fe00:7800`

## Off-Mesh Routable (OMR) Address

**Purpose**: Enable external connectivity (Thread ↔ Wi-Fi/Internet)

**Characteristics**:
- Routable beyond the Thread mesh boundary
- Advertised by Border Router to both sides
- Thread devices auto-configure via SLAAC
- Infrastructure devices learn route via RIO

**How It Works**:
1. Border Router advertises OMR prefix into Thread mesh (via Network Data)
2. Thread devices generate OMR addresses using SLAAC
3. Border Router advertises route to infrastructure (via Router Advertisement RIO)
4. External devices learn how to reach Thread devices

**Example**: `fd03:46e3:b547:1:b22:9f5d:b00c:ea6e`

## Address Selection

When a Thread device communicates:

**To another Thread device**:
- Use Mesh-Local for stable addressing
- Use RLOC for routing protocol

**To external device (Wi-Fi/Internet)**:
- Use OMR address as source
- External device routes to OMR prefix via Border Router

**From external device to Thread device**:
- External device must use Thread device's OMR address
- Cannot use Mesh-Local (not routable externally)
- Border Router translates and routes into Thread mesh

## Common Misconceptions

**"Why can't I reach fd65:: addresses from my Mac?"**
- Mesh-Local addresses are Thread-internal only
- External devices must use OMR addresses
- This is by design for security and routing efficiency

**"Why does the device have so many addresses?"**
- Each address type serves a different purpose
- Link-Local: Neighbor discovery
- Mesh-Local: Stable mesh identity
- RLOC: Routing infrastructure
- OMR: External connectivity

**"What's the difference between OMR and Mesh-Local?"**
- Both use ULA (fd00::/8) space
- Mesh-Local: Thread mesh internal only
- OMR: Routable to external networks via Border Router
- Different prefixes distinguish them
