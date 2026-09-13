# RAM_FRAME_V3 实机验证记录

验证日期：2026-09-14

固件 SHA-256：

```text
B39D8ACF7C5E202DB03B11F6EE2C3FA0EB024DB324BBAB68AFB1F40F241F28DB
```

## 验收结果

- Esc 呼吸顺滑，只有 Esc 变化。
- 实际刷新率稳定为 30 FPS。
- 无闪烁、卡顿、响应超时或 HID 断连。
- 接管期间键盘输入正常。
- Esc 双色渐变顺滑，其他灯保持不变。
- Backspace 对应的 LED 45/46/47 三颗灯同步。
- 停止播放正常。
- EXIT 后官方灯效正常恢复。

结论：RAM_FRAME_V3 `MASK_COLOR` 的单键、宽键多灯、30 FPS 播放、输入隔离和恢复路径均通过实机验收。
