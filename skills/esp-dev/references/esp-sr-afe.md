# esp-sr Audio Front End (AFE)

Distilled from `~/Documents/vibe-s3/esp-sr.md` (Waveshare S3 AMOLED board,
dual mic + ES8311/ES7210). Read the repo file for the full option tables.

## Mental model

AFE is a configurable DSP pipeline: you describe the **physical TDM channel
layout** with an `input_format` string, pick an `afe_type` (use case) and an
`afe_mode` (cost vs quality), and the library wires AEC, mic-array SE, NS, VAD,
WakeNet and AGC accordingly.

```
I2S/TDM interleaved PCM -> afe_iface->feed() -> [AEC -> SE -> NS -> VAD -> WakeNet] -> afe_iface->fetch()
```

Models (WakeNet, NSNet, VADNet) load from the flash `model` partition via
`esp_srmodel_init("model")`.

## `input_format` — the string that must match reality

| Char | Meaning |
| --- | --- |
| `M` | microphone channel |
| `R` | playback reference channel (needed for AEC) |
| `N` | unused / padding slot |

The string must match **physical TDM slot order**, left to right. Examples: `M`,
`MR`, `MM`, `MMR`, `MMRN`, `MNMR`, `MMNR`.

**Lesson:** the Waveshare 2.16 schematic implies `MMRN`, but the measured DMA
order was `MNMR` — the device ships and works with `MNMR` until playback
calibration says otherwise. Derive the layout from measurement, not from the
schematic, and re-check it when the audio path changes.

`afe_config_check()`: with **2+ mic channels, SE (BSS) takes priority over NS**;
if SE is disabled, only the first mic channel may be used.

## Types and modes

| `afe_type_t` | Scenario | Rate | Nonlinear NS |
| --- | --- | --- | --- |
| `AFE_TYPE_SR` | speech recognition / wake word | 16 kHz | no |
| `AFE_TYPE_VC` | voice communication | 16 kHz | yes (NSNet) |
| `AFE_TYPE_VC_8K` | narrowband VoIP | 8 kHz | yes |
| `AFE_TYPE_FD` | full-duplex (play + capture) | 16 kHz | yes |

Modes: `AFE_MODE_LOW_COST` (CPU/RAM) vs `AFE_MODE_HIGH_PERF` (quality). AEC modes
come in SR / FD / VOIP variants, each low-cost or high-perf, with 32 ms frames
(16 ms for VOIP); AEC requires at least one `R` channel.

Other fields worth knowing: `memory_alloc_mode` (PSRAM vs internal — see
`memory-and-psram.md`; "prefer PSRAM" there is a preference, not proof),
`afe_perferred_core` / `afe_perferred_priority`, `afe_linear_gain`,
`aec_nlp_level`.

## Pipeline defaults (ESP32-S3 benchmark)

Single mic + ref (`MR`): SR → `AEC → VAD → WakeNet`; VC → `AEC(VOIP) → NS(nsnet2)
→ VAD`; FD → `AEC(FD) → VAD → WakeNet`.

## Practice notes

- Treat AFE as a real-time consumer: feed it on a fixed cadence and gate on the
  measured feed time (`afe_feed_us_max`) rather than assuming.
- Migrating AFE buffers to PSRAM is validated by measured feed time plus zero DMA
  errors — not by "it allocated".
- AFE-era task architectures churn; re-verify the `os_tasks` inventory when the
  capture path changes instead of trusting old rows.
