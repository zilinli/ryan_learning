#!/usr/bin/env bash
# Spark one-click OpenClaw install + pair back to spark-tutor (macOS).
# Installs full unified assistant (skills, workbench, WeChat) from assistant/ module.
# Usage (run each line separately — avoid piping curl|bash from the browser):
#   export SPARK_PAIR_CODE=XXXXXXXX
#   export SPARK_URL=https://spark-tutor-for-ryan.duckdns.org
#   export SPARK_INSECURE=1
#   curl -kfsSL "$SPARK_URL/install/macos.sh" -o /tmp/spark-install.sh && bash /tmp/spark-install.sh
# Stock macOS curl often fails Let's Encrypt verify; -k / SPARK_INSECURE=1 is the
# recommended path. Strict SSL: omit SPARK_INSECURE and use plain curl -fsSL.
set -euo pipefail

SPARK_URL="${SPARK_URL%/}"
SPARK_URL="${SPARK_URL:-https://spark-tutor-for-ryan.duckdns.org}"
PAIR_CODE="${SPARK_PAIR_CODE:-}"
# Default to insecure on Darwin when unset — old system curl CA stores break deploy.
if [[ -z "${SPARK_INSECURE+x}" ]] && [[ "$(uname -s)" == "Darwin" ]]; then
  SPARK_INSECURE=1
fi
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
if [[ -f "$ENV_FILE" ]]; then
  cp "$ENV_FILE" "${ENV_FILE}.bak.$(date +%Y%m%d%H%M%S)"
  echo "Backed up existing $ENV_FILE"
fi
# Keep any non-empty local key when the ticket leaves a field blank.
merge_env_key() {
  local name="$1" ticket_val="$2" prev=""
  if [[ -f "$ENV_FILE" ]]; then
    prev="$(python3 - "$ENV_FILE" "$name" <<'PY'
import sys
path, name = sys.argv[1], sys.argv[2]
try:
    for line in open(path, encoding="utf-8"):
        line = line.strip()
        if not line or line.startswith("#") or "=" not in line:
            continue
        k, v = line.split("=", 1)
        if k.strip() != name:
            continue
        v = v.strip()
        if (v.startswith("'") and v.endswith("'")) or (v.startswith('"') and v.endswith('"')):
            v = v[1:-1]
        print(v)
        break
except FileNotFoundError:
    pass
PY
)"
  fi
  if [[ -n "$ticket_val" ]]; then
    printf '%s' "$ticket_val"
  else
    printf '%s' "$prev"
  fi
}
DEEPSEEK_API_KEY="$(merge_env_key DEEPSEEK_API_KEY "${DEEPSEEK_API_KEY}")"
DASHSCOPE_API_KEY="$(merge_env_key DASHSCOPE_API_KEY "${DASHSCOPE_API_KEY}")"
CURSOR_API_KEY="$(merge_env_key CURSOR_API_KEY "${CURSOR_API_KEY}")"
DEAPI_API_KEY="$(merge_env_key DEAPI_API_KEY "${DEAPI_API_KEY}")"
cat > "$ENV_FILE" <<EOF
DEEPSEEK_API_KEY='${DEEPSEEK_API_KEY}'
DASHSCOPE_API_KEY='${DASHSCOPE_API_KEY}'
CURSOR_API_KEY='${CURSOR_API_KEY}'
DEAPI_API_KEY='${DEAPI_API_KEY}'
EOF
chmod 600 "$ENV_FILE"
echo "Wrote $ENV_FILE"

if command -v openclaw >/dev/null 2>&1; then
  echo "OpenClaw CLI already present: $(openclaw --version 2>/dev/null || true)"
else
  echo "Installing OpenClaw CLI..."
  npm install -g openclaw@latest
fi

CFG="${CONFIG_DST}/openclaw.json"
echo "Installing full OpenClaw assistant workspace..."
ASSIST_TMP="$(mktemp -d)"
spark_download "$SPARK_URL/install/assistant.tar.gz" "/tmp/spark-assistant.tar.gz"
tar xzf /tmp/spark-assistant.tar.gz -C "$ASSIST_TMP"
node "${ASSIST_TMP}/assistant/install.mjs"
rm -rf "$ASSIST_TMP" /tmp/spark-assistant.tar.gz

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

echo "Installing Spark Bridge watchdog..."
spark_download "$SPARK_URL/install/spark-bridge-watchdog.sh" "${BRIDGE_DIR}/watchdog.sh"
chmod +x "${BRIDGE_DIR}/watchdog.sh"
WATCH_PLIST="${LAUNCH_DIR}/org.spark.bridge.watchdog.plist"
cat > "$WATCH_PLIST" <<EOF
<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
  <key>Label</key>
  <string>org.spark.bridge.watchdog</string>
  <key>ProgramArguments</key>
  <array>
    <string>/bin/bash</string>
    <string>${BRIDGE_DIR}/watchdog.sh</string>
  </array>
  <key>StartInterval</key>
  <integer>60</integer>
  <key>RunAtLoad</key>
  <true/>
  <key>StandardOutPath</key>
  <string>${BRIDGE_DIR}/watchdog.out</string>
  <key>StandardErrorPath</key>
  <string>${BRIDGE_DIR}/watchdog.err</string>
  <key>EnvironmentVariables</key>
  <dict>
    <key>HOME</key>
    <string>${HOME_DIR}</string>
    <key>PATH</key>
    <string>/usr/local/bin:/opt/homebrew/bin:/usr/bin:/bin</string>
  </dict>
</dict>
</plist>
EOF
launchctl unload "$WATCH_PLIST" 2>/dev/null || true
launchctl load "$WATCH_PLIST"
launchctl start org.spark.bridge.watchdog || true

echo "Spark Bridge started. Open ${SPARK_URL}/deploy — node should go online."
echo "Then chat at ${SPARK_URL}/control"
