# File Organizer（Windows）

- 桌面：`[Environment]::GetFolderPath('Desktop')`；下载：`Downloads`
- 回收站操作用 `Shell.Application` 或先移到 quarantine 目录。
- 路径含空格时用引号；优先 PowerShell `Move-Item`。
