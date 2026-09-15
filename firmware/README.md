# QK80 MK2 PLC 自制固件

## PERSISTENT_EFFECT_V5_BACKGROUND（离线验证通过，待实机验收）

`QK80MK2_PLC_v1.1.1_PERSISTENT_EFFECT_V5_BACKGROUND_UNFLASHED_CANDIDATE.uf2` 基于已实机验证的 V4，在保存呼吸/流动渐变参数时额外快照当前完整 91 灯 RGB888 底图。重新上电后先恢复底图，再由 PLC 约 31 FPS 只更新动画掩码中的灯。只需更新 PLC，Master 保持现有 V2。

SHA-256：

```text
B57584DDAFA212CF134BC0D6A5610F641A90DF1008677C35AAE88D12E27A9C60
```

V5 使用与 V4 相同的独立 2 KiB Flash 页，300-byte 记录的有效标记最后写入，中途断电产生的半记录不会被启动引擎接受。V5 已通过代码区边界、记录校验、损坏拒绝、UF2 往返和非 payload 零改动检查，但尚未完成首次实机刷写验收。请通过 QK 官方驱动刷入并保留官方 PLC 固件；若出现异常立即刷回官方固件。

## PERSISTENT_EFFECT_V4（首次实机验收通过）

`QK80MK2_PLC_v1.1.1_PERSISTENT_EFFECT_V4_UNFLASHED_CANDIDATE.uf2` 在已验证的 V3 上新增键盘本地呼吸/流动渐变、显式保存和清除。只需更新 PLC，Master 保持现有 V2。固件运行时约 31 FPS，仅保存/清除时擦写专用 Flash 页。

SHA-256：

```text
1E255F8EB54DED15BCF62A5E469DBAFE93AE9EE5ABE49E9349416B4174623C3E
```

该精确 SHA-256 文件已由用户通过 QK 官方驱动成功刷入，并确认“保存到键盘”功能正常。原网页“另存为到引导盘”升级方式存在兼容问题，现已停用；后续仍应通过 QK 官方驱动刷写。请保留官方 PLC 固件，若异常立即刷回。

## RAM_FRAME_V3（已实机验证）

`QK80MK2_PLC_v1.1.1_RAM_FRAME_V3_MASK_COLOR_UNFLASHED_CANDIDATE.uf2` 在已实机验证的 RAM_FRAME_V2 PLC 固件上新增 `MASK_COLOR` 操作。文件名保留构建时的 `UNFLASHED_CANDIDATE` 标记，但该精确 SHA-256 映像现已完成实机验证。

- 只需要更新 PLC；现有 RAM_FRAME_V2 Master 保持不变。
- 原来的 91 灯整帧 BEGIN/DATA/COMMIT 和 EXIT 路径保持兼容。
- 新操作每包携带 91-bit 物理灯掩码和一个 RGB888 颜色，只更新被选中的灯。
- 不分配新 RAM，不调用 CUSTOM_SAVE，不写 EEPROM。
- 固件已完成 UF2 结构、改动范围、CRC/掩码边界和协议模型离线检查，并通过 30 FPS 实机验收。

SHA-256：

```text
B39D8ACF7C5E202DB03B11F6EE2C3FA0EB024DB324BBAB68AFB1F40F241F28DB
```

实机验收结果：Esc 呼吸和双色渐变均顺滑且只有 Esc 变化，实际 30 FPS，无闪烁、卡顿、超时或输入异常；Backspace 的 LED 45/46/47 同步；停止播放和 EXIT 恢复官方灯效均正常。
