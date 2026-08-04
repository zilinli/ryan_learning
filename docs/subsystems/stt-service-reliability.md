# STT/TTS Service Reliability — Subsystem Design

> Subsystem document — part of [Spark Design Docs](../DESIGN.md)  
> Companion to [Voice TTS/STT Subsystem](./voice-tts-stt.md)

---

## 1. Current State Analysis

### 1.1 Service Architecture (as-is)

```
                    Browser (TutorShell.tsx)
                         │
            ┌────────────┼────────────┐
            ▼            ▼            ▼
     POST /api/tts   POST /api/transcribe   POST /api/chat
            │            │
            │    ┌───────┘
            ▼    ▼
    ┌─────────────────────────┐
    │  STT Server (Flask +     │
    │  waitress, port 8765)   │
    │                         │
    │  Whisper model (small)  │  ←  ~1.5GB RAM
    │  SenseVoice (ONNX)      │  ←  ~500MB RAM
    │  edge-tts (Azure)       │  ←  external API
    │                         │
    │  _infer_lock (mutex)    │  ←  serializes all STT
    │  _tts_lock (mutex)      │  ←  serializes all TTS
    │  waitress: threads=2    │
    └─────────────────────────┘
```

### 1.2 Observed Failures (from `logs/stt.log`)

| Failure | Frequency | Root Cause |
|---------|-----------|------------|
| `OSError: Address already in use` (EADDRINUSE) | 6 consecutive occurrences | Multiple `stt_server.py` instances started without pre-flight check |
| `waitress.queue: Task queue depth is 1-7` | Repeated throughout uptime | Heavy Whisper inference on CPU blocks request threads |
| `EDML header parsing failed` | Occasional | Malformed WebM from browser MediaRecorder |
| `No audio was received` from edge-tts | Occasional | Microsoft TTS rate limiting or network issue |
| Concurrent model loading (multiple processes) | Seen in log | No single-process enforcement; `start.sh` may spawn duplicates |

### 1.3 RAM Budget (4GB total)

| Component | Estimated RAM |
|-----------|--------------|
| Whisper small (faster-whisper, int8) | ~1.2 GB |
| SenseVoice (ONNX, model.int8.onnx) | ~0.4 GB |
| Next.js 16 (production) | ~0.8 GB |
| Agent Chat Console (dev mode) | ~0.4 GB |
| OS + buffers | ~0.5 GB |
| **Total** | **~3.3 GB** |
| **Headroom** | **~0.7 GB** |

On 4GB RAM with SenseVoice loaded, the system is at ~80% memory utilization. Concurrent Whisper + SenseVoice inference can push this over the limit.

---

## 2. Proposed Architecture

### 2.1 Systemd Service Unit

```ini
# /etc/systemd/system/spark-stt.service
[Unit]
Description=Spark STT/TTS Server (Whisper + SenseVoice + edge-tts)
After=network.target spark-tutor.service
Wants=network.target

[Service]
Type=simple
User=root
Group=root
WorkingDirectory=/root/codes/ryan_learning

# Environment
Environment="STT_HOST=127.0.0.1"
Environment="STT_PORT=8765"
Environment="STT_MODEL=small"
Environment="SENSEVOICE_THREADS=2"
Environment="PYTHONUNBUFFERED=1"

# Start command
ExecStartPre=/usr/bin/bash -c 'lsof -ti tcp:8765 | xargs -r kill -TERM 2>/dev/null; sleep 1'
ExecStart=/usr/bin/python3 scripts/stt_server.py

# Restart policy — prevents crash-loop
Restart=on-failure
RestartSec=5
StartLimitInterval=300
StartLimitBurst=6

# Resource limits
MemoryMax=2G
MemoryHigh=1.8G
CPUQuota=150%
TasksMax=32

# Security hardening
NoNewPrivileges=true
ProtectSystem=strict
ProtectHome=true
ReadWritePaths=/root/codes/ryan_learning/scripts
ReadWritePaths=/tmp
PrivateTmp=false  # needs /tmp for audio temp files

# Logging
StandardOutput=journal
StandardError=journal
SyslogIdentifier=spark-stt

[Install]
WantedBy=multi-user.target
```

### 2.2 Start Script Integration

```bash
# updated: start.sh — STT service management

STT_PORT="${STT_PORT:-8765}"

# Option 1: systemd (preferred for production)
if command -v systemctl &>/dev/null && systemctl is-enabled spark-stt &>/dev/null; then
  echo "[Spark] STT: using systemd (spark-stt.service)"
  systemctl restart spark-stt 2>/dev/null || systemctl start spark-stt
else
  # Option 2: manual process management (fallback)
  echo "[Spark] STT: manual process management"

  # Pre-flight: kill existing on port
  STT_PID=$(lsof -ti "tcp:${STT_PORT}" 2>/dev/null || true)
  if [[ -n "$STT_PID" ]]; then
    echo "[Spark] Killing existing STT server on port ${STT_PORT} (PID ${STT_PID})..."
    kill -TERM "$STT_PID" 2>/dev/null || true
    sleep 2
    kill -KILL "$STT_PID" 2>/dev/null || true
  fi

  # Check port is free
  if lsof -ti "tcp:${STT_PORT}" &>/dev/null; then
    echo "[Spark] ⚠️  Port ${STT_PORT} still in use — STT will be unavailable" >&2
  else
    nohup python3 scripts/stt_server.py > logs/stt.log 2>&1 &
    echo "[Spark] STT server PID: $!  → http://127.0.0.1:${STT_PORT}"

    # Cleanup on exit
    STT_PID=$!
    trap "kill ${STT_PID} 2>/dev/null; echo '[Spark] Stopped STT server'" EXIT
  fi
fi
```

### 2.3 Python Graceful Shutdown

```python
# updated: scripts/stt_server.py (add after imports, before app = Flask(__name__))

import signal
import sys
import socket

# ── Graceful shutdown ──────────────────────────────────────────
def _check_port_free(host: str, port: int) -> bool:
    """Return True if port is available."""
    try:
        sock = socket.socket(socket.AF_INET, socket.SOCK_STREAM)
        sock.settimeout(1)
        result = sock.connect_ex((host, port))
        sock.close()
        return result != 0  # 0 = connected (in use), non-zero = free
    except Exception:
        return True

def _shutdown(signum, frame):
    print(f"\n[stt] Received signal {signum}, shutting down...", flush=True)
    sys.exit(0)

signal.signal(signal.SIGTERM, _shutdown)
signal.signal(signal.SIGINT, _shutdown)

# ── Model loading (sequential, not parallel) ───────────────────
def _load_models():
    """Load Whisper first (larger), then SenseVoice with error isolation."""
    try:
        get_model()  # Whisper
    except Exception as e:
        print(f"[stt] WARNING: Whisper model failed to load: {e}", flush=True)
        # Continue — SenseVoice may still work for zh/yue/en

    try:
        get_sense_voice()  # SenseVoice
    except Exception as e:
        print(f"[stt] WARNING: SenseVoice failed to load: {e}", flush=True)
        # Continue — Whisper handles everything as fallback

    model_count = 1 if model is not None else 0
    sv_count = len(sense_voice_pool)
    print(
        f"[stt] Models loaded: whisper={'yes' if model else 'no'} "
        f"sensevoice={sv_count}",
        flush=True,
    )
```

### 2.4 Health Endpoint Enhancement

```python
# updated: stt_server.py — /health endpoint

@app.get("/health")
def health():
    """Health check with memory and model status."""
    import psutil  # optional, graceful degradation

    mem_info = {}
    try:
        proc = psutil.Process()
        mem = proc.memory_info()
        mem_info = {
            "rss_mb": round(mem.rss / (1024 * 1024), 1),
            "percent": round(proc.memory_percent(), 1),
        }
    except Exception:
        mem_info = {"rss_mb": -1, "percent": -1}

    sv_ok = bool(sense_voice_pool) or (sense_voice_error is None and get_sense_voice() is not None)

    return jsonify({
        "ok": True,
        "model": MODEL_SIZE,
        "whisper_loaded": model is not None,
        "sensevoice_loaded": sv_ok,
        "sensevoice_error": sense_voice_error,
        "tts_voice": TTS_VOICE,
        "stt_langs": sorted(ALLOWED_STT_LANGS),
        "engines": {
            "zh": "sensevoice" if sv_ok else "whisper",
            "yue": "sensevoice" if sv_ok else "whisper",
            "en": "sensevoice" if sv_ok else "whisper",
            "es": "whisper",
            "auto": "sensevoice+whisper" if sv_ok else "whisper",
        },
        "memory": mem_info,
        "task_queue_depth": getattr(app, '_waitress_queue_depth', 0),
    })
```

### 2.5 Task Queue Monitoring

```python
# Monkey-patch waitress to expose queue depth for monitoring
# (add before serve() call)

import waitress.task

_original_start = waitress.task.ThreadedTaskDispatcher.start

def _patched_start(self):
    _original_start(self)
    # Expose queue depth for health check
    app._waitress_queue_depth = 0  # type: ignore

waitress.task.ThreadedTaskDispatcher.start = _patched_start
```

---

## 3. Error Handling Matrix

### 3.1 Transcription Pipeline

| Error | Detection | User-Facing Message | Recovery |
|-------|-----------|--------------------|----------|
| Audio too short (< 64 bytes) | `os.path.getsize(tmp_path) < 64` | "Recording too short — speak a bit longer" | 400, user retries |
| Audio too quiet (RMS < 0.004) | `_wav_rms(wav_path) < 0.004` | "Didn't catch speech — speak louder" | 422, user retries |
| FFmpeg decode failure | `RuntimeError` in `convert_to_wav` | "Could not read the recording — try Mic again" | 500, logs original error |
| SenseVoice load failure | `get_sense_voice()` returns None | Silent fallback to Whisper | Logs error; Whisper handles |
| Whisper model not loaded | `model is None` after load attempt | "Voice service starting up — try again in 30s" | 503, retry-after header |
| OOM during inference | `MemoryError` in pipeline | "Voice service busy — try again in a moment" | 500, restart with MemoryMax |

### 3.2 TTS Pipeline

| Error | Detection | User-Facing Message | Recovery |
|-------|-----------|--------------------|----------|
| Empty text | `not text` | "empty text" | 400 |
| Invalid voice | `voice not in ALLOWED_VOICES` | Falls back to `TTS_VOICE` default | Silent fallback |
| edge-tts no audio | `len(audio) < 100` | "TTS produced empty audio" | 500 |
| edge-tts rate limit | Exception with "429" or "Too Many Requests" | "TTS temporarily unavailable — text reply still shown" | 503, backoff for next request |
| Network timeout to Microsoft | `asyncio.TimeoutError` | "TTS temporarily unavailable — try again" | 503 |

---

## 4. Performance Tuning

### 4.1 Whisper Configuration (current vs optimized)

| Parameter | Current | Proposed | Rationale |
|-----------|---------|----------|-----------|
| `beam_size` | 2 | 1 | Single beam is ~40% faster on CPU; accuracy loss is negligible for tutoring audio (clear speech, short clips) |
| `best_of` | 2 | 1 | No benefit with beam_size=1 |
| `compute_type` | `int8` | `int8` | Already optimal for CPU |
| `vad_filter` | True (with False retry) | True (with False retry) | Keep dual-pass; VAD helps with long silences |

### 4.2 Concurrency Model

Current: 2 waitress threads + single `_infer_lock` → effectively 1 concurrent transcription

Proposed: Keep single lock (safe for faster-whisper which is NOT thread-safe). Accept sequential processing. This is acceptable because:
- Spark has 1 primary user (Ryan)
- Typical transcription duration: 0.5-3s for short tutoring clips
- If queue depth exceeds 3, return 503 ("busy") to the client

---

## 5. Monitoring & Alerts

### 5.1 Key Metrics

| Metric | Source | Alert Threshold |
|--------|--------|----------------|
| STT service uptime | systemd / `systemctl is-active spark-stt` | Not active for > 30s |
| Memory usage | `/health` endpoint `memory.rss_mb` | > 1800 MB |
| Task queue depth | waitress queue | > 3 for > 60s |
| Error rate (5xx) | Spark server logs or run log | > 10% in 10 minutes |
| Whisper model loaded | `/health` `whisper_loaded` | False for > 60s after start |
| SenseVoice loaded | `/health` `sensevoice_loaded` | False (non-critical; Whisper fallback) |

### 5.2 Health Check Script

```bash
#!/usr/bin/env bash
# scripts/health-stt.sh — called by monitoring or start.sh
set -euo pipefail

HEALTH_URL="http://127.0.0.1:8765/health"
TIMEOUT=30
ELAPSED=0

while [[ $ELAPSED -lt $TIMEOUT ]]; do
  if curl -sf "$HEALTH_URL" >/dev/null 2>&1; then
    echo "STT: healthy"
    curl -s "$HEALTH_URL" | python3 -m json.tool
    exit 0
  fi
  sleep 2
  ELAPSED=$((ELAPSED + 2))
done

echo "STT: unhealthy after ${TIMEOUT}s"
exit 1
```

---

## 6. Implementation Checklist

### Phase 1 — Immediate (2h)

- [ ] Create `/etc/systemd/system/spark-stt.service` with `Restart=on-failure`, `MemoryMax=2G`
- [ ] Add pre-flight port check in `start.sh` (kill existing on 8765)
- [ ] Add graceful SIGTERM handler in `stt_server.py`
- [ ] Add sequential model loading with error isolation

### Phase 2 — Resilience (2h)

- [ ] Enhanced `/health` endpoint with memory and queue depth
- [ ] `health-stt.sh` monitoring script
- [ ] Reduce Whisper beam_size to 1 for CPU performance
- [ ] Add 503 + Retry-After for busy STT

### Phase 3 — Observability (1h)

- [ ] Log STT errors to structured format (JSONL)
- [ ] Wire health check into `start.sh` (wait for STT healthy before launching Next.js)
- [ ] Add memory pressure alerting

---

## 7. References

- [GIGAGPU: Deploy Whisper on a Dedicated GPU Server (2026)](https://gigagpu.com/deploy-whisper-dedicated-server/) — systemd, faster-whisper, nginx reverse proxy
- [whisper-install: Production Whisper Service](https://github.com/hwdsl2/whisper-install) — systemd unit template, health checks
- [fakehec/whisper-stt-local-server](https://github.com/fakehec/whisper-stt-local-server) — Hot/Cold worker pool, hardware lock management
- [faster-whisper](https://github.com/SYSTRAN/faster-whisper) — CTranslate2 backend, INT8 quantization
- [edge-tts](https://github.com/rany2/edge-tts) — Microsoft Edge TTS Python library
- [waitress](https://docs.pylonsproject.org/projects/waitress/) — Production WSGI server for Flask
- [systemd.service manual](https://www.freedesktop.org/software/systemd/man/systemd.service.html) — Restart, MemoryMax, StartLimitBurst
