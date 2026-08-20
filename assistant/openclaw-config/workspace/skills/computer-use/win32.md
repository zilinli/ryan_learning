# Computer Use（Windows GUI 操控）

在 shell 基础上补上"指哪打哪"的 GUI 操作能力。成功率低于 macOS cliclick 方案，目标不明确时先截图再操作，危险操作必须二次确认。

## 前置条件

```powershell
$py = "$env:USERPROFILE\.openclaw\venv\Scripts\python.exe"
& $py -c "import pyautogui; print(pyautogui.size())"
```

若缺依赖：`& $py -m pip install pyautogui pillow`

## 常用操作（PowerShell）

```powershell
# 打开应用
Start-Process chrome
Start-Process notepad
Start-Process explorer

# 截图（.NET）
Add-Type -AssemblyName System.Windows.Forms,System.Drawing
$bounds = [System.Windows.Forms.Screen]::PrimaryScreen.Bounds
$bmp = New-Object System.Drawing.Bitmap $bounds.Width, $bounds.Height
$g = [System.Drawing.Graphics]::FromImage($bmp)
$g.CopyFromScreen($bounds.Location, [System.Drawing.Point]::Empty, $bounds.Size)
$out = "$env:TEMP\screen.png"
$bmp.Save($out, [System.Drawing.Imaging.ImageFormat]::Png)
$g.Dispose(); $bmp.Dispose()
Write-Output $out
```

## pyautogui（推荐精确点击）

```powershell
$py = "$env:USERPROFILE\.openclaw\venv\Scripts\python.exe"
& $py - <<'PY'
import pyautogui
pyautogui.FAILSAFE = True
print(pyautogui.position())          # 当前鼠标
pyautogui.moveTo(1000, 600, duration=0.2)
pyautogui.click()
pyautogui.doubleClick(500, 500)
pyautogui.rightClick(500, 500)
pyautogui.scroll(-500)               # 向下滚
pyautogui.write("hello", interval=0.05)
pyautogui.hotkey("ctrl", "l")
PY
```

> 注意：Windows PowerShell here-doc 可能不可用时，把脚本写到 `%TEMP%\gui_action.py` 再执行。

## 定位坐标策略

1. 先截图到 `%TEMP%\screen.png`，用读图（qwen 系支持图片）判断目标。
2. 拿不准不盲点：先截图分析或问用户。
3. 每次点击后截图确认。

## 规则

- 危险操作（删除、提交、支付、发送）执行前必须二次确认。
- 点击目标不明确时不盲点。
- DPI 缩放可能导致坐标偏移，以 `pyautogui.position()` / 实测校准。
- 失败率高时诚实告知用户建议手动操作。

## 兜底

- pyautogui 不可用：退回 `Start-Process` + 键盘快捷键说明，或请用户手动。
