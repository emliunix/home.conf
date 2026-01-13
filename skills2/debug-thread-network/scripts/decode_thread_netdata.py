#!/usr/bin/env python3
"""
Decode Thread Network Data TLV format into human-readable structure.
"""

import sys


def decode_network_data(hex_string):
    """Decode Thread Network Data hex string."""
    try:
        data = bytes.fromhex(hex_string.strip())
    except ValueError as e:
        print(f"Error: Invalid hex string - {e}", file=sys.stderr)
        return

    print("=" * 70)
    print("Thread Network Data Analysis")
    print("=" * 70)
    print(f"Total length: {len(data)} bytes\n")

    # Parse TLVs
    i = 0
    prefix_num = 0

    while i < len(data):
        if i + 2 > len(data):
            break

        tlv_type = data[i]
        tlv_length = data[i + 1]

        if i + 2 + tlv_length > len(data):
            break

        tlv_value = data[i + 2 : i + 2 + tlv_length]

        print(f"Offset {i:3d}: Type=0x{tlv_type:02x} Length={tlv_length}")

        # Decode known TLV types
        if tlv_type == 0x03:  # Prefix TLV
            prefix_num += 1
            decode_prefix_tlv(tlv_value, prefix_num)
        elif tlv_type == 0x08:
            print("           → Border Router TLV")
        elif tlv_type == 0x0B:
            print("           → Service TLV")
        elif tlv_type == 0x0D:
            print("           → Server TLV")
        else:
            print(f"           → Unknown TLV Type")

        print(f"           → Raw: {tlv_value.hex()}")
        print()

        i += 2 + tlv_length

    # Summary of prefixes
    print("\n" + "=" * 70)
    print("Prefix Summary")
    print("=" * 70)

    i = 0
    prefixes = []
    while i < len(data) - 8:
        if data[i] == 0xFD or data[i] == 0xFC:
            prefix_bytes = data[i : i + 8]
            parts = [
                f"{prefix_bytes[j]:02x}{prefix_bytes[j + 1]:02x}"
                for j in range(0, 8, 2)
            ]
            prefix_str = ":".join(parts)
            prefixes.append(f"{prefix_str}::/64")
            i += 8
        else:
            i += 1

    if prefixes:
        for prefix in prefixes:
            print(f"  • {prefix}")
        print(f"\nTotal prefixes found: {len(prefixes)}")
    else:
        print("  No ULA prefixes (fd/fc) found")


def decode_prefix_tlv(tlv_value, prefix_num):
    """Decode Prefix TLV structure."""
    print(f"           → Prefix TLV #{prefix_num}")

    if len(tlv_value) < 2:
        return

    domain_id = tlv_value[0]
    prefix_len_bits = tlv_value[1]
    prefix_bytes_len = (prefix_len_bits + 7) // 8

    if len(tlv_value) < 2 + prefix_bytes_len:
        return

    prefix = tlv_value[2 : 2 + prefix_bytes_len]
    prefix_padded = prefix + bytes(16 - len(prefix))
    prefix_str = ":".join(
        [f"{prefix_padded[j]:02x}{prefix_padded[j + 1]:02x}" for j in range(0, 16, 2)]
    )

    print(f"           → Address: {prefix_str}/{prefix_len_bits}")
    print(f"           → Domain ID: {domain_id}")

    # Decode sub-TLVs
    sub_tlv_offset = 2 + prefix_bytes_len

    if sub_tlv_offset < len(tlv_value):
        print(f"           → Sub-TLVs:")

    while sub_tlv_offset < len(tlv_value):
        if sub_tlv_offset + 2 > len(tlv_value):
            break

        sub_type = tlv_value[sub_tlv_offset]
        sub_len = tlv_value[sub_tlv_offset + 1]

        if sub_tlv_offset + 2 + sub_len > len(tlv_value):
            break

        sub_value = tlv_value[sub_tlv_offset + 2 : sub_tlv_offset + 2 + sub_len]

        if sub_type == 0x05:  # Border Router Sub-TLV
            decode_border_router_subtlv(sub_value)
        elif sub_type == 0x07:  # Has Route Sub-TLV
            decode_has_route_subtlv(sub_value)
        else:
            print(f"             • Unknown Sub-TLV (0x{sub_type:02x})")

        sub_tlv_offset += 2 + sub_len


def decode_border_router_subtlv(sub_value):
    """Decode Border Router Sub-TLV flags."""
    print(f"             • Border Router Sub-TLV")

    if len(sub_value) < 4:
        return

    rloc16 = (sub_value[0] << 8) | sub_value[1]
    flags = sub_value[2]

    print(f"               RLOC16: 0x{rloc16:04x}")
    print(f"               Flags: 0x{flags:02x}")
    print(f"                 - Preferred (P): {bool(flags & 0x20)}")
    print(f"                 - SLAAC (A): {bool(flags & 0x40)}")
    print(f"                 - DHCP (D): {bool(flags & 0x08)}")
    print(f"                 - Configure (C): {bool(flags & 0x04)}")
    print(f"                 - Default Route (R): {bool(flags & 0x02)}")
    print(f"                 - On-Mesh (O): {bool(flags & 0x01)}")


def decode_has_route_subtlv(sub_value):
    """Decode Has Route Sub-TLV."""
    print(f"             • Has Route Sub-TLV (External Route)")

    if len(sub_value) < 3:
        return

    rloc16 = (sub_value[0] << 8) | sub_value[1]
    route_prf = sub_value[2]

    preference = (route_prf >> 6) & 0x03
    pref_str = ["Medium", "High", "Reserved", "Low"][preference]

    print(f"               RLOC16: 0x{rloc16:04x}")
    print(f"               Preference: {pref_str}")


def main():
    if len(sys.argv) > 1:
        # Hex string provided as argument
        hex_string = sys.argv[1]
    else:
        # Read from stdin
        hex_string = sys.stdin.read()

    if not hex_string.strip():
        print("Usage: decode_thread_netdata.py <hex-string>", file=sys.stderr)
        print("   or: echo <hex-string> | decode_thread_netdata.py", file=sys.stderr)
        print(
            "   or: curl ... | jq -r '.NetworkData' | decode_thread_netdata.py",
            file=sys.stderr,
        )
        sys.exit(1)

    decode_network_data(hex_string)


if __name__ == "__main__":
    main()
