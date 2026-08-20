#!/bin/bash
# 停止 Bolt Console
if lsof -tiTCP:18790 -sTCP:LISTEN >/dev/null 2>&1; then
  lsof -tiTCP:18790 -sTCP:LISTEN | xargs kill 2>/dev/null
  sleep 1
  echo "Bolt Console 已停止"
else
  echo "Bolt Console 未在运行"
fi
