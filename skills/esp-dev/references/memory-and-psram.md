# Memory, PSRAM, and DMA placement

Distilled from `vibe-s3/docs/psram-programming.md`, `vibe-s3/docs/os_tasks.md`,
`vibe-s3/research/lcd-spi-psram-bounce-rca.md` and
`nfcplay/docs/memory-practices.md`.

## The one-line rule

**Placement is a contract you write explicitly.** Use `heap_caps_malloc()` with
the capability flags you actually need, fail loudly, and prove where the buffer
landed with a pointer check. Plain `malloc()` is not a placement contract.

```c
int16_t *buf = heap_caps_malloc(bytes, MALLOC_CAP_SPIRAM | MALLOC_CAP_8BIT);
if (!buf) { ESP_LOGE(TAG, "alloc failed (%u B PSRAM)", bytes); return ESP_ERR_NO_MEM; }
ESP_LOGI(TAG, "buf psram=%d internal=%d", esp_ptr_external_ram(buf),
         esp_ptr_internal(buf));
```

Heap-cap *deltas* are not proof (a delta can come from anywhere); log the
pointer-derived placement at the allocation site. A "try PSRAM then internal"
retry reports success while actually stealing DMA headroom.

## Memory classes (ESP32-S3)

| Class | Caps | Notes |
| --- | --- | --- |
| Internal SRAM | `MALLOC_CAP_INTERNAL` | ~512 KB minus cache/statics/kernel; fast |
| DMA-capable internal | `MALLOC_CAP_DMA` | The scarce one; measured by `heap_dma`/`largest_dma` |
| PSRAM | `MALLOC_CAP_SPIRAM` | External, cache-mapped, 8 MB on S3R8 |
| PSRAM and DMA | `SPIRAM \| DMA` | Allowed on S3 (EDMA), data buffers only, low bandwidth, never descriptors |

Two PSRAM properties drive all the rules:

1. **PSRAM is accessed through the cache**, shared with flash. Streaming more than
   the data-cache size (~32 KB) falls off the cache cliff and can evict cached
   flash — expect slowdowns in code, not just in the buffer.
2. **PSRAM is inaccessible while the cache is disabled** (OTA, NVS, filesystem
   flash writes). Anything running in that window — ISRs, flash callbacks, their
   stacks and data — must be internal. (`CONFIG_SPIRAM_XIP_FROM_PSRAM` removes
   this class for code/rodata, at the cost of a bigger data cache.)

## Decision table

| Allocation | Placement |
| --- | --- |
| DMA descriptors | **Internal, always** (hard S3 constraint) |
| I2S DMA buffers / driver ring | **Internal** (driver-owned; ≤4092 B per DMA buffer) |
| LCD QSPI bounce / TX buffers | **Internal DMA**, contiguous |
| LVGL draw buffers | **PSRAM** (a full 480×480 RGB565 frame is ~450 KB) |
| Audio copy targets (feed buffers, accumulators) | **PSRAM** — measured safe |
| Task stacks | Internal by default; PSRAM only when measured safe and never cache-disabled (below) |
| Wi-Fi / LwIP buffers | PSRAM-preferred (`CONFIG_SPIRAM_TRY_ALLOCATE_WIFI_LWIP=y`) |
| Large zero-init statics | PSRAM via `EXT_RAM_BSS_ATTR` |
| Anything touched from an ISR | **Internal** |

## Task stacks in PSRAM

`xTaskCreate*` always allocates internal stacks. PSRAM stacks need static creation
plus `CONFIG_FREERTOS_TASK_CREATE_ALLOW_EXT_MEM=y`, TCB kept internal:

```c
StaticTask_t *tcb   = heap_caps_malloc(sizeof(StaticTask_t), MALLOC_CAP_INTERNAL | MALLOC_CAP_8BIT);
StackType_t  *stack = heap_caps_malloc(STACK_BYTES, MALLOC_CAP_SPIRAM | MALLOC_CAP_8BIT);
xTaskCreateStaticPinnedToCore(task_fn, "name", STACK_BYTES, NULL, prio, stack, tcb, core);
```

**Eligibility:** only if the task never executes while the cache is disabled (no
flash/NVS/OTA/filesystem, directly or transitively). Migrated-and-validated in
vibe-s3: `battery`, `lvgl`, `peer_proto`, `media_tx`, `opus_enc`, `capture`,
`afe_feed`/`afe_fetch`. Keep `CONFIG_FREERTOS_CHECK_STACKOVERFLOW_CANARY=y` so an
overflow is a panic, not silent corruption. Verify with a mid-session `nvs_commit`
stimulus while the feature is live.

## `largest_dma` is the real budget

- **`largest_dma` is a fragmentation metric, not a free-bytes metric.** Moving an
  allocation off internal raises `free_int` reliably; `largest_dma` only moves when
  freed space is contiguous with the current largest free block. In one sequence
  `heap_int` rose ~7 KB while `largest_dma` stayed flat at 4,864 B, then jumped to
  7,424 B purely by coalescence.
- The **lazy I2S DMA ring (~23.7 KB)** is an immovable floor and a fragmentation
  source; application-level work cannot push past what its layout allows.
- **Internal allocations can actively fragment.** A 3 KB battery stack in internal
  SRAM dropped `largest_dma` 4,864 → 1,664 B and caused `lcd_bounce_alloc_fail`
  on 3,840 B LCD strips — the screen froze while the rest of the system looked
  healthy.
- **Right-size before you migrate.** Shrinking stacks 8 K → 3 K first made the
  freed blocks small enough to coalesce, which is what finally lifted `largest_dma`.
- Set PASS criteria on `largest_dma` coalescence and the LCD bound
  (≥3,840 B contiguous plus margin, zero `lcd_bounce_alloc_fail`) — not on
  `free_int` arithmetic.

## No-PSRAM boards (M5Dial / ESP32-S3FN8)

Rules invert; internal SRAM (~512 KB total, ~350 KB usable heap) is the only pool.

- No `ps_malloc` / `MALLOC_CAP_SPIRAM` — it does not exist; use
  `MALLOC_CAP_INTERNAL`/`MALLOC_CAP_DMA` only.
- LVGL: **partial draw buffers only** (strip/line). A full 240×240 16-bit frame is
  115 KB, ARGB8888 230 KB — both are a large share of the heap.
- Reserve Wi-Fi/LwIP headroom (tens of KB) before sizing app buffers.
- Pre-allocate large buffers early in `app_main` (before Wi-Fi churn) to limit
  fragmentation; watch `heap_caps_get_largest_free_block()` and
  `heap_caps_get_minimum_free_size()`.
- Task stacks are internal SRAM: right-size them, track high-water marks
  (`rtos-and-liveness.md`), don't default-grow.
- Use flash for immutable assets (fonts, tables).
- Log allocation failure with the requested size and a heap snapshot — never
  swallow an OOM into a silent no-op.

## Verification playbook

1. Placement proof at the allocation site (`esp_ptr_*` logged).
2. Heap checkpoints at meaningful phases:
   `heap tag=boot|post_ui|post_audio|ready|connected int=… psram=… dma=… largest_dma=…`.
3. Per-task stack high-water marks every health period
   (`CONFIG_FREERTOS_USE_TRACE_FACILITY=y` + a small stack reporter task).
4. A scored soak with the real path exercised (see `soak-and-verification.md`).
5. **One change per build/flash/soak** so each delta is attributable.

`heap_caps_check_integrity_all(true)` is a corruption diagnostic — it cannot tell
you where a buffer lives.

## Extra traps

- `MALLOC_CAP_32BIT` may return IRAM: 32-bit accesses only, and no `float`
  (the Xtensa FPU cannot reach IRAM).
- Don't allocate from ISRs; pre-allocate.
- Some dense numeric code has crashed from PSRAM stacks with odd exceptions
  (`IntegerDivideByZero`) — keep hot/complex stacks internal, migrate only cold,
  measured tasks.
- CPU ↔ DMA sharing needs `esp_cache_msync()` with cache-line-aligned address and
  size when *you* own the DMA; IDF drivers already do it. Avoid the `UNALIGNED`
  flag (it can discard neighbouring partial cache lines).
- PSRAM startup cost: memtest ≈1 s per 4 MB, heap poisoning ≈300 ms per 4 MiB.
