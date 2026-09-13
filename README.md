# QK80 MK2 Web Driver

QK80 MK2 的本地网页驱动。项目使用原生 HTML、CSS 和 JavaScript，无需安装 npm 依赖。

当前正式版本：**v1.2.6**

## 功能

- VIA/QMK 键位读取与改键
- 宏读取、编辑、导入与导出
- 轴灯、氛围灯和点阵屏普通参数
- 7×7 点阵动画编辑与上传
- 主键盘 91 灯 RGB 画板
- 多帧 RGB 动画、本地方案和 JSON 导入/导出
- Profile 导入与导出
- 本地界面主题与背景设置

## 主键盘 RGB

主键盘 RGB 使用已实机验证的 `RAM_FRAME_V2` 私有通道：

- 91 颗灯，RGB888，共 273 bytes
- 每帧 `BEGIN → 13 DATA → COMMIT`
- DATA 期间保持上一完整画面，COMMIT 时一次刷新
- 黑色会作为真正的 `[0,0,0]` 发送
- 宽键会自动控制对应的多颗灯
- 默认 4 FPS，10 ms 包间隔
- 冷启动立即播放，实测 4 FPS、超周期帧 0
- 仅写 RAM，不写 EEPROM
- 点击“退出接管”、关闭/刷新页面或重新上电后恢复官方灯效

5 ms 在冷启动时会长时间卡顿，0 ms 会直接停滞，因此正式版不提供这两个档位。

## 固件要求

主键盘 91 灯 RGB 功能要求键盘已经刷入配套的 `RAM_FRAME_V2` Master 和 PLC 固件。原厂固件不支持此私有整帧通道。

其他 VIA/QMK 功能是否可用取决于当前键盘固件提供的接口。

## 本地运行

1. 解压或克隆本项目。
2. 双击 `start-local.bat`。
3. 使用桌面版 Chrome 或 Edge 打开脚本显示的 localhost 地址。
4. 关闭 QK 官方配置页面，避免两个页面同时占用设备 HID/串口。
5. 点击“连接 HID”；上传 7×7 点阵动画时再连接 CDC。

也可以在 PowerShell 中运行：

```powershell
.\start-local.ps1
```

## RGB 使用方法

1. 打开“主键盘逐键 RGB 画板”。
2. 选择颜色并点击或拖动键帽。
3. 使用“整帧填充”快速设置背景。
4. 新增或复制帧制作动画。
5. 点击“发送当前帧到键盘（RAM）”发送静态画面。
6. 选择“4 FPS（稳定高速，推荐）”后点击“实时播放到键盘”。
7. 结束时点击“退出接管 / 恢复官方灯效”。

网页关闭后动画不会继续播放，因为动画计时与逐帧发送仍在浏览器端。键盘端离线动画需要后续固件加入本地存储和播放器。

## 安全说明

- RGB 自定义帧不会调用 `CUSTOM_SAVE`，不会写入 EEPROM。
- 静态帧使用 50 ms 安全包间隔。
- 实时 4 FPS 使用实机验证过的 10 ms 包间隔。
- 传输错误时网页会自动尝试发送 EXIT。
- 如果 HID 完全无响应，可拔插 USB 恢复官方灯效。
- EEPROM Reset、设备绑定清除等功能仍属于持久化操作，请确认后再使用。

## 项目文件

```text
index.html          页面结构
styles.css          界面样式
app.js              WebHID、Web Serial 与编辑器逻辑
PROTOCOL.md         协议说明
CHANGELOG.md        更新日志
start-local.bat     Windows 启动入口
start-local.ps1     本地 HTTP 服务
```

## 已验证结果

- 91/91 灯映射完成
- RGB 红、绿、蓝通道正确，无串色
- 全黑整帧无残留
- COMMIT 原子刷新
- 错误 sequence 不改变物理画面，新 session 可恢复
- EXIT、页面关闭、刷新和重新上电均可恢复官方灯效
- 10 ms 档冷启动立即播放，实际 4 FPS，超周期帧 0

更详细的数据包结构见 [PROTOCOL.md](./PROTOCOL.md)，版本变化见 [CHANGELOG.md](./CHANGELOG.md)。
