# QK80 MK2 协议笔记（v0.4）

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
