#!/usr/bin/env bash
# Spark one-click OpenClaw install + pair (Linux VPS / headless).
# Designed to be pasted from iPad Termius/Blink into an SSH session.
# Usage:
#   export SPARK_PAIR_CODE=XXXXXXXX
#   export SPARK_URL=https://spark-tutor-for-ryan.duckdns.org
#   curl -fsSL "$SPARK_URL/install/linux.sh" -o /tmp/spark-install.sh && bash /tmp/spark-install.sh
set -euo pipefail

SPARK_URL="${SPARK_URL%/}"
SPARK_URL="${SPARK_URL:-https://spark-tutor-for-ryan.duckdns.org}"
PAIR_CODE="${SPARK_PAIR_CODE:-}"
CURL_EXTRA=()
if [[ "${SPARK_INSECURE:-}" == "1" ]]; then
  CURL_EXTRA=(-k)
fi

spark_curl() {
  curl "${CURL_EXTRA[@]}" -fsS "$@"
}

spark_download() {
  curl "${CURL_EXTRA[@]}" -fsSL "$1" -o "$2"
}

if [[ -z "$PAIR_CODE" ]]; then
  echo "Set SPARK_PAIR_CODE first (from ${SPARK_URL}/deploy → iPad / SSH)" >&2
  exit 1
fi

echo "Spark URL: $SPARK_URL"
echo "Pair code: $PAIR_CODE"
echo "Host: $(uname -s) $(uname -m)"

if ! command -v node >/dev/null 2>&1 || ! command -v npm >/dev/null 2>&1; then
  echo "Node.js/npm not found. Install Node 22+ then re-run." >&2
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
import json, shlex, sys
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
fi
cat > "$ENV_FILE" <<EOF
DEEPSEEK_API_KEY='${DEEPSEEK_API_KEY:-}'
DASHSCOPE_API_KEY='${DASHSCOPE_API_KEY:-}'
CURSOR_API_KEY='${CURSOR_API_KEY:-}'
DEAPI_API_KEY='${DEAPI_API_KEY:-}'
EOF
chmod 600 "$ENV_FILE"
echo "Wrote $ENV_FILE"

if command -v openclaw >/dev/null 2>&1; then
  echo "OpenClaw CLI already present: $(openclaw --version 2>/dev/null || true)"
else
  echo "Installing OpenClaw CLI..."
  npm install -g openclaw@latest
fi

echo "Installing OpenClaw assistant workspace (linux overlay)..."
ASSIST_TMP="$(mktemp -d)"
spark_download "$SPARK_URL/install/assistant.tar.gz" "/tmp/spark-assistant.tar.gz"
tar xzf /tmp/spark-assistant.tar.gz -C "$ASSIST_TMP"
node "${ASSIST_TMP}/assistant/install.mjs"
rm -rf "$ASSIST_TMP" /tmp/spark-assistant.tar.gz

echo "Downloading Spark Bridge..."
spark_download "$SPARK_URL/install/spark-bridge.mjs" "${BRIDGE_DIR}/index.mjs"
NODE_BIN="$(command -v node)"

# systemd --user unit (linger so it survives logout on servers that allow it)
UNIT_DIR="${HOME_DIR}/.config/systemd/user"
mkdir -p "$UNIT_DIR"
UNIT="${UNIT_DIR}/spark-bridge.service"
cat > "$UNIT" <<EOF
[Unit]
Description=Spark OpenClaw Bridge
After=network-online.target
Wants=network-online.target

[Service]
Type=simple
WorkingDirectory=${BRIDGE_DIR}
ExecStart=${NODE_BIN} ${BRIDGE_DIR}/index.mjs
Restart=always
RestartSec=5
Environment=SPARK_URL=${SPARK_URL}
Environment=SPARK_PAIR_CODE=${PAIR_CODE}
Environment=HOME=${HOME_DIR}
Environment=DEEPSEEK_API_KEY=${DEEPSEEK_API_KEY:-}
Environment=DASHSCOPE_API_KEY=${DASHSCOPE_API_KEY:-}
Environment=CURSOR_API_KEY=${CURSOR_API_KEY:-}
Environment=DEAPI_API_KEY=${DEAPI_API_KEY:-}
Environment=PATH=/usr/local/bin:/usr/bin:/bin:${HOME_DIR}/.nvm/versions/node/$(node -v 2>/dev/null | tr -d v || echo '')/bin

[Install]
WantedBy=default.target
EOF

# Linger FIRST so user services survive SSH/Termius logout (may need passwordless sudo once).
LINGER_OK=0
if loginctl enable-linger "$(whoami)" 2>/dev/null; then
  LINGER_OK=1
elif sudo -n loginctl enable-linger "$(whoami)" 2>/dev/null; then
  LINGER_OK=1
fi
if [[ "$LINGER_OK" != 1 ]]; then
  echo "WARNING: could not enable linger automatically."
  echo "  Run once (as root):  sudo loginctl enable-linger $(whoami)"
  echo "  Without linger, Bridge may stop when Termius disconnects."
fi

systemctl --user daemon-reload
systemctl --user enable spark-bridge.service
systemctl --user restart spark-bridge.service

echo "Installing Spark Bridge watchdog (systemd timer)..."
spark_download "$SPARK_URL/install/spark-bridge-watchdog.sh" "${BRIDGE_DIR}/watchdog.sh"
chmod +x "${BRIDGE_DIR}/watchdog.sh"
WATCH_SVC="${UNIT_DIR}/spark-bridge-watchdog.service"
WATCH_TIMER="${UNIT_DIR}/spark-bridge-watchdog.timer"
cat > "$WATCH_SVC" <<EOF
[Unit]
Description=Spark Bridge watchdog (one-shot check)
After=network-online.target

[Service]
Type=oneshot
ExecStart=/bin/bash ${BRIDGE_DIR}/watchdog.sh
Environment=HOME=${HOME_DIR}
Environment=PATH=/usr/local/bin:/usr/bin:/bin:${HOME_DIR}/.nvm/versions/node/$(node -v 2>/dev/null | tr -d v || echo '')/bin
EOF
cat > "$WATCH_TIMER" <<EOF
[Unit]
Description=Run Spark Bridge watchdog every minute

[Timer]
OnBootSec=1min
OnUnitActiveSec=1min
AccuracySec=15s
Unit=spark-bridge-watchdog.service

[Install]
WantedBy=timers.target
EOF
systemctl --user daemon-reload
systemctl --user enable --now spark-bridge-watchdog.timer
systemctl --user start spark-bridge-watchdog.service || true

echo "Spark Bridge started (systemd --user spark-bridge + watchdog timer)."
echo "Open ${SPARK_URL}/deploy — node should go online as linux."
echo "Then chat at ${SPARK_URL}/control"
echo "Safe to close Termius / SSH — Bridge keeps running in the background."
echo "Logs: journalctl --user -u spark-bridge -f"
echo "Watchdog: systemctl --user status spark-bridge-watchdog.timer"
