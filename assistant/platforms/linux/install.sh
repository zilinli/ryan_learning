#!/usr/bin/env bash
# Linux extras for Spark assistant (VPS / headless). Gateway optional.
set -euo pipefail
echo "[assistant/linux] extras: ensure openclaw on PATH if installed globally"
if command -v openclaw >/dev/null 2>&1; then
  openclaw gateway install 2>/dev/null || true
  openclaw gateway start 2>/dev/null || true
fi
echo "[assistant/linux] done"
