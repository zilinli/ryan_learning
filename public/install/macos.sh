#!/usr/bin/env bash
# Spark one-click OpenClaw install + pair back to spark-tutor (macOS).
#
# Layout reference (not integrated): zilinli/ai_assistant_mac uses ~/.openclaw,
# .env, gateway, LaunchAgent. That repo has backup/USAGE only — no install.sh.
# This script does NOT git clone that repo and does NOT copy openclaw-config,
# skills, Bolt Console, WeChat, or ~/openclaw-workbench. Pairing + Bridge only.
#
# Usage (run each line separately — avoid one-line paste from the browser):
#   export SPARK_PAIR_CODE=XXXXXXXX
#   export SPARK_URL=https://spark-tutor-for-ryan.duckdns.org
#   curl -fsSL "$SPARK_URL/install/macos.sh" -o /tmp/spark-install.sh && bash /tmp/spark-install.sh
# If curl reports "SSL certificate problem", try Homebrew curl (`brew install curl`) or:
#   export SPARK_INSECURE=1
#   curl -kfsSL "$SPARK_URL/install/macos.sh" -o /tmp/spark-install.sh && bash /tmp/spark-install.sh
set -euo pipefail

SPARK_URL="${SPARK_URL%/}"
SPARK_URL="${SPARK_URL:-https://spark-tutor-for-ryan.duckdns.org}"
PAIR_CODE="${SPARK_PAIR_CODE:-}"
CURL_EXTRA=()
if [[ "${SPARK_INSECURE:-}" == "1" ]]; then
  CURL_EXTRA=(-k)
fi

spark_curl() {
  local err
  if err="$(curl "${CURL_EXTRA[@]}" -fsS "$@" 2>&1)"; then
    printf '%s' "$err"
    return 0
  fi
  if [[ "${SPARK_INSECURE:-}" != "1" ]] && [[ "$err" == *"certificate"* || "$err" == *"SSL"* ]]; then
    echo "Warning: HTTPS verify failed — retrying with curl -k (set SPARK_INSECURE=1 to skip this message)." >&2
    curl -kfsS "$@"
    return $?
  fi
  echo "$err" >&2
  return 1
}

spark_download() {
  local url="$1" dest="$2"
  if curl "${CURL_EXTRA[@]}" -fsSL "$url" -o "$dest"; then
    return 0
  fi
  if [[ "${SPARK_INSECURE:-}" != "1" ]]; then
    echo "Warning: HTTPS verify failed — retrying download with curl -k." >&2
    curl -kfsSL "$url" -o "$dest"
    return $?
  fi
  return 1
}
if [[ -z "$PAIR_CODE" ]]; then
  echo "Set SPARK_PAIR_CODE first (from ${SPARK_URL}/deploy )" >&2
  exit 1
fi

echo "Spark URL: $SPARK_URL"
echo "Pair code: $PAIR_CODE"

if ! command -v node >/dev/null 2>&1 || ! command -v npm >/dev/null 2>&1; then
  echo "Node.js/npm not found. Install Node 22+ from https://nodejs.org then re-run." >&2
  exit 1
fi
if ! command -v python3 >/dev/null 2>&1; then
  echo "python3 is required to parse the install ticket." >&2
  exit 1
fi

TICKET_JSON="$(
  spark_curl -X POST "$SPARK_URL/api/nodes/install-ticket" \
    -H "content-type: application/json" \
    -d "{\"pairCode\":\"$PAIR_CODE\"}"
)"

eval "$(
  python3 - "$TICKET_JSON" <<'PY'
import json, os, shlex, sys
ticket = json.loads(sys.argv[1])
keys = ticket.get("keys") or {}
if not keys:
    raise SystemExit("install ticket returned no keys")
for name in ("DEEPSEEK_API_KEY", "DASHSCOPE_API_KEY", "CURSOR_API_KEY", "DEAPI_API_KEY"):
    print(f"export {name}={shlex.quote(str(keys.get(name) or ''))}")
PY
)"

HOME_DIR="${HOME}"
CONFIG_DST="${HOME_DIR}/.openclaw"
BRIDGE_DIR="${CONFIG_DST}/bridge"
mkdir -p "${CONFIG_DST}/workspace" "${CONFIG_DST}/cursor" "${BRIDGE_DIR}" "${HOME_DIR}/tasks"

ENV_FILE="${CONFIG_DST}/.env"
cat > "$ENV_FILE" <<EOF
DEEPSEEK_API_KEY='${DEEPSEEK_API_KEY}'
DASHSCOPE_API_KEY='${DASHSCOPE_API_KEY}'
CURSOR_API_KEY='${CURSOR_API_KEY}'
DEAPI_API_KEY='${DEAPI_API_KEY}'
EOF
chmod 600 "$ENV_FILE"
echo "Wrote $ENV_FILE"

echo "Installing OpenClaw CLI..."
npm install -g openclaw@latest

CFG="${CONFIG_DST}/openclaw.json"
if [[ ! -f "$CFG" ]]; then
  WS="${CONFIG_DST}/workspace"
  GW_TOKEN="$(uuidgen | tr 'A-F' 'a-f' | tr -d '-')"
  python3 - "$CFG" "$WS" "$GW_TOKEN" <<'PY'
import json, sys
cfg_path, ws, token = sys.argv[1], sys.argv[2], sys.argv[3]
cfg = {
  "agents": {
    "defaults": {
      "workspace": ws,
      "model": {"primary": "deepseek/deepseek-v4-flash", "fallbacks": ["qwen/qwen3.5-plus"]},
    },
    "list": [{"id": "main"}],
  },
  "gateway": {"mode": "local", "port": 18789, "bind": "loopback", "auth": {"mode": "token", "token": token}},
  "plugins": {
    "entries": {
      "deepseek": {"enabled": True},
      "qwen": {"enabled": True},
      "openclaw-weixin": {"enabled": False},
    },
    "allow": ["deepseek", "qwen"],
  },
  "models": {
    "mode": "merge",
    "providers": {
      "deepseek": {
        "baseUrl": "https://api.deepseek.com",
        "api": "openai-completions",
        "models": [{"id": "deepseek-v4-flash", "name": "DeepSeek V4 Flash"}],
      },
      "qwen": {
        "baseUrl": "https://dashscope.aliyuncs.com/compatible-mode/v1",
        "api": "openai-completions",
        "apiKey": "${DASHSCOPE_API_KEY}",
        "models": [{"id": "qwen3.5-plus", "name": "Qwen3.5 Plus"}],
      },
    },
  },
}
with open(cfg_path, "w", encoding="utf-8") as f:
    json.dump(cfg, f, indent=2)
PY
fi

echo "Installing model plugins (no WeChat)..."
openclaw plugins install @openclaw/deepseek-provider || true
openclaw plugins install @openclaw/qwen-provider || true

echo "Gateway install..."
openclaw gateway install || true
openclaw gateway restart || openclaw gateway start || true

echo "Downloading Spark Bridge..."
spark_download "$SPARK_URL/install/spark-bridge.mjs" "${BRIDGE_DIR}/index.mjs"
NODE_BIN="$(command -v node)"

LAUNCH_DIR="${HOME_DIR}/Library/LaunchAgents"
mkdir -p "$LAUNCH_DIR"
PLIST="${LAUNCH_DIR}/org.spark.bridge.plist"
cat > "$PLIST" <<EOF
<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
  <key>Label</key>
  <string>org.spark.bridge</string>
  <key>WorkingDirectory</key>
  <string>${BRIDGE_DIR}</string>
  <key>ProgramArguments</key>
  <array>
    <string>${NODE_BIN}</string>
    <string>${BRIDGE_DIR}/index.mjs</string>
  </array>
  <key>EnvironmentVariables</key>
  <dict>
    <key>SPARK_URL</key>
    <string>${SPARK_URL}</string>
    <key>SPARK_PAIR_CODE</key>
    <string>${PAIR_CODE}</string>
    <key>HOME</key>
    <string>${HOME_DIR}</string>
    <key>DEEPSEEK_API_KEY</key>
    <string>${DEEPSEEK_API_KEY}</string>
    <key>DASHSCOPE_API_KEY</key>
    <string>${DASHSCOPE_API_KEY}</string>
    <key>CURSOR_API_KEY</key>
    <string>${CURSOR_API_KEY}</string>
    <key>DEAPI_API_KEY</key>
    <string>${DEAPI_API_KEY}</string>
    <key>PATH</key>
    <string>/usr/local/bin:/opt/homebrew/bin:/usr/bin:/bin</string>
  </dict>
  <key>RunAtLoad</key>
  <true/>
  <key>KeepAlive</key>
  <true/>
  <key>StandardOutPath</key>
  <string>${BRIDGE_DIR}/bridge.log</string>
  <key>StandardErrorPath</key>
  <string>${BRIDGE_DIR}/bridge.err</string>
</dict>
</plist>
EOF

launchctl unload "$PLIST" 2>/dev/null || true
launchctl load "$PLIST"
launchctl start org.spark.bridge || true

echo "Spark Bridge started. Open ${SPARK_URL}/deploy — node should go online."
echo "Then chat at ${SPARK_URL}/control"
