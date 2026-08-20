#!/bin/bash
# 启动 Bolt Console（本地网页，默认端口 18790）
set -e
PORT=${1:-18790}
DIR="$(cd "$(dirname "$0")" && pwd)"

if lsof -iTCP:$PORT -sTCP:LISTEN >/dev/null 2>&1; then
  echo "Bolt Console 已在运行: http://127.0.0.1:$PORT"
  exit 0
fi

cd "$DIR"
nohup /usr/bin/python3 server.py > workbench.log 2>&1 &
sleep 1
if lsof -iTCP:$PORT -sTCP:LISTEN >/dev/null 2>&1; then
  echo "Bolt Console 已启动: http://127.0.0.1:$PORT"
  open "http://127.0.0.1:$PORT"
else
  echo "启动失败，查看日志: $DIR/workbench.log"
  tail -5 "$DIR/workbench.log"
  exit 1
fi
