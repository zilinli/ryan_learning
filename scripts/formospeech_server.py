#!/usr/bin/env python3
"""
FormoSpeech 客家话 TTS sidecar（yourtts-htia-240704）。

POST /tts  JSON {"text":"..."}  → audio/mpeg
GET  /health                     → {"ok":true,"model":"ready|loading"}

环境：
  FORMOSPEECH_SPEAKER   默认 江芮敏（女 / 苗栗）
  FORMOSPEECH_DIALECT   默认 sixian
  FORMOSPEECH_PORT      默认 9876
  FORMOSPEECH_LENGTH_SCALE  语速，默认 1.05（略慢更清晰）
"""
from __future__ import annotations

import hashlib
import io
import os
import re
import sys
import tempfile
import threading
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
SPACE = ROOT / "vendor" / "taiwanese-hakka-tts"
MODEL_ID = "formospeech/yourtts-htia-240704"
VOICE = "formospeech-sixian"

SPEAKER = os.environ.get("FORMOSPEECH_SPEAKER", "江芮敏")
DIALECT = os.environ.get("FORMOSPEECH_DIALECT", "sixian")
G2P_DIALECT = {
    "sixian": "hak_sx",
    "hailu": "hak_hl",
    "dapu": "hak_dp",
    "raoping": "hak_rp",
    "zhaoan": "hak_za",
    "nansixian": "hak_nsx",
}.get(DIALECT, "hak_sx")
PORT = int(os.environ.get("FORMOSPEECH_PORT", "9876"))
LENGTH_SCALE = float(os.environ.get("FORMOSPEECH_LENGTH_SCALE", "1.05"))
CACHE_DIR = Path(os.environ.get("SPARK_DATA_DIR", ROOT / "data")) / "tts-cache"

_model = None
_g2p = None
_np = None
_lock = threading.Lock()
_state = "cold"


def cache_key(text: str, voice: str) -> str:
    return hashlib.sha256(f"{text}\0{voice}".encode("utf-8")).hexdigest()


_DIGIT_ZH = "零一二三四五六七八九"


def normalize_hakka(raw: str) -> str:
    """与 src/lib/hakka-tts-text.ts 对齐：去引号/公式/数字→汉字，避免 formog2p 422。"""
    from opencc import OpenCC

    t = (raw or "").strip()
    if not t:
        return t

    t = re.sub(r"\$\$[\s\S]*?\$\$", " ", t)
    t = re.sub(r"\$[^$]+\$", " ", t)
    t = re.sub(r"\\\([\s\S]*?\\\)", " ", t)
    t = re.sub(r"\\\[[\s\S]*?\\\]", " ", t)
    t = re.sub(r"```[\s\S]*?```", " ", t)
    t = re.sub(r"`([^`]+)`", r"\1", t)
    t = re.sub(r"\*\*([^*]+)\*\*", r"\1", t)
    t = re.sub(r"\*([^*]+)\*", r"\1", t)

    # 「」等是线上 422 主因
    t = re.sub(r"[「」『』【】《》〈〉〔〕〖〗〘〙〚〛]", "", t)
    t = re.sub(r"[“”‘’\"']", "", t)
    t = t.replace("、", "，")
    t = re.sub(r"[…‥]+", "。", t)
    t = re.sub(r"[—–－〜～]+", "，", t)
    t = re.sub(r"[·•∙・]", "", t)

    t = (
        re.sub(r"[!！]+", "！", t)
        .replace("?", "？")
        .replace(",", "，")
        .replace(".", "。")
        .replace(";", "；")
        .replace(":", "：")
    )
    t = re.sub(r"[?？]+", "？", t)
    t = re.sub(r"[,，]+", "，", t)
    t = re.sub(r"[.。]+", "。", t)

    def digits_to_zh(m: re.Match[str]) -> str:
        out = []
        for ch in m.group(0):
            if "０" <= ch <= "９":
                out.append(_DIGIT_ZH[ord(ch) - ord("０")])
            elif ch.isdigit():
                out.append(_DIGIT_ZH[int(ch)])
        return "".join(out)

    t = re.sub(r"[0-9０-９]+", digits_to_zh, t)
    t = (
        t.replace("×", "乘")
        .replace("✕", "乘")
        .replace("✖", "乘")
        .replace("÷", "除")
        .replace("＋", "加")
        .replace("+", "加")
        .replace("＝", "等于")
        .replace("=", "等于")
        .replace("%", "百分之")
        .replace("％", "百分之")
    )
    # 去掉减号单独处理以免破坏「減」字语境：仅 ASCII/全角 hyphen
    t = re.sub(r"[－\-]", "减", t)

    t = re.sub(r"[^\u4e00-\u9fffA-Za-z\s，。！？；：]", " ", t)
    t = OpenCC("s2t").convert(t)
    t = re.sub(r"我(?!們)", "涯", t)
    t = re.sub(r"\s+", " ", t).strip()
    t = re.sub(r"^[，；：\s]+", "", t)
    t = re.sub(r"[，；：\s]+$", "", t)
    return t.strip()


def strip_unknowns(text: str, unknown: list[str]) -> str:
    out = text
    for u in unknown:
        if u:
            out = out.replace(u, "")
    out = re.sub(r"\s+", " ", out).strip()
    out = re.sub(r"^[，；：\s]+", "", out)
    out = re.sub(r"[，；：\s]+$", "", out)
    return out.strip()


def parse_ipa(ipa: str, delete_chars=r"\+\-\|\_", as_space: str = "") -> list[str]:
    text: list[str] = []
    ipa_list = re.split(r"(?<![\d])(?=[\d])|(?<=[\d])(?![\d])", ipa)
    for word in ipa_list:
        if word.isdigit():
            text.append(word)
        else:
            if as_space:
                word = re.sub(r"[{}]".format(as_space), " ", word)
            if delete_chars:
                word = re.sub(r"[{}]".format(delete_chars), "", word)
            word = word.replace("，", " ， ")
            text.extend(word)
    return text


def ensure_model():
    global _model, _g2p, _np, _state
    with _lock:
        if _model is not None:
            return
        _state = "loading"
        if not SPACE.is_dir():
            raise RuntimeError(f"missing Space checkout: {SPACE}")
        sys.path.insert(0, str(SPACE))
        os.chdir(SPACE)

        import numpy as np
        import torch
        import TTS
        from formog2p.hakka import g2p
        from huggingface_hub import snapshot_download
        from replace.tts import ChangedVitsConfig
        from TTS.utils.synthesizer import Synthesizer

        TTS.tts.configs.vits_config.VitsConfig = ChangedVitsConfig
        model_dir = snapshot_download(MODEL_ID)
        cfg_path = os.path.join(model_dir, "config.json")
        with open(cfg_path, "r", encoding="utf-8") as f:
            content = f.read()
        content = content.replace("speakers.pth", os.path.join(model_dir, "speakers.pth"))
        content = content.replace(
            "language_ids.json", os.path.join(model_dir, "language_ids.json")
        )
        content = content.replace(
            "speaker_embs.pth", os.path.join(model_dir, "speaker_embs.pth")
        )
        tmp_cfg = Path(tempfile.gettempdir()) / "formospeech_server_config.json"
        tmp_cfg.write_text(content, encoding="utf-8")
        model = Synthesizer(
            tts_checkpoint=os.path.join(model_dir, "model.pth"),
            tts_config_path=str(tmp_cfg),
            use_cuda=torch.cuda.is_available(),
        )
        model.tts_model.length_scale = LENGTH_SCALE
        _model = model
        _g2p = g2p
        _np = np
        _state = "ready"
        print(f"[formospeech] model ready speaker={SPEAKER} dialect={DIALECT}", flush=True)


def synthesize_mp3(text: str) -> bytes:
    ensure_model()
    assert _model is not None and _g2p is not None and _np is not None
    norm = normalize_hakka(text)
    if not norm:
        raise ValueError("empty text")

    # disk cache under normalized key
    CACHE_DIR.mkdir(parents=True, exist_ok=True)
    out_path = CACHE_DIR / f"{cache_key(norm, VOICE)}.mp3"
    if out_path.exists() and out_path.stat().st_size > 200:
        return out_path.read_bytes()

    with _lock:
        speak = norm
        result = None
        for _attempt in range(4):
            result = _g2p(speak, G2P_DIALECT, include_eng=True)
            unknown = list(getattr(result, "unknown_words", None) or [])
            if not unknown:
                break
            cleaned = strip_unknowns(speak, unknown)
            print(
                f"[formospeech] strip unknowns {unknown!r} -> {cleaned!r}",
                flush=True,
            )
            if not cleaned or cleaned == speak:
                raise ValueError("无法转成客语音素: " + ",".join(unknown))
            speak = cleaned
        else:
            unknown = list(getattr(result, "unknown_words", None) or [])
            raise ValueError("无法转成客语音素: " + ",".join(unknown))

        # cache under final speak text if we had to strip
        if speak != norm:
            out_path = CACHE_DIR / f"{cache_key(speak, VOICE)}.mp3"
            if out_path.exists() and out_path.stat().st_size > 200:
                return out_path.read_bytes()

        parsed = [p.replace(" ", "|") for p in result.pronunciations]
        parsed_ipa = parse_ipa(" ".join(parsed))
        dialect = "sixian" if DIALECT == "nansixian" else DIALECT
        _model.tts_model.length_scale = LENGTH_SCALE
        wav = _model.tts(
            parsed_ipa,
            speaker_name=SPEAKER,
            language_name=dialect,
            split_sentences=False,
        )
        wav = _np.asarray(wav, dtype=_np.float32)
        # clip + int16 for clean encode
        wav = _np.clip(wav, -1.0, 1.0)
        pcm = (wav * 32767.0).astype(_np.int16)
        sr = _model.tts_model.config.audio.sample_rate

    import subprocess
    from scipy.io.wavfile import write as write_wav

    with tempfile.TemporaryDirectory() as td:
        wav_path = Path(td) / "a.wav"
        mp3_path = Path(td) / "a.mp3"
        write_wav(str(wav_path), sr, pcm)
        subprocess.check_call(
            [
                "ffmpeg",
                "-y",
                "-i",
                str(wav_path),
                "-ar",
                "22050",
                "-ac",
                "1",
                "-codec:a",
                "libmp3lame",
                "-b:a",
                "128k",
                str(mp3_path),
            ],
            stdout=subprocess.DEVNULL,
            stderr=subprocess.DEVNULL,
        )
        data = mp3_path.read_bytes()
    if len(data) < 200:
        raise RuntimeError("empty mp3")
    out_path.write_bytes(data)
    return data


def create_app():
    from flask import Flask, jsonify, request, Response

    app = Flask(__name__)

    @app.get("/health")
    def health():
        return jsonify({"ok": True, "model": _state, "speaker": SPEAKER, "dialect": DIALECT})

    @app.post("/tts")
    def tts():
        body = request.get_json(silent=True) or {}
        text = (body.get("text") or "").strip()
        if not text:
            return jsonify({"error": "empty text"}), 400
        try:
            audio = synthesize_mp3(text)
            return Response(audio, mimetype="audio/mpeg")
        except Exception as e:
            return jsonify({"error": str(e)}), 422

    return app


def main():
    # Warm model in background so first request is faster
    def warm():
        try:
            ensure_model()
        except Exception as e:
            print(f"[formospeech] warm failed: {e}", flush=True)

    threading.Thread(target=warm, daemon=True).start()
    app = create_app()
    print(f"[formospeech] listening on 127.0.0.1:{PORT}", flush=True)
    app.run(host="127.0.0.1", port=PORT, threaded=True)


if __name__ == "__main__":
    main()
