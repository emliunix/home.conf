# Boards, wiring, and serial ports

## Inventory

| Board | SoC | RAM | Flash | Console/port notes | Used by |
| --- | --- | --- | --- | --- | --- |
| M5Stack Dial ("M5Dial") | ESP32-S3FN8 (Xtensa LX7 dual @240 MHz) | 512 KB SRAM, **NO PSRAM** | 8 MB in-package | native USB-Serial/JTAG `303a:1001`; app (UiFlow2) enumerates as `303a:81dd` serial `c04e3012ad200000` | vibe-s31 (S3 target), nfcplay |
| Waveshare ESP32-S3-Touch-AMOLED-2.16 | ESP32-S3R8 @240 MHz | 8 MB embedded octal PSRAM | 16 MB NOR | native USB-Serial/JTAG on GPIO19/20, typically `/dev/ttyACM0` while the only board attached | vibe-s3 |
| ESP32-S31 coreboard (rev v0.0) | dual-core RISC-V @320 MHz + LP core | ~424 KB SRAM + 16 KB + 31 KB RTCRAM | 16 MB (DIO @80 MHz) | USB-Serial/JTAG `303a:1001`, MAC `30:ed:a0:f4:3d:08`, was `/dev/ttyACM0` | vibe-s31 |
| M5Stack Tab5 ("P4") | ESP32-P4NRW32 (RISC-V HP dual @360 MHz + LP @40 MHz) | 768 KB SRAM | 16 MB | USB-Serial/JTAG `303a:1001`, `/dev/ttyACM1` in that setup | vibe-s31 |

**Serial ports are not identities.** Enumerated `/dev/ttyACM*` order changes with
plug order; verify with `esptool -p /dev/ttyACMx read_mac` (or the USB serial/MAC)
before flashing. `nfcplay` hit exactly this: `ttyACM0` was an unrelated
coreboard, `ttyACM1` was the Dial — flashing the wrong one is one command away.

## M5Dial (nfcplay / S3 benchmark target)

- 1.28" round GC9A01 240×240 TFT, FT3267 touch, rotary encoder (16 pos / 64
  pulses), buzzer, DC 6–36 V input, BM8563 RTC.
- **Port-A = G13 (SDA) / G15 (SCL)**; **Port-B = G2 / G1**. Easy to swap — an
  early `board.md` draft used G2/G1 for Port-A and was wrong.
- Internal I2C (G11 SDA / G12 SCL) carries the **onboard WS1850S** 13.56 MHz
  reader (ISO14443 A/B, ~0x28, rc522-compatible) and the BM8563 RTC. Distinct
  from the Port-A NFC unit — don't confuse them.
- **No PSRAM** (ESP32-S3FN8): all buffering is internal SRAM. See
  `memory-and-psram.md`.
- Flashing: first flash needs **BOOT held during power-on** to enter download
  mode; once our firmware is on, USB auto-reset works.

## Waveshare ESP32-S3-Touch-AMOLED-2.16 (vibe-s3)

| Peripheral | Device | Interface / pins |
| --- | --- | --- |
| Display | CO5300 480×480 AMOLED | QSPI `GPIO4/5/6/7/38/12/39` |
| Touch | CST9217 | I2C + INT/RST `GPIO14/15/11/40` |
| PMU | AXP2101 (battery, rails, USB detect) | I2C `GPIO14/15` |
| IMU | QMI8658A/C | I2C, `QMI_INT1=GPIO17`, `QMI_INT2=GPIO21` |
| RTC | PCF85063ATL | I2C, `RTC_INT=GPIO13` |
| microSD | SD over SPI | `CMD=1 CLK=2 D0=3 SDCS=41` |
| Audio out / in | ES8311 / ES7210 (dual mic) | I2S `GPIO8/9/42/45/46`, `GPIO9/10/42/45` |
| Shared I2C bus | — | `GPIO14`=SCL, `GPIO15`=SDA |
| Buttons | BOOT `GPIO0`, Key3 `GPIO18`, PWR via PMU | — |

Full spec + sources: `~/Documents/vibe-s3/board.md`.

## ESP32-S31 / Tab5 (vibe-s31)

- **S31** is a *preview* target in IDF v6.1-beta1: `idf.py --preview set-target
  esp32s31`. Octal PSRAM runs at 250 MHz on our board (drop to 200 MHz if init
  fails). JTAG via OpenOCD `board/esp32s31-builtin.cfg` on the same USB port.
- **Tab5 / P4** quirks that cost hours:
  - Bootloader offset is **0x2000**, not 0x0.
  - Chip is rev v1.0 → needs `CONFIG_ESP32P4_REV_MIN_100=y` **and**
    `CONFIG_ESP32P4_SELECTS_REV_LESS_V3=y` (IDF's default rev-min v3.1 rejects it).
  - Default console is UART0 → set `CONFIG_ESP_CONSOLE_USB_SERIAL_JTAG=y` or you
    see nothing.
  - 32 MB PSRAM is **hexadecimal (X16)**, not octal.
- **Download-mode latch (both Dial and Tab5):** once in ROM download mode, every
  soft reset (USB/JTAG/RTS) re-enters download mode; only a clean power-cycle
  boots the app. Flashing succeeds and the board still looks dead — check for
  this before debugging firmware.
- S31 has no such latch: flashing triggers auto-reset reliably.

## Storage/RAM sizing pitfalls

- The S31's ~424 KB internal RAM cannot hold two 1 MB internal buffers — use
  ~128 KB pairs (a P4 build failed `heap_caps_malloc(MALLOC_CAP_INTERNAL|DMA)`
  with 2×256 KB requests until reduced to 128 KB).
- One binary can boot with or without PSRAM: `CONFIG_SPIRAM` +
  `CONFIG_SPIRAM_IGNORE_NOTFOUND`, with PSRAM tests skipping gracefully and
  logging the skip (verified on the PSRAM-less Dial across a whole suite).

## NFC unit wiring (nfcplay)

- M5Stack NFC Universal Unit (ST25R3916) on **Port-A**: I2C address `0x50`,
  Port-A carries SDA/SCL + 5 V/GND (units are typically 5 V with 3.3 V logic).
- Protocols at the IC: ISO14443A/B, FeliCa, ISO15693 — all four sensor-capable;
  firmware polls Type-A today.
- IRQ / reset / power-enable GPIOs are exposed by the M5Unit-NFC driver but were
  never confirmed on the physical unit — confirm before relying on them.
- Sources: `~/Documents/nfcplay/board.md`.
