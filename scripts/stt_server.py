#!/usr/bin/env python3
"""Local STT (Whisper + SenseVoice) + neural TTS (edge-tts) for Spark.

- Mandarin / Cantonese / auto (CJK+EN) → SenseVoice when available
- English / Spanish / auto fallback → faster-whisper (multilingual small)
"""

from __future__ import annotations

import asyncio
import os
import re
import subprocess
import tempfile
import threading
import traceback
from pathlib import Path

from flask import Flask, jsonify, request, send_file
from faster_whisper import WhisperModel

# ── Graceful shutdown & port check ─────────────────────────────
import signal
import sys
import socket

def _check_port_free(host: str, port: int) -> bool:
    """Return True if port is available."""
    try:
        sock = socket.socket(socket.AF_INET, socket.SOCK_STREAM)
        sock.settimeout(1)
        result = sock.connect_ex((host, port))
        sock.close()
        return result != 0
    except Exception:
        return True

def _shutdown(signum, frame):
    print(f"\n[stt] Received signal {signum}, shutting down gracefully...", flush=True)
    sys.exit(0)

signal.signal(signal.SIGTERM, _shutdown)
signal.signal(signal.SIGINT, _shutdown)

HOST = os.environ.get("STT_HOST", "127.0.0.1")
PORT = int(os.environ.get("STT_PORT", "8765"))
# Multilingual Whisper (not *.en). small ≫ base for zh/es on CPU.
MODEL_SIZE = os.environ.get("STT_MODEL", "small")
# On 4GB boxes, eager dual-load OOMs. Default: SenseVoice only;
# Whisper loads lazily on first en/es/auto fallback request.
# Values: sensevoice | whisper | both | none
STT_PRELOAD = os.environ.get("STT_PRELOAD", "sensevoice").strip().lower()
# Default neural voice (clients may override per request)
TTS_VOICE = os.environ.get("TTS_VOICE", "en-US-AvaNeural")
ALLOWED_STT_LANGS = {"auto", "en", "zh", "yue", "es"}
ALLOWED_VOICES = {
    "en-US-AvaNeural",
    "en-GB-RyanNeural",
    "en-US-JennyNeural",
    "en-GB-ThomasNeural",
    # Mandarin / Cantonese
    "zh-CN-XiaoxiaoNeural",
    "zh-CN-YunxiNeural",
    "zh-HK-HiuMaanNeural",
    "zh-HK-WanLungNeural",
    # Spanish
    "es-ES-ElviraNeural",
    "es-ES-AlvaroNeural",
    "es-MX-DaliaNeural",
    "es-MX-JorgeNeural",
    "es-US-PalomaNeural",
}

SENSEVOICE_REPO = os.environ.get(
    "SENSEVOICE_REPO",
    "csukuangfj/sherpa-onnx-sense-voice-zh-en-ja-ko-yue-2024-07-17",
)
# Prefer SenseVoice for these (and for auto before Whisper)
SENSEVOICE_LANGS = {"zh", "yue", "auto"}

app = Flask(__name__)
model: WhisperModel | None = None
# SenseVoice recognizers keyed by language: auto | zh | yue | en
sense_voice_pool: dict[str, object] = {}
sense_voice_error: str | None = None
_yue_supported: bool | None = None
# faster-whisper / ONNX are not safe for overlapping calls on one model
_infer_lock = threading.Lock()
_tts_lock = threading.Lock()


def get_model() -> WhisperModel:
    global model
    if model is None:
        print(f"[stt] loading whisper model {MODEL_SIZE} …", flush=True)
        model = WhisperModel(MODEL_SIZE, device="cpu", compute_type="int8")
        print("[stt] whisper ready", flush=True)
    return model


def _model_supports_yue() -> bool:
    """True when the loaded Whisper tokenizer has a <|yue|> token (large-v3+)."""
    global _yue_supported
    if _yue_supported is not None:
        return _yue_supported
    try:
        tok = get_model().hf_tokenizer
        _yue_supported = tok.token_to_id("<|yue|>") is not None
    except Exception:  # noqa: BLE001
        _yue_supported = False
    return _yue_supported


def _resolve_sensevoice_paths() -> tuple[str, str] | None:
    """Locate SenseVoice int8 ONNX + tokens (HF cache or SENSEVOICE_DIR)."""
    root = os.environ.get("SENSEVOICE_DIR", "").strip()
    if not root:
        try:
            from huggingface_hub import snapshot_download

            root = snapshot_download(SENSEVOICE_REPO, local_files_only=False)
        except Exception as exc:  # noqa: BLE001
            print(f"[stt] SenseVoice download failed: {exc}", flush=True)
            return None

    model_path = os.path.join(root, "model.int8.onnx")
    tokens_path = os.path.join(root, "tokens.txt")
    if not os.path.isfile(model_path):
        model_path = os.path.join(root, "model.onnx")
    if not os.path.isfile(model_path) or not os.path.isfile(tokens_path):
        print(f"[stt] SenseVoice files missing under {root}", flush=True)
        return None
    return model_path, tokens_path


def get_sense_voice(lang: str = "auto"):
    """Lazy-load one SenseVoice recognizer (auto LID covers zh / yue / en)."""
    global sense_voice_error
    _ = lang  # callers may pass zh/yue; we keep a single auto model
    key = "auto"
    if key in sense_voice_pool:
        return sense_voice_pool[key]
    if sense_voice_error is not None:
        return None

    try:
        import sherpa_onnx
    except ImportError as exc:
        sense_voice_error = f"sherpa-onnx not installed: {exc}"
        print(f"[stt] {sense_voice_error}", flush=True)
        return None

    paths = _resolve_sensevoice_paths()
    if not paths:
        sense_voice_error = "SenseVoice model not found"
        return None

    model_path, tokens_path = paths
    try:
        print("[stt] loading SenseVoice …", flush=True)
        recognizer = sherpa_onnx.OfflineRecognizer.from_sense_voice(
            model=model_path,
            tokens=tokens_path,
            num_threads=int(os.environ.get("SENSEVOICE_THREADS", "2")),
            language=key,
            use_itn=True,
            debug=False,
        )
        sense_voice_pool[key] = recognizer
        sense_voice_error = None
        print("[stt] SenseVoice ready", flush=True)
        return recognizer
    except Exception as exc:  # noqa: BLE001
        sense_voice_error = str(exc)
        print(f"[stt] SenseVoice load failed: {exc}", flush=True)
        return None


def convert_to_wav(src: str) -> str:
    """Normalize any phone container (webm/mp4/ogg) into 16kHz mono WAV."""
    wav_path = src + ".wav"
    cmd = [
        "ffmpeg",
        "-hide_banner",
        "-loglevel",
        "error",
        "-y",
        "-i",
        src,
        "-vn",
        "-ac",
        "1",
        "-ar",
        "16000",
        "-c:a",
        "pcm_s16le",
        wav_path,
    ]
    # Some broken WebM still works with ffmpeg error tolerance
    proc = subprocess.run(cmd, capture_output=True, text=True)
    if proc.returncode != 0 or not os.path.exists(wav_path) or os.path.getsize(wav_path) < 100:
        # Retry: force format probe / ignore unknown packets
        cmd2 = [
            "ffmpeg",
            "-hide_banner",
            "-loglevel",
            "error",
            "-y",
            "-fflags",
            "+genpts+igndts+discardcorrupt",
            "-i",
            src,
            "-vn",
            "-ac",
            "1",
            "-ar",
            "16000",
            "-c:a",
            "pcm_s16le",
            wav_path,
        ]
        proc2 = subprocess.run(cmd2, capture_output=True, text=True)
        if proc2.returncode != 0 or not os.path.exists(wav_path):
            err = (proc2.stderr or proc.stderr or "ffmpeg failed").strip()
            raise RuntimeError(f"Could not decode audio ({err[:180]})")
    return wav_path


def _normalize_stt_lang(raw: str | None) -> str:
    lang = (raw or "auto").strip().lower()
    aliases = {
        "": "auto",
        "auto": "auto",
        "en": "en",
        "eng": "en",
        "english": "en",
        "zh": "zh",
        "zh-cn": "zh",
        "zh-tw": "zh",
        "cmn": "zh",
        "mandarin": "zh",
        "chinese": "zh",
        "yue": "yue",
        "zh-hk": "yue",
        "zh-yue": "yue",
        "cantonese": "yue",
        "es": "es",
        "spa": "es",
        "spanish": "es",
        "es-es": "es",
        "es-mx": "es",
    }
    lang = aliases.get(lang, lang)
    if lang not in ALLOWED_STT_LANGS:
        return "auto"
    return lang


def _transcribe_kwargs(lang: str, *, vad: bool = True) -> dict:
    """Build faster-whisper options. Beam=1 for speed on CPU; Spanish/escalated."""
    base = {
        "vad_filter": vad,
        "vad_parameters": {
            "min_silence_duration_ms": 300,
            "speech_pad_ms": 500,       # wider padding around speech = fewer cut-offs
        },
        "beam_size": 1,
        "best_of": 1,
        "patience": 1.0,
        "temperature": 0.0,
        "condition_on_previous_text": False,
        "without_timestamps": True,
        # Relaxed compression threshold — Spanish long vowels trigger this
        "compression_ratio_threshold": 3.2,
        "log_prob_threshold": -1.4,    # slightly more permissive for non-English
        "no_speech_threshold": 0.35,   # stricter: fewer noise hallucinations
    }
    if lang == "auto":
        base["language"] = None
        base["vad_parameters"]["min_silence_duration_ms"] = 400
        return base
    if lang == "en":
        base["language"] = "en"
        base["initial_prompt"] = "Hello. I need help with my homework today."
        return base
    if lang == "es":
        base["language"] = "es"
        # Rich Spanish prompt helps model converge on correct vocabulary
        base["initial_prompt"] = (
            "Hola. Esto es español. Necesito ayuda con la tarea de matemáticas."
            " ¿Puedes explicarme cómo se resuelve este problema?"
        )
        # Higher beam for Spanish — small model needs more decoding alternatives
        # beam=3 balances accuracy vs memory/time (5 causes CPU deadlock on small model)
        base["beam_size"] = 3
        base["best_of"] = 3
        base["temperature"] = (0.0, 0.2, 0.4)
        base["patience"] = 1.0
        # Even more relaxed for Spanish small-model decode
        base["compression_ratio_threshold"] = 3.5
        base["log_prob_threshold"] = -1.6
        base["no_speech_threshold"] = 0.30
        return base
    if lang == "zh":
        base["language"] = "zh"
        base["initial_prompt"] = "你好。这是普通话。请帮我看一下这道数学题。"
        base["beam_size"] = 2
        base["best_of"] = 2
        return base
    if lang == "yue":
        if _model_supports_yue():
            base["language"] = "yue"
            base["initial_prompt"] = "你好。呢段係廣東話。我想问功课。"
            base["beam_size"] = 2
            base["best_of"] = 2
        else:
            base["language"] = "zh"
            base["initial_prompt"] = "以下係廣東話口述。請用中文寫出粤语内容。"
        return base
    base["language"] = None
    return base


def _wav_duration(wav_path: str) -> float:
    """Return WAV duration in seconds; 0 if unreadable."""
    try:
        import wave
        with wave.open(wav_path, "rb") as wf:
            frames = wf.getnframes()
            rate = wf.getframerate()
            return frames / max(rate, 1)
    except Exception:
        return 0.0


def _wav_rms(wav_path: str) -> float:
    """Rough RMS of a 16-bit WAV; 0 if unreadable."""
    try:
        samples, _sr = _read_wav_f32(wav_path)
        if samples is None or len(samples) == 0:
            return 0.0
        import numpy as np

        return float(np.sqrt(np.mean(np.square(samples))))
    except Exception:  # noqa: BLE001
        return 0.0


_CJK_RE = re.compile(r"[\u4e00-\u9fff]")
_LATIN_WORD_RE = re.compile(r"[A-Za-zÁÉÍÓÚÜÑáéíóúüñ']+")


def _text_usable(text: str) -> bool:
    t = (text or "").strip()
    if not t:
        return False
    # Strip light punctuation for length checks
    core = re.sub(r"[\s.,!?;:。！？、…\"'“”]+", "", t)
    if len(core) < 1:
        return False
    # Single-token Latin hallucinations on noise: reject "I", "te", "a." etc
    # but accept plausible short answers like "Yes", "No", "Sí", "Hola"
    if not _CJK_RE.search(t):
        words = _LATIN_WORD_RE.findall(t)
        if len(words) <= 1 and len(core) <= 2:
            return False
    return True


def _prefer_sensevoice_for_auto(sv_text: str, sv_lang: str) -> bool:
    """For Auto, only trust SenseVoice on clear CJK (or ja/ko).

    Latin-script Auto must use Whisper — SenseVoice has no Spanish and
    frequently emits short Latin junk on Spanish audio.
    """
    if not _text_usable(sv_text):
        return False
    if _CJK_RE.search(sv_text):
        return True
    if sv_lang in ("zh", "yue", "ja", "ko"):
        return True
    return False


def _read_wav_f32(path: str):
    """Load mono WAV as float32 samples + sample rate for SenseVoice."""
    import wave

    import numpy as np

    with wave.open(path, "rb") as wf:
        channels = wf.getnchannels()
        width = wf.getsampwidth()
        sr = wf.getframerate()
        raw = wf.readframes(wf.getnframes())

    if width == 2:
        samples = np.frombuffer(raw, dtype=np.int16).astype(np.float32) / 32768.0
    elif width == 4:
        samples = np.frombuffer(raw, dtype=np.int32).astype(np.float32) / 2147483648.0
    else:
        samples = np.frombuffer(raw, dtype=np.uint8).astype(np.float32)
        samples = (samples - 128.0) / 128.0

    if channels > 1:
        samples = samples.reshape(-1, channels).mean(axis=1)

    return samples, sr


def _transcribe_sensevoice(wav_path: str, lang: str) -> tuple[str, str]:
    """Run SenseVoice; returns (text, reported_lang)."""
    sv = get_sense_voice(lang)
    if sv is None:
        raise RuntimeError(sense_voice_error or "SenseVoice unavailable")

    samples, sr = _read_wav_f32(wav_path)
    with _infer_lock:
        stream = sv.create_stream()
        stream.accept_waveform(sr, samples)
        sv.decode_stream(stream)
        text = (stream.result.text or "").strip()

    detected = lang
    if "<|" in text:
        tag = re.search(r"<\|(zh|yue|en|ja|ko)\|>", text)
        if tag:
            detected = tag.group(1)
        text = re.sub(r"<\|[^|]*\|>", "", text).strip()
    if lang in ("zh", "yue"):
        detected = lang
    return text, detected


def _transcribe_whisper(
    wav_path: str, lang: str, *, vad: bool = True
) -> tuple[str, str]:
    kwargs = _transcribe_kwargs(lang, vad=vad)
    with _infer_lock:
        segments, info = get_model().transcribe(wav_path, **kwargs)
        text = " ".join(seg.text.strip() for seg in segments).strip()
        detected = getattr(info, "language", None) or lang
    return text, detected


def _transcribe_pipeline(wav_path: str, lang: str) -> tuple[str, str, str]:
    """Return (text, detected_lang, engine)."""
    rms = _wav_rms(wav_path)
    # Much lower gate — phone mics, quiet speakers, and peak-normalized clips
    # commonly land at 0.001–0.008 RMS. 0.0015 catches real speech while still
    # rejecting dead-air captures.
    if rms < 0.0015:
        return "", lang, "silence"

    # Spanish is Whisper-only; SenseVoice coverage is zh/yue/en/ja/ko
    use_sv = lang in SENSEVOICE_LANGS and get_sense_voice(lang) is not None
    if lang == "es":
        use_sv = False
    if lang == "en":
        # SenseVoice auto-LID on English short clips (under 4s) is unreliable —
        # it can produce garbled Latin text or mis-detect as ja/ko. Prefer
        # Whisper for English on short audio (the common tutoring case).
        # Only use SenseVoice for English if it's explicitly requested AND the
        # WAV is long enough for the LID to work reliably.
        _wav_dur = _wav_duration(wav_path)
        use_sv = _wav_dur > 4.0 and get_sense_voice(lang) is not None

    if use_sv:
        try:
            text, detected = _transcribe_sensevoice(wav_path, lang)
            if lang == "auto" and not _prefer_sensevoice_for_auto(text, detected):
                # Likely Spanish / empty — fall through to Whisper
                pass
            elif _text_usable(text):
                return text, detected, "sensevoice"
        except Exception as sv_exc:  # noqa: BLE001
            print(f"[stt] SenseVoice failed: {sv_exc}", flush=True)

    text, detected = _transcribe_whisper(wav_path, lang, vad=True)
    if not _text_usable(text):
        # VAD sometimes eats short tutoring clips — retry raw
        text2, detected2 = _transcribe_whisper(wav_path, lang, vad=False)
        if _text_usable(text2):
            return text2, detected2, "whisper"
        # Both failed — if VAD text is non-empty but short, return it anyway
        if text and text.strip() and len(text.strip()) >= 1:
            return text, detected, "whisper"
        # Give text2 a chance too if it has something
        if text2 and text2.strip() and len(text2.strip()) >= 1:
            return text2, detected2, "whisper"
        return text, detected, "whisper"
    return text, detected, "whisper"


@app.get("/health")
def health():
    sv_ok = bool(sense_voice_pool) or get_sense_voice() is not None

    mem_info = {}
    try:
        import psutil
        proc = psutil.Process()
        mem = proc.memory_info()
        mem_info = {"rss_mb": round(mem.rss / (1024 * 1024), 1), "percent": round(proc.memory_percent(), 1)}
    except Exception:
        mem_info = {"rss_mb": -1, "percent": -1}

    return jsonify(
        {
            "ok": True,
            "model": MODEL_SIZE,
            "preload": STT_PRELOAD,
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
        }
    )


@app.post("/transcribe")
def transcribe():
    if "audio" not in request.files:
        return jsonify({"error": "missing audio"}), 400
    f = request.files["audio"]
    if not f or not f.filename:
        return jsonify({"error": "empty audio"}), 400

    lang = _normalize_stt_lang(
        request.form.get("language") or request.args.get("language")
    )

    suffix = Path(f.filename).suffix or ".wav"
    if len(suffix) > 8:
        suffix = ".wav"

    tmp_path = None
    wav_path = None
    try:
        with tempfile.NamedTemporaryFile(delete=False, suffix=suffix) as tmp:
            f.save(tmp.name)
            tmp_path = tmp.name

        if os.path.getsize(tmp_path) < 64:
            return jsonify({"error": "Recording too short — speak a bit longer"}), 400

        wav_path = convert_to_wav(tmp_path)
        text, detected, engine = _transcribe_pipeline(wav_path, lang)

        if engine == "silence" or not _text_usable(text):
            return (
                jsonify(
                    {
                        "error": (
                            "Didn’t catch speech — speak louder and a bit longer"
                        ),
                        "text": "",
                        "language": detected,
                        "requested_language": lang,
                        "engine": engine,
                    }
                ),
                422,
            )

        return jsonify(
            {
                "text": text,
                "language": detected,
                "requested_language": lang,
                "engine": engine,
            }
        )
    except Exception as exc:  # noqa: BLE001
        traceback.print_exc()
        msg = str(exc)
        if "Invalid data" in msg or "decode" in msg.lower() or "ffmpeg" in msg.lower():
            msg = "Could not read the recording — try Mic again and speak clearly"
        elif "Memory" in msg or "alloc" in msg.lower():
            msg = "Voice service busy — try again in a moment"
        return jsonify({"error": msg[:240]}), 500
    finally:
        for p in (tmp_path, wav_path):
            if p and os.path.exists(p):
                try:
                    os.unlink(p)
                except OSError:
                    pass


def _clean_tts_text(text: str) -> str:
    import re

    t = text.strip()
    t = re.sub(r"```[\s\S]*?```", " ", t)
    t = re.sub(r"`([^`]+)`", r"\1", t)
    t = re.sub(r"\[([^\]]+)\]\([^)]+\)", r"\1", t)
    t = re.sub(r"^#{1,6}\s+", "", t, flags=re.M)
    t = re.sub(r"[*_#~>]+", " ", t)
    t = re.sub(r"\s+", " ", t).strip()
    # Client already chunks; keep a generous per-request cap
    return t[:900]


@app.post("/tts")
def tts():
    import io

    data = request.get_json(silent=True) or {}
    text = _clean_tts_text(str(data.get("text") or ""))
    voice = str(data.get("voice") or TTS_VOICE)
    if voice not in ALLOWED_VOICES:
        voice = TTS_VOICE
    if not text:
        return jsonify({"error": "empty text"}), 400

    try:
        import edge_tts

        async def _synth() -> bytes:
            # Slightly slower for clarity, but keep zh near-natural to avoid choppy pacing
            if voice.startswith("en-GB"):
                rate = "-6%"
            elif voice.startswith("zh-"):
                rate = "-2%"
            elif voice.startswith("es-"):
                rate = "-4%"
            else:
                rate = "-4%"
            communicate = edge_tts.Communicate(
                text,
                voice,
                rate=rate,
                pitch="+0Hz",
            )
            parts: list[bytes] = []
            async for chunk in communicate.stream():
                if chunk["type"] == "audio":
                    parts.append(chunk["data"])
            return b"".join(parts)

        with _tts_lock:
            audio = asyncio.run(_synth())
        if len(audio) < 100:
            return jsonify({"error": "TTS produced empty audio"}), 500

        buf = io.BytesIO(audio)
        buf.seek(0)
        return send_file(
            buf,
            mimetype="audio/mpeg",
            as_attachment=False,
            download_name="spark.mp3",
            max_age=0,
        )
    except Exception as exc:  # noqa: BLE001
        traceback.print_exc()
        return jsonify({"error": str(exc)}), 500


def _preload_models() -> None:
    """Load models per STT_PRELOAD without dual-eager OOM on 4GB hosts.

    sensevoice (default): load SenseVoice only; Whisper on first need.
    whisper: load Whisper only; SenseVoice on first zh/yue/auto need.
    both: sequential load with GC between (peak RAM — avoid on 4GB).
    none: defer everything until first /transcribe.
    """
    import gc

    want_sv = STT_PRELOAD in ("sensevoice", "both")
    want_wh = STT_PRELOAD in ("whisper", "both")
    if STT_PRELOAD == "none":
        print("[stt] STT_PRELOAD=none — models load on first request", flush=True)
        return

    print(f"[stt] Loading models (preload={STT_PRELOAD})...", flush=True)

    if want_sv:
        try:
            get_sense_voice()
            if sense_voice_pool:
                print("[stt] SenseVoice ready", flush=True)
        except Exception as e:  # noqa: BLE001
            print(f"[stt] WARNING: SenseVoice load failed: {e}", flush=True)
        gc.collect()

    if want_wh:
        try:
            get_model()
            print("[stt] Whisper ready", flush=True)
        except Exception as e:  # noqa: BLE001
            print(f"[stt] WARNING: Whisper load failed: {e}", flush=True)
        gc.collect()

    # If the preferred engine failed, try the other once so the service can start.
    if model is None and not sense_voice_pool:
        print("[stt] Preferred preload empty — trying fallback engine...", flush=True)
        if not want_sv:
            try:
                get_sense_voice()
            except Exception as e:  # noqa: BLE001
                print(f"[stt] WARNING: SenseVoice fallback failed: {e}", flush=True)
            gc.collect()
        if model is None and not sense_voice_pool and not want_wh:
            try:
                get_model()
            except Exception as e:  # noqa: BLE001
                print(f"[stt] WARNING: Whisper fallback failed: {e}", flush=True)
            gc.collect()


if __name__ == "__main__":
    # Pre-flight: check port is free
    if not _check_port_free(HOST, PORT):
        print(f"[stt] Port {HOST}:{PORT} already in use — killing existing...", flush=True)
        try:
            out = subprocess.check_output(["lsof", "-ti", f"tcp:{PORT}"], text=True, timeout=5)
            pid = out.strip()
            if pid:
                subprocess.run(["kill", "-TERM", pid], timeout=5)
                import time

                time.sleep(2)
        except Exception:
            pass
        if not _check_port_free(HOST, PORT):
            print(f"[stt] ERROR: Port {HOST}:{PORT} still in use — exiting", flush=True)
            sys.exit(1)

    _preload_models()

    if model is None and not sense_voice_pool and STT_PRELOAD != "none":
        print("[stt] FATAL: No STT models loaded — exiting", flush=True)
        sys.exit(1)

    try:
        from waitress import serve

        print(
            f"[stt] waitress on {HOST}:{PORT} whisper={MODEL_SIZE}"
            f"({'loaded' if model else 'lazy'}) "
            f"sensevoice={'on' if sense_voice_pool else 'lazy'} "
            f"preload={STT_PRELOAD} voice={TTS_VOICE}",
            flush=True,
        )
        serve(app, host=HOST, port=PORT, threads=2, channel_timeout=120)
    except ImportError:
        app.run(host=HOST, port=PORT, threaded=True)
