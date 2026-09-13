# QK80 MK2 协议笔记（v1.2.6）

## RAM_FRAME_V2 主键盘 91 灯通道

Host 报告固定 32 bytes：`07 16 05` 后跟 28-byte v2 payload。payload 为：

`version, op, session, sequence, count, rgb[21], crc8, reserved`

- `version = 2`
- `op`：`0=EXIT`、`1=BEGIN`、`2=DATA`、`3=COMMIT`
- `session`：1–14 循环使用
- DATA 的 `sequence`：0–12，`count=21`，每包 7 颗灯
- CRC：CRC-8/ATM，poly `0x07`、init `0x00`，覆盖 payload 0–25
- 一帧：BEGIN → 13 DATA → COMMIT；仅 COMMIT 刷新物理灯
- 静态帧采用 50 ms 包间隔；最快实验播放采用 5 ms 额外间隔，实测约 5–6 FPS。0 ms 已证实会使链路从首帧停滞，因此不再提供。所有档位均不发送 RGB `CUSTOM_SAVE`，不写 EEPROM

PLC 会拒绝错误版本、CRC、session、sequence、长度和未收齐便 COMMIT。EXIT 是 fail-open 恢复路径。该行为已完成实机整帧、原子提交和乱序恢复验证。

实时播放器按完整帧顺序运行，不追赶旧时间线、不主动跳过动画帧。正式版默认使用已完成冷启动实测的 10 ms 额外包间隔并以 4 FPS 调度；超周期帧实测为 0。5 ms 冷启动不稳定、0 ms 会停滞，因此均不再提供。

后续章节保留旧版协议研究记录；主键盘 RGB 的当前实现以上述 RAM_FRAME_V2 为准。

## USB

- VID: `0x514B`
- PID: `0x4D02`
- Raw HID Usage Page: `0xFF60`
- Raw HID Usage: `0x61`
- HID Report ID: `0`
- HID payload: 32 bytes
- 实机 Protocol: `0x000C`

## VIA / Keymap

- `0x01` GET_PROTOCOL_VERSION
- `0x04` GET_KEYCODE
- `0x05` SET_KEYCODE
- `0x0A` EEPROM_RESET
- `0x0C` DYNAMIC_KEYMAP_MACRO_GET_COUNT
- `0x0D` DYNAMIC_KEYMAP_MACRO_GET_BUFFER_SIZE
- `0x0E` DYNAMIC_KEYMAP_MACRO_GET_BUFFER
- `0x0F` DYNAMIC_KEYMAP_MACRO_SET_BUFFER
- `0x10` DYNAMIC_KEYMAP_MACRO_RESET
- `0x11` GET_LAYER_COUNT
- `0x12` GET_KEYMAP_BUFFER
- `0x13` SET_KEYMAP_BUFFER

QMK/VIA quantum ranges used by the current official configurator include:

- `TO(n)` base `0x5010`
- `MO(n)` base `0x5100`
- `DF(n)` base `0x5200`
- `TG(n)` base `0x5300`
- `OSL(n)` base `0x5400`
- `TT(n)` base `0x5800`
- `MACRO(n)` base `0x5F12`
- `CUSTOM(n)` base `0x5F80`

## Macro Protocol v11+

- Macro terminator: `0x00`
- Key action prefix: `0x01`
- Actions:
  - Tap `0x01`
  - Down `0x02`
  - Up `0x03`
  - Delay `0x04`
- Delay terminator: `0x7C` (`|`)

Example conceptual encoding:

`{+KC_LCTL}{KC_C}{-KC_LCTL}{100}`

uses action-prefix records followed by a decimal delay string ending in `0x7C`.

## Custom Value

- `0x07` SET
- `0x08` GET
- `0x09` SAVE

### Lighting channels

- `0x15` Underglow / 氛围灯
- `0x16` RGB Matrix / 轴灯
- `0x1A` Matrix LED / 点阵屏

Lighting IDs:

- `01` Brightness `uint8`
- `02` Effect / Mode `uint8`
- `03` Speed `uint8`（0x15 / 0x16）
- `04` Color = Hue + Saturation（2 bytes；亮度独立）

Matrix LED modes:

- `00` All Off
- `01` Typewriter
- `02` Terminal
- `03` Raindrop
- `04` Custom

### QK80 MK2 device settings

Official definition mappings:

- MAGIC: channel `19 / 0x13`
  - ID 1: NKRO
  - ID 2: GUI keys
  - ID 3: Alt/GUI swap
  - ID 4: Caps → Ctrl
- FEATURES: channel `17 / 0x11`
  - ID 1: LED power
  - ID 2: sleep mode
  - ID 6: debounce mode
  - ID 7: debounce delay
- CONNECT: channel `18 / 0x12`
  - ID 1: connection mode
  - ID 3: clear current bound
  - ID 4: clear all bounds
  - ID 5: 2.4G receiver DFU
- Date/Time: channel `25 / 0x19`
  - SET payload `[25, uint32_be(local_unix_seconds)]`
  - then SAVE `[25]`

## CDC / Web Serial

- baud: `115200`
- packet: `64 bytes`

### 7×7 Matrix init

`C0 <frames> <fps> <width=7> <height=7> ...`

### 7×7 Matrix chunks

`C1 <offset:u32 BE> <length:u8> <payload>`

- max payload: `56 bytes`
- 每像素 3 bytes：HSV888
- row-major
- 1 frame = `7*7*3 = 147 bytes`

## Screen / file transport found in official source

- `E0/E1/E2`: file init / data / cancel over CDC
- `EF/F0/F1`: firmware query / info / data
- HID fallback uses command `0xD1`

v0.4 deliberately does not expose firmware flashing UI.


## Per-Key RGB (v0.5)

官方 VIA 派生代码实现：

```text
GET:  08 00 01 <ledIndex> 01 -> response[5]=Hue, response[6]=Sat
SET:  07 00 01 <ledIndex> 01 <Hue> <Sat>
SAVE: 09 00
```

QK80 MK2 v3 definition 没有公开 `layouts.keys[].li`，因此网页默认以当前物理键画面顺序生成 LED index，并允许用户校准。


## v1.1.0 主键盘逐键 RGB 动画运行方式

当前实现继续使用 VIA Custom Menu 的逐键接口：

- 读取单键：`08 00 01 <LED> 01`
- 设置单键：`07 00 01 <LED> 01 <Hue> <Saturation>`
- 静态持久化：`09 00`

实时播放不会发送 `09 00`，只在 RAM/当前运行状态中逐键更新。播放引擎按相邻帧做 diff，只发送颜色变化的键；如果单帧传输超过目标帧周期，会跳过已经过时的动画帧，避免积压越来越严重。页面显示的是目标 FPS 和实测 FPS，两者可能不同。

当前固件接口只提供每键 `Hue + Saturation`，没有独立 Value/Brightness，所以网页中的黑色仅表示“熄灭预览”，不能通过这套接口写成单键关灯。

若固件返回首字节 `0xFF`，表示 VIA `id_unhandled` / 当前命令不受支持；v1.1.0 会立即报错，不再等待 HID 超时。


## v1.1.1 RGB protocol probe findings

### Standard VIA Per-Key RGB painter
Official client generic API uses:

- GET: `08 00 01 <ledIndex> 01`
- SET: `07 00 01 <ledIndex> 01 <Hue> <Saturation>`
- Commit custom menu channel 0: `09 00`

On the tested QK80 MK2 firmware the SET path returned `FF 00 01 ...`, i.e. VIA `id_unhandled`. This indicates the generic `00 01` Per-Key channel is not exposed by this firmware/definition path even though the hardware can run per-key multi-color RGB effects.

### QK private Matrix Lighting bulk transport (from official client code)
There are two equivalent bulk writers in the official client:

**Raw HID / TAB_BLOCKS (`0xD1`)**

- Init: `D1 30 <frames> <fps> <rows> <cols>`
- Data: `D1 31 <offset:4 bytes> <len> <data...>`
- Official HID implementation chunks data at 25 bytes.

**CDC / Web Serial**

- Init: `C0 <frames> <fps> <rows> <cols>`
- Data: `C1 <offset:4 bytes> <len> <data...>`
- 64-byte packets, 56-byte data chunks.

The official matrix editor encodes every pixel as HSV888 and calls this API with its configured rows/cols. For QK80 MK2 our known 7×7 screen already uses the CDC path. **This does not yet prove the same bulk buffer controls the main-key RGB matrix.** v1.1.1 therefore probes the D1 path only as an explicit, confirmed RAM-only action and does not route the main-key painter through it automatically.

### Diagnostic policy
The automatic RGB diagnostic performs GET/read-only operations only. The D1 test is separate because it writes Matrix Lighting RAM. It does not issue CUSTOM_SAVE or EEPROM reset/save.
