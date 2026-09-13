# RAM_FRAME_V3 PLC 候选固件

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
