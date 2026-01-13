# OpenThread Border Router REST API Reference

## API Overview

OpenThread Border Router implementations expose REST APIs for management and monitoring. There are two main variants:

### Standard ot-br-posix
- **Port**: 8081
- **Base URL**: `http://<ip>:8081`
- **Platform**: Raspberry Pi, Linux SBCs

### ESP32-based OTBR
- **Port**: 80
- **Base URL**: `http://<ip>:80`
- **Platform**: ESP32-S3 + ESP32-H2
- **Additional**: Web GUI included

## Common Endpoints

### GET /node/dataset/active

**Purpose**: Retrieve active Thread network credentials

**Response**:
```json
{
  "ActiveTimestamp": {
    "Seconds": 1,
    "Ticks": 0,
    "Authoritative": false
  },
  "NetworkKey": "9c4eca8ed1ad51dc56f32ed442a4555a",
  "NetworkName": "OpenThread-ccb9",
  "ExtPanId": "18b5855b782c5104",
  "MeshLocalPrefix": "fd65:5b84:829e:dcc6::/64",
  "PanId": 52409,
  "Channel": 18,
  "PSKc": "2c68498f8354d708eef4d7f4288ba2c2",
  "SecurityPolicy": {
    "RotationTime": 672,
    "ObtainNetworkKey": true,
    "NativeCommissioning": true
  },
  "ChannelMask": 134215680
}
```

**Fields**:
- `NetworkKey`: Thread network encryption key (32 hex chars)
- `NetworkName`: Human-readable network name
- `ExtPanId`: Extended PAN ID (16 hex chars)
- `MeshLocalPrefix`: Mesh-local ULA prefix
- `PanId`: 16-bit PAN identifier
- `Channel`: IEEE 802.15.4 channel (11-26)
- `PSKc`: Pre-Shared Key for Commissioner

### GET /node/dataset/pending

**Purpose**: Retrieve pending Thread network configuration

**Usage**: Check if configuration changes are scheduled

### PUT /node/dataset/pending

**Purpose**: Set pending Thread network credentials

**Request Body**:
```json
{
  "ActiveDataset": "<base64-encoded-dataset>",
  "PendingTimestamp": {
    "Seconds": 1234567890,
    "Ticks": 0,
    "Authoritative": false
  },
  "Delay": 10000
}
```

**Fields**:
- `Delay`: Milliseconds before applying changes

## ESP32-Specific Endpoints

### GET /get_properties

**Purpose**: Thread network status and properties

**Response**:
```json
{
  "error": 0,
  "result": {
    "IPv6:LinkLocalAddress": "fe80:0:0:0:38d0:a2b4:72fa:f618",
    "IPv6:MeshLocalAddress": "fd65:5b84:829e:dcc6:6004:3416:6205:5fe1",
    "IPv6:MeshLocalPrefix": "fd65:5b84:829e:dc00::/56",
    "Network:Name": "OpenThread-ccb9",
    "Network:PANID": "0xccb9",
    "Network:XPANID": "18b5855b782c5104",
    "OpenThread:Version": "openthread-esp32/30aaf64524",
    "RCP:State": "leader",
    "RCP:Channel": "18",
    "RCP:TxPower": "20 dBm"
  }
}
```

**Key Fields**:
- `RCP:State`: Device role (leader, router, child, detached)
- `Network:PANID`: Network identifier
- `RCP:Channel`: Operating channel
- `RCP:TxPower`: Transmit power

### GET /node_information

**Purpose**: Detailed node information

**Response**:
```json
{
  "error": 0,
  "result": {
    "NetworkName": "OpenThread-ccb9",
    "ExtAddress": "3ad0a2b472faf618",
    "RlocAddress": "fd65:5b84:829e:dcc6:0:ff:fe00:7800",
    "LeaderData": {
      "PartitionId": 2141393352,
      "Weighting": 65,
      "DataVersion": 245
    },
    "State": 4,
    "Rloc16": 30720,
    "NumOfRouter": 1
  }
}
```

**State Values**:
- 0: Disabled
- 1: Detached
- 2: Child
- 3: Router
- 4: Leader

### GET /topology

**Purpose**: Network topology with all devices

**Response**:
```json
{
  "error": 0,
  "result": [
    {
      "ExtAddress": "3ad0a2b472faf618",
      "Rloc16": 30720,
      "IP6AddressList": [
        "fd65:5b84:829e:dcc6:0:ff:fe00:7800",
        "fd03:46e3:b547:1:b22:9f5d:b00c:ea6e"
      ],
      "ChildTable": []
    }
  ]
}
```

**Fields**:
- `ExtAddress`: Device IEEE 802.15.4 extended address
- `Rloc16`: Routing Locator (16-bit)
- `IP6AddressList`: All IPv6 addresses on device
- `ChildTable`: Child devices (if router/leader)

### GET /diagnostics

**Purpose**: Complete diagnostic information

**Response**: Extended version of topology with:
- MAC counters (packets sent/received)
- Routing table
- Network Data (hex string)
- Connectivity metrics

**Network Data Field**: Hex string containing Thread Network Data TLVs. Decode with `decode_thread_netdata.py` script.

### GET /available_network

**Purpose**: Scan for available Thread networks

**Response**:
```json
{
  "error": 0,
  "result": [],
  "message": "Networks: Success"
}
```

**Usage**: Active scan for nearby Thread networks. Result is array of discovered networks with PAN ID, Extended PAN ID, channel, RSSI.

### POST /join_network

**Purpose**: Join an existing Thread network

**Request Body**:
```json
{
  "index": 0,
  "defaultRoute": 1
}
```

**Fields**:
- `index`: Network index from available_network scan
- `defaultRoute`: 0 or 1

### POST /form_network

**Purpose**: Create new Thread network

**Request Body**:
```json
{
  "networkName": "MyNetwork",
  "extPanId": "1122334455667788",
  "panId": "0x1234",
  "channel": 15,
  "networkKey": "00112233445566778899aabbccddeeff"
}
```

### POST /add_prefix

**Purpose**: Add IPv6 prefix to Thread network

**Request Body**:
```json
{
  "prefix": "fd12:3456:789a:bcde::/64",
  "defaultRoute": false,
  "preferred": true,
  "slaac": true,
  "onMesh": true
}
```

### POST /delete_prefix

**Purpose**: Remove IPv6 prefix

**Request Body**:
```json
{
  "prefix": "fd12:3456:789a:bcde::/64"
}
```

## Error Handling

### Common Error Responses

**404 Not Found**:
```json
{
  "ErrorCode": "404",
  "ErrorMessage": "404 Not Found"
}
```

**Timeout**: No response within timeout period (typically 10-30 seconds)

**Connection Refused**: Port not open or service not running

## Best Practices

### Polling Intervals
- `/get_properties`: Every 5-10 seconds for monitoring
- `/topology`: Every 30-60 seconds for network changes
- `/diagnostics`: On-demand only (expensive)

### Timeouts
- Use 5-10 second timeout for most requests
- Use 30 second timeout for `/available_network` (active scan)

### Authentication
- Most OTBR implementations have no authentication
- Ensure network-level security (firewall, VPN)
- Some implementations may add API keys in future

### Rate Limiting
- Avoid rapid repeated requests
- Implement exponential backoff on failures
- Cache responses when appropriate
