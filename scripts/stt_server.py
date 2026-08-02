#!/usr/bin/env python3
"""Local STT (faster-whisper) + neural TTS (edge-tts) for Spark."""

from __future__ import annotations

import asyncio
import os
import subprocess
import tempfile
import traceback
from pathlib import Path

from flask import Flask, jsonify, request, send_file
from faster_whisper import WhisperModel

HOST = os.environ.get("STT_HOST", "127.0.0.1")
PORT = int(os.environ.get("STT_PORT", "8765"))
MODEL_SIZE = os.environ.get("STT_MODEL", "tiny.en")
# Default neural voice (clients may override per request)
TTS_VOICE = os.environ.get("TTS_VOICE", "en-US-AvaNeural")
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
    "es-MX-DaliaNeural",
    "es-US-PalomaNeural",
}

app = Flask(__name__)
model: WhisperModel | None = None


def get_model() -> WhisperModel:
    global model
    if model is None:
        print(f"[stt] loading model {MODEL_SIZE} …", flush=True)
        model = WhisperModel(MODEL_SIZE, device="cpu", compute_type="int8")
        print("[stt] model ready", flush=True)
    return model


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


@app.get("/health")
def health():
    return jsonify(
        {
            "ok": True,
            "model": MODEL_SIZE,
            "loaded": model is not None,
            "tts_voice": TTS_VOICE,
        }
    )


@app.post("/transcribe")
def transcribe():
    if "audio" not in request.files:
        return jsonify({"error": "missing audio"}), 400
    f = request.files["audio"]
    if not f or not f.filename:
        return jsonify({"error": "empty audio"}), 400

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

        # Always normalize via ffmpeg — mobile WebM is often incomplete for PyAV
        if suffix.lower() == ".wav":
            # Still re-encode for consistent sample rate
            wav_path = convert_to_wav(tmp_path)
        else:
            wav_path = convert_to_wav(tmp_path)

        segments, info = get_model().transcribe(
            wav_path,
            language="en",
            vad_filter=True,
            beam_size=1,
        )
        text = " ".join(seg.text.strip() for seg in segments).strip()
        return jsonify(
            {
                "text": text,
                "language": getattr(info, "language", "en"),
            }
        )
    except Exception as exc:  # noqa: BLE001
        traceback.print_exc()
        msg = str(exc)
        if "Invalid data" in msg or "decode" in msg.lower():
            msg = "Could not read the recording — try Mic again and speak clearly"
        return jsonify({"error": msg}), 500
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
            # Slightly slower for clearer tutoring across languages
            if voice.startswith("en-GB"):
                rate = "-8%"
            elif voice.startswith("zh-") or voice.startswith("es-"):
                rate = "-4%"
            else:
                rate = "-5%"
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


if __name__ == "__main__":
    get_model()
    try:
        from waitress import serve

        print(f"[stt] waitress on {HOST}:{PORT} voice={TTS_VOICE}", flush=True)
        serve(app, host=HOST, port=PORT, threads=4)
    except ImportError:
        app.run(host=HOST, port=PORT, threaded=True)
