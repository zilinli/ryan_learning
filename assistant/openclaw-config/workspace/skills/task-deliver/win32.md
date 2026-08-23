# Task Deliver（Windows）

```powershell
$TaskDir = Join-Path $env:USERPROFILE ("tasks\{0}-{1}" -f (Get-Date -Format 'yyyy-MM-dd'), '<短名>')
New-Item -ItemType Directory -Force -Path $TaskDir | Out-Null
```

- 回传路径用完整 Windows 路径。
