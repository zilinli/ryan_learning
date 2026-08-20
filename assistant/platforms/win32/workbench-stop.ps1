# 停止 Bolt Console
$ErrorActionPreference = "SilentlyContinue"
$Dir = Split-Path -Parent $MyInvocation.MyCommand.Path
$pidFile = Join-Path $Dir "workbench.pid"
$stopped = $false

if (Test-Path $pidFile) {
  $pid = Get-Content $pidFile | Select-Object -First 1
  if ($pid) {
    Stop-Process -Id ([int]$pid) -Force -ErrorAction SilentlyContinue
    $stopped = $true
  }
  Remove-Item $pidFile -Force -ErrorAction SilentlyContinue
}

Get-NetTCPConnection -LocalPort 18790 -State Listen -ErrorAction SilentlyContinue | ForEach-Object {
  Stop-Process -Id $_.OwningProcess -Force -ErrorAction SilentlyContinue
  $stopped = $true
}

Get-CimInstance Win32_Process -Filter "Name = 'python.exe' OR Name = 'pythonw.exe'" -ErrorAction SilentlyContinue |
  Where-Object { $_.CommandLine -match 'server\.py' -and $_.CommandLine -match 'openclaw-workbench|workbench' } |
  ForEach-Object {
    Stop-Process -Id $_.ProcessId -Force -ErrorAction SilentlyContinue
    $stopped = $true
  }

if ($stopped) {
  Start-Sleep -Seconds 1
  Write-Host "Bolt Console 已停止"
} else {
  Write-Host "Bolt Console 未在运行"
}
