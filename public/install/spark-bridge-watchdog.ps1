# Spark Bridge watchdog (Windows) — restart scheduled task / process if missing or health stale.
# Installed as a per-minute Scheduled Task by windows.ps1.
$ErrorActionPreference = "Continue"
$BridgeDir = Join-Path $env:USERPROFILE ".openclaw\bridge"
$Health = Join-Path $BridgeDir "health.json"
$Log = Join-Path $BridgeDir "watchdog.log"
$StartCmd = Join-Path $BridgeDir "start.cmd"
$StaleSec = 120
if ($env:SPARK_BRIDGE_HEALTH_STALE_SEC) {
  [int]::TryParse($env:SPARK_BRIDGE_HEALTH_STALE_SEC, [ref]$StaleSec) | Out-Null
}
New-Item -ItemType Directory -Force -Path $BridgeDir | Out-Null

function Write-Log([string]$msg) {
  $line = "[{0}] {1}" -f ([DateTime]::UtcNow.ToString("o")), $msg
  Add-Content -Path $Log -Value $line -Encoding UTF8
}

function Test-BridgeRunning {
  $procs = Get-CimInstance Win32_Process -ErrorAction SilentlyContinue |
    Where-Object { $_.CommandLine -and $_.CommandLine -like "*$BridgeDir*index.mjs*" }
  return [bool]$procs
}

function Test-HealthStale {
  if (-not (Test-Path $Health)) { return $false }
  try {
    $j = Get-Content -Raw -Path $Health | ConvertFrom-Json
    $tsMs = [int64]$j.ts
    $age = [int](([DateTimeOffset]::UtcNow.ToUnixTimeMilliseconds() - $tsMs) / 1000)
    if ($age -gt $StaleSec) {
      Write-Log "health stale age=${age}s (limit ${StaleSec}s)"
      return $true
    }
  } catch {
    Write-Log "health parse error: $_"
  }
  return $false
}

function Restart-Bridge {
  Write-Log "restarting SparkBridge"
  Get-CimInstance Win32_Process -ErrorAction SilentlyContinue |
    Where-Object { $_.CommandLine -and $_.CommandLine -like "*$BridgeDir*index.mjs*" } |
    ForEach-Object {
      try { Stop-Process -Id $_.ProcessId -Force -ErrorAction SilentlyContinue } catch {}
    }
  if (Test-Path $StartCmd) {
    Start-Process -FilePath "cmd.exe" -ArgumentList "/c `"$StartCmd`"" -WindowStyle Hidden
  } else {
    schtasks /Run /TN "SparkBridge" 2>$null | Out-Null
  }
}

$need = $false
if (-not (Test-BridgeRunning)) {
  Write-Log "bridge process missing"
  $need = $true
} elseif (Test-HealthStale) {
  $need = $true
}

if ($need) {
  Restart-Bridge
}
