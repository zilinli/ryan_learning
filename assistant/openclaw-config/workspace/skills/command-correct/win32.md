# Command Correct（Windows）

## 前置

```powershell
Get-Command thefuck -ErrorAction SilentlyContinue
# 可选: pip install thefuck
```

辅助脚本：`%USERPROFILE%\.openclaw\workspace\skills\command-correct\suggest.py`

## 收集失败命令

1. 用户粘贴的命令 + 报错
2. 本会话上一轮 shell 失败输出
3. PSReadLine 历史（只读）：

```powershell
Get-Content (Get-PSReadLineOption).HistorySavePath -Tail 30
```

## 调用建议

```powershell
$py = "$env:USERPROFILE\.openclaw\venv\Scripts\python.exe"
& $py "$env:USERPROFILE\.openclaw\workspace\skills\command-correct\suggest.py" `
  --script '失败的命令' --output '报错全文'
```

微信侧：先展示建议，用户回「跑 / yeah」再执行。高风险（删文件、force push）再确认；删文件优先回收站：

```powershell
# 移到回收站示例
Add-Type -AssemblyName Microsoft.VisualBasic
[Microsoft.VisualBasic.FileIO.FileSystem]::DeleteFile($path,'OnlyErrorDialogs','SendToRecycleBin')
```
