#!/usr/bin/env bash
# Platform extras for macOS after assistant/install.mjs syncs config.
set -euo pipefail

CONFIG_DST="${HOME}/.openclaw"
CURSOR_DST="${CONFIG_DST}/cursor"

echo "[darwin] Python venv + deps..."
VENV_DIR="${CONFIG_DST}/venv"
VENV_PY="${VENV_DIR}/bin/python3"
if command -v python3 >/dev/null 2>&1; then
  if [[ ! -x "$VENV_PY" ]]; then
    python3 -m venv "$VENV_DIR"
  fi
  "$VENV_PY" -m pip install --upgrade pip -q
  "$VENV_PY" -m pip install -q pandas matplotlib python-pptx pypandoc pyobjc-framework-quartz pyobjc-framework-cocoa 2>/dev/null || \
    "$VENV_PY" -m pip install -q pandas matplotlib python-pptx pypandoc 2>/dev/null || true
else
  echo "  python3 not found; skip venv"
fi

echo "[darwin] Cursor npm deps..."
if command -v npm >/dev/null 2>&1 && [[ -d "$CURSOR_DST" ]]; then
  (cd "$CURSOR_DST" && npm install --silent 2>/dev/null || npm install)
  npm install -g @modelcontextprotocol/server-filesystem 2>/dev/null || true
fi

echo "[darwin] OpenClaw plugins..."
if command -v openclaw >/dev/null 2>&1; then
  openclaw plugins install @openclaw/deepseek-provider 2>/dev/null || true
  openclaw plugins install @openclaw/qwen-provider 2>/dev/null || true
  openclaw plugins install @openclaw/openclaw-weixin 2>/dev/null || true
  openclaw gateway install 2>/dev/null || true
  openclaw gateway restart 2>/dev/null || openclaw gateway start 2>/dev/null || true
fi

echo "[darwin] extras done."
