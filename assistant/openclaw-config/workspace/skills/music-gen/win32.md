# Music Gen（deAPI 文生曲 · Windows）

用户要的是**可播放的 mp3**。按 `task-deliver` 落盘交付。

## 前置

```powershell
# 从 .env 加载 DEAPI_API_KEY（含 | 必须用单引号写在 .env 里）
$envFile = "$env:USERPROFILE\.openclaw\.env"
Get-Content $envFile | ForEach-Object {
  if ($_ -match '^\s*#' -or $_ -notmatch '=') { return }
  $k,$v = $_.Split('=',2)
  Set-Item -Path "Env:$($k.Trim())" -Value ($v.Trim().Trim("'").Trim('"'))
}
$env:DEAPI_API_KEY.Substring(0, [Math]::Min(6, $env:DEAPI_API_KEY.Length))
```

脚本：`%USERPROFILE%\.openclaw\workspace\skills\music-gen\generate_music.py`

## 用法

```powershell
$py = "$env:USERPROFILE\.openclaw\venv\Scripts\python.exe"
$task = Join-Path $env:USERPROFILE ("tasks\{0}-song" -f (Get-Date -Format yyyy-MM-dd))
New-Item -ItemType Directory -Force -Path $task | Out-Null
& $py "$env:USERPROFILE\.openclaw\workspace\skills\music-gen\generate_music.py" `
  --caption "flamenco Spanish World Cup anthem, passionate male vocal, guitar" `
  --lyrics "¡Viva la Roja!" `
  --vocal-language es `
  --duration 30 `
  --out "$task\song.mp3"
```

验证：`powershell -File D:\codes\ai_assistant_win\scripts\verify-deapi.ps1`
