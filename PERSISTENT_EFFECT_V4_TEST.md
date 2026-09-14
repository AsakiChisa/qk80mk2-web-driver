# QK80 MK2 自定义灯效本地持久化 V4 离线报告

生成日期：2026-09-14  
状态：离线构建完成；已通过 QK 官方驱动刷入，持久保存功能首次实机验收正常

## 目标与范围

V4 让用户把“选中按键的呼吸灯或双色流动渐变”保存到 PLC，使网页关闭或键盘断电重启后仍由键盘本地播放。它不尝试把任意多帧动画完整存入键盘，也不修改 Master。

## 实现结果

- 新增 PLC 私有操作 `op=5 SAVE_EFFECT` 和 `op=6 CLEAR_EFFECT`，继续沿用 `0x5A`、28-byte v2 payload 和 CRC-8/ATM。
- 保存内容共 20 bytes：91-bit 物理灯掩码、颜色 A、颜色 B、效果/方向/最低亮度 flags、周期代码。
- 配置写入 `0x080FD800` 的独立 2 KiB Flash 页，记录实际占 24 bytes。
- 动画由 PLC 本地约每 32 ms 更新一次，即约 31.25 FPS；运行过程只读配置，不擦写 Flash。
- V4 本地引擎只使用 phase `4–11`；V2 整帧接管的 `session << 4` 和 V3 的 `0xFF` 均落在 `>=12` 的暂停区，EXIT 后自动恢复已保存效果。
- Backspace 45/46/47、Enter 60/63、反斜杠 61/62、左 Shift 64/65/66、Space 82/83、右 Alt 84/85 在空间渐变中使用同一相位。
- 网页新增“保存到键盘（断电保留）”与“清除键盘本地灯效”，并内置 V4 PLC 候选 UF2。

## 关键地址

| 用途 | 地址 | 状态 |
|---|---:|---|
| PLC `0x5A` handler / code cave | `0x080B6300` | 已确认 |
| V4 扩展入口 | `0x080B6490` | 已分配并检查边界 |
| V4 本地效果引擎 | `0x080B6540` | 已分配并检查边界 |
| 调度器 hook | `0x0801763A` | 原 6 bytes 已精确校验 |
| Bank-1 Flash helper cave | `0x08044D46` | 原区域全零，114/130 bytes |
| 官方 Flash unlock | `0x08041104` | 已确认 |
| 官方 page erase | `0x08041120` | 已确认 |
| Bank-2 wait/status | `0x080410D8` | 已确认 |
| LED RGB setter | `0x0801847C` | 已实机间接验证 |
| LED flush | `0x080188B4` | 已实机间接验证 |
| tick getter | `0x080195E4` | 静态确认 |
| RGB phase byte | `0x20000329` | 已确认 |
| V4 配置页 | `0x080FD800` | 原应用无直接地址引用；仍待实机验证 |

## Flash 安全设计

配置记录为 `20-byte data + 4-byte marker/checksum`。保存顺序为：

1. 解锁 Flash。
2. 擦除专用页。
3. 依次写入五个数据 word。
4. 最后写入 `QKP + XOR-8` 有效标记。

启动/调度时只有在低 24-bit 标记、XOR、mask 高位、flags 保留位及周期代码全部有效时才运行本地效果。写入中途断电时，由于最后标记尚未写入，半条记录不会被识别为有效配置。

早期方案曾考虑 `0x080FE000`，后续检查发现官方应用确实引用并使用从该地址开始的末尾配置区，因此已经弃用。最终候选迁移到紧邻其下方的 `0x080FD800`；生成脚本和测试会阻止再次使用官方四页区域 `0x080FE000–0x080FFFFF`。

## 已通过的离线检查

- 输入 V3 UF2 精确 SHA-256 校验。
- UF2 魔数、Family ID、块序号、地址连续性、payload 大小和非 payload 字节零改动。
- handler/engine 占用 1180/1280 bytes，Flash helper 占用 114/130 bytes，无代码洞越界。
- scheduler hook 目标、Flash helper 调用、LED setter、flush、tick、phase 和共享状态地址检查。
- 20-byte 配置编码、24-byte记录、XOR/marker、非法 mask/flags/period 拒绝模型。
- 官方应用映像中不存在 `0x080FD800` 直接地址常量；官方四个末尾配置页均被识别为已占用。
- 网页 JavaScript 语法、按钮 ID 唯一性、V4 操作码、payload 布局、CRC 模型、内置 UF2 大小和哈希一致性。

候选 UF2 SHA-256：

```text
1E255F8EB54DED15BCF62A5E469DBAFE93AE9EE5ABE49E9349416B4174623C3E
```

## 已确认、推断与未知

### 已确认

- V2 整帧、V3 MASK_COLOR、91 灯映射、30 FPS 单键/宽键效果和 EXIT 恢复已经过此前实机测试。
- V4 生成结果只改变清单声明的 UF2 payload 字节。
- 官方应用明确使用 `0x080FE000–0x080FFFFF` 区域，因此 V4 不再占用该区域。
- V4 只在 SAVE/CLEAR 命令中执行 Flash 擦写。

### 高可信推断

- `0x080FD800` 属于同一 Bank-2、2 KiB 页结构，官方 erase/wait 路径可用于该页。
- 调度器 hook 可在上电后读取有效记录并进入本地效果模式。
- `4–11` 本地状态区、`>=12` 网页接管暂停区和 EXIT 恢复可避免网页播放器与本地引擎争抢灯光。

### 仍未知 / 建议继续观察

- Bootloader 或未包含在应用 bin 中的代码是否会占用、清理或保护 `0x080FD800`。
- 首次 SAVE/CLEAR 的实际 Flash 返回状态与耗时。
- 断电重启后的首次渲染时序，以及未选中灯在启动瞬间冻结的具体画面。
- 长时间运行时约 31 FPS 的稳定性、键盘扫描延迟和无线模式表现。
- 官方固件升级对专用页是保留还是擦除；官方固件本身不会读取 V4 标记，但恢复流程仍需实测。

## 建议的最小实机验收顺序

1. 保留官方 PLC UF2，并确认能够进入 PLC 引导盘。
2. 只刷 V4 PLC；Master 保持现有 V2。首次启动先不要点击保存，验证打字、官方灯效、屏幕/点阵等基础功能。
3. 在网页中只选择 Esc，设置暗红色呼吸、4 秒周期、最低亮度 10%，点击保存；保存期间不要断电。
4. 验证只有 Esc 呼吸、动画顺滑、输入正常，然后关闭网页；观察至少 30 秒。
5. 拔线 10 秒后重新插入，验证 Esc 呼吸自动恢复。
6. 重新连接网页并播放一个不同的 RAM 顺滑效果，确认本地效果暂停；点击 EXIT，确认已保存的 Esc 呼吸恢复。
7. 点击“清除键盘本地灯效”，确认官方灯效恢复；断电重启后确认自定义效果不再出现。
8. 再测试 Backspace 45/46/47 的双色渐变同步，以及 1.5/2.5/4/6 秒四种周期。

任一步出现键盘无输入、反复重启、灯效异常抢占、无法清除或引导盘异常，应停止后续测试并刷回 Qwertykeys 官方 PLC 固件：<https://www.qwertykeys.com/pages/fw>。

## 交付文件

- `QK80MK2_PLC_v1.1.1_PERSISTENT_EFFECT_V4_UNFLASHED_CANDIDATE.uf2`
- `QK80-MK2-persistent-effect-v4-generated-verification.json`
- `work/build_v4_persistent.py`
- `work/test_v4_persistent.py`
- `work/test_web_v4_persistent.mjs`
- `work/inputs/web/` 更新后的网页驱动
