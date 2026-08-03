#!/usr/bin/env bash
set -euo pipefail
cd "$(dirname "$0")"

# Symlink node_modules to parent to share @cursor/sdk
PARENT_NM="../node_modules"
if [[ -d "$PARENT_NM" ]] && [[ ! -e node_modules ]]; then
  echo "[ACC] Linking parent node_modules..."
  ln -s "$PARENT_NM" node_modules
fi

# Load CURSOR_API_KEY from parent .env.local if not already set
if [[ -z "${CURSOR_API_KEY:-}" ]] && [[ -f "../.env.local" ]]; then
  echo "[ACC] Loading API key from parent .env.local..."
  export "$(grep CURSOR_API_KEY ../.env.local | head -1)"
fi

mkdir -p logs data/conversations

export ACC_PORT="${ACC_PORT:-3001}"

echo "[ACC] Starting Agent Chat Console → http://0.0.0.0:${ACC_PORT}"
exec npx next dev -H 0.0.0.0 -p "${ACC_PORT}"
