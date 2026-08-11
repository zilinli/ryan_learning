#!/usr/bin/env bash
# AUD.5 — Local backup of Spark data/ (learning, history, media).
# Does NOT include .env, secrets, or node_modules.
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
DATA_DIR="${SPARK_DATA_DIR:-$ROOT/data}"
OUT_DIR="${SPARK_BACKUP_DIR:-$ROOT/backups}"
STAMP="$(date -u +%Y%m%dT%H%M%SZ)"
OUT="$OUT_DIR/spark-data-$STAMP.tar.gz"

if [[ ! -d "$DATA_DIR" ]]; then
  echo "No data dir at $DATA_DIR" >&2
  exit 1
fi

mkdir -p "$OUT_DIR"

# Exclude obvious secret / lock leftovers if they ever land under data/
tar -czf "$OUT" \
  --exclude='*.env' \
  --exclude='*secret*' \
  --exclude='*.pem' \
  --exclude='*.key' \
  -C "$(dirname "$DATA_DIR")" "$(basename "$DATA_DIR")"

echo "Wrote $OUT ($(du -h "$OUT" | awk '{print $1}'))"
