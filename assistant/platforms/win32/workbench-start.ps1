# Start Bolt Console (default port 18790)
param([int]$Port = 18790)
$ErrorActionPreference = "Stop"
$Dir = Split-Path -Parent $MyInvocation.MyCommand.Path
$env:BOLT_PORT = "$Port"

function Test-PortListen([int]$p) {
  try {
    $c = Get-NetTCPConnection -LocalPort $p -State Listen -ErrorAction SilentlyContinue
    return $null -ne $c
  } catch {
    return $false
  }
}

if (Test-PortListen $Port) {
  Write-Host "Bolt Console already running: http://127.0.0.1:$Port"
  Start-Process "http://127.0.0.1:$Port"
  exit 0
}

$py = Join-Path $env:USERPROFILE ".openclaw\venv\Scripts\python.exe"
if (-not (Test-Path $py)) {
  $cmd = Get-Command python -ErrorAction SilentlyContinue
  if ($cmd) { $py = $cmd.Source } else { $py = "python" }
}

$log = Join-Path $Dir "workbench.log"
$pidFile = Join-Path $Dir "workbench.pid"
Set-Location $Dir

# Start-Process cannot redirect stdout+stderr to the same file; use cmd redirection
$arg = "/c `"\`"$py\`" server.py >> \`"$log\`" 2>&1`""
$proc = Start-Process -FilePath "cmd.exe" -ArgumentList $arg -WorkingDirectory $Dir -WindowStyle Hidden -PassThru
$proc.Id | Set-Content $pidFile

Start-Sleep -Seconds 2
if (Test-PortListen $Port) {
  Write-Host "Bolt Console started: http://127.0.0.1:$Port"
  Start-Process "http://127.0.0.1:$Port"
} else {
  Write-Host "Start failed, see log: $log"
  if (Test-Path $log) { Get-Content $log -Tail 20 }
  exit 1
}
