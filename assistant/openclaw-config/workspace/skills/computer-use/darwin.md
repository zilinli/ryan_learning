# Computer Use（GUI 操控增强）

在 shell/AppleScript 基础上补上"指哪打哪"的 GUI 操作能力。**必须开启辅助功能权限**（系统设置 → 隐私与安全性 → 辅助功能，勾选运行终端/OpenClaw 的进程）。

## 前置条件

```bash
ls /Users/chingching/bin/cliclick 2>/dev/null || echo "缺 cliclick（已装到 ~/bin）"
/Users/chingching/bin/cliclick p 2>&1 | head -1   # 测试：打印当前鼠标位置
```

cliclick 安装在 `/Users/chingching/bin/cliclick`（不用 brew）。若报 Accessibility 未开启，说明需要用户去系统设置授权。

## 常用操作

```bash
CL=/Users/chingching/bin/cliclick

# 获取鼠标当前位置（x,y）
$CL p

# 移动鼠标并点击（绝对坐标）
$CL c:1000,600

# 拖拽（从 A 到 B）
$CL dd:100,100 du:400,400

# 打字（直接输入文本）
$CL t:hello world

# 滚动（滚轮，向下为正）
$CL w:10

# 双击 / 右键
$CL dc:500,500    # double click
$CL rc:500,500    # right click
```

## 结合 osascript 做应用级操作

```bash
# 激活应用
open -a Safari
osascript -e 'tell application "Safari" to activate'

# 键盘操作（cmd+L 聚焦地址栏等）
osascript -e 'tell application "System Events" to keystroke "l" using command down'
osascript -e 'tell application "System Events" to key code 36'   # Return

# 截图
screencapture -x /tmp/screen.png
```

## 定位坐标的策略

1. 先 `screencapture -x 屏幕.png`，用 `open 屏幕.png` 或读图（若模型支持视觉）判断目标位置。
2. 拿不准坐标时：先截图 → 把图片路径交给模型分析（qwen 系支持图片输入）→ 换算坐标 → `cliclick c:x,y`。
3. 每次点击后截图确认结果，再决定下一步（"截图确认"循环）。

## 规则

- 危险操作（删除、提交、支付、发送）执行前必须二次确认，微信场景尤其严格。
- 点击目标不明确时不盲点：先截图分析，或问用户。
- 本机窗口坐标受 Retina 缩放影响，截图分辨率与逻辑坐标可能不同——以 `cliclick p` 实测校准。
- 每次操作序列结束，给用户截图/结果说明。

## 兜底

- cliclick 不可用（无辅助功能权限）：退回 osascript System Events 的 UI 元素 `click` 方式，或说明无法自动操控。
- GUI 自动化失败率高时，诚实告知用户建议手动操作，不要反复盲试。
