# Connectors Basic（Windows）

```powershell
curl.exe -sk "https://wttr.in/?format=%l:+%c+%t+%w+%h"
$year = Get-Date -Format yyyy
curl.exe -sk "https://raw.githubusercontent.com/NateScarlet/holiday-cn/master/$year.json"
```

- 优先 `curl.exe`（Windows 10+）；没有则用 `Invoke-RestMethod`。
- 产物目录：`$env:USERPROFILE\tasks\`
