#!/usr/bin/env python3
"""
离线预合成 FormoSpeech 客家话到 Spark TTS 缓存（高质量路径）。

- 简体→繁体（OpenCC）+ 我→涯
- 未知字直接失败（不再丢字硬合成 → 怪声）
- int16 wav + 128k mp3
- 默认语者：江芮敏

用法见脚本头 / docs/subsystems/formospeech-hakka-tts.md
"""
from __future__ import annotations

import argparse
import hashlib
import json
import os
import re
import subprocess
import sys
import tempfile
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
SPACE = ROOT / "vendor" / "taiwanese-hakka-tts"
VOICE = "formospeech-sixian-v2"
MODEL_ID = "formospeech/yourtts-htia-240704"
DIALECT = "sixian"
G2P_DIALECT = "hak_sx"
SPEAKER_NAME = os.environ.get("FORMOSPEECH_SPEAKER", "江芮敏")
LENGTH_SCALE = float(os.environ.get("FORMOSPEECH_LENGTH_SCALE", "1.12"))
CACHE_SALT = "hakka-tts-v2"


def cache_key(text: str, voice: str) -> str:
    return hashlib.sha256(f"{CACHE_SALT}\0{text}\0{voice}".encode("utf-8")).hexdigest()


_DIGIT_ZH = "零一二三四五六七八九"


def normalize_hakka(raw: str) -> str:
    """与 formospeech_server / hakka-tts-text.ts 对齐。"""
    from opencc import OpenCC

    t = (raw or "").strip()
    if not t:
        return t
    t = re.sub(r"\$\$[\s\S]*?\$\$", " ", t)
    t = re.sub(r"\$[^$]+\$", " ", t)
    t = re.sub(r"[「」『』【】《》〈〉〔〕〖〗]", "", t)
    t = re.sub(r"[“”‘’\"']", "", t)
    t = t.replace("、", "，")
    t = (
        re.sub(r"[!！]+", "！", t)
        .replace("?", "？")
        .replace(",", "，")
        .replace(".", "。")
    )

    def digits_to_zh(m: re.Match[str]) -> str:
        return "".join(
            _DIGIT_ZH[ord(ch) - ord("０")]
            if "０" <= ch <= "９"
            else _DIGIT_ZH[int(ch)]
            for ch in m.group(0)
            if ch.isdigit() or ("０" <= ch <= "９")
        )

    t = re.sub(r"[0-9０-９]+", digits_to_zh, t)
    t = re.sub(r"[^\u4e00-\u9fffA-Za-z\s，。！？；：]", " ", t)
    t = OpenCC("s2t").convert(t)
    t = re.sub(r"我(?!們)", "涯", t)
    t = re.sub(r"\s+", " ", t).strip()
    return t.strip()


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


def load_synthesizer():
    if not SPACE.is_dir():
        raise SystemExit(f"缺少 Space：{SPACE}")
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
    with open(os.path.join(model_dir, "config.json"), "r", encoding="utf-8") as f:
        content = f.read()
    content = content.replace("speakers.pth", os.path.join(model_dir, "speakers.pth"))
    content = content.replace(
        "language_ids.json", os.path.join(model_dir, "language_ids.json")
    )
    content = content.replace(
        "speaker_embs.pth", os.path.join(model_dir, "speaker_embs.pth")
    )
    tmp_cfg = Path(tempfile.gettempdir()) / "formospeech_temp_config.json"
    tmp_cfg.write_text(content, encoding="utf-8")
    model = Synthesizer(
        tts_checkpoint=os.path.join(model_dir, "model.pth"),
        tts_config_path=str(tmp_cfg),
        use_cuda=torch.cuda.is_available(),
    )
    model.tts_model.length_scale = LENGTH_SCALE
    return model, g2p, np


def main() -> None:
    ap = argparse.ArgumentParser()
    ap.add_argument("--phrases", type=Path, required=True)
    ap.add_argument("--out-data-dir", type=Path, default=ROOT / "data")
    ap.add_argument("--force", action="store_true", help="overwrite existing cache")
    args = ap.parse_args()

    phrases = json.loads(args.phrases.read_text(encoding="utf-8"))
    # Absolute path: load_synthesizer() chdirs into vendor/taiwanese-hakka-tts.
    cache_dir = (args.out_data_dir / "tts-cache").resolve()
    cache_dir.mkdir(parents=True, exist_ok=True)

    print("Loading FormoSpeech...", flush=True)
    model, g2p, np = load_synthesizer()
    from scipy.io.wavfile import write as write_wav

    ok = skip = fail = 0
    for raw in phrases:
        text = normalize_hakka(str(raw))
        if not text:
            continue
        out = cache_dir / f"{cache_key(text, VOICE)}.mp3"
        if not args.force and out.exists() and out.stat().st_size > 200:
            print(f"SKIP {text!r}")
            skip += 1
            continue
        try:
            result = g2p(text, G2P_DIALECT, include_eng=True)
            if result.unknown_words:
                raise ValueError(f"unknown words: {result.unknown_words}")
            parsed = [p.replace(" ", "|") for p in result.pronunciations]
            parsed_ipa = parse_ipa(" ".join(parsed))
            model.tts_model.length_scale = LENGTH_SCALE
            wav = model.tts(
                parsed_ipa,
                speaker_name=SPEAKER_NAME,
                language_name=DIALECT,
                split_sentences=False,
            )
            wav = np.clip(np.asarray(wav, dtype=np.float32), -1.0, 1.0)
            pcm = (wav * 32767.0).astype(np.int16)
            sr = model.tts_model.config.audio.sample_rate
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
                        "-b:a",
                        "128k",
                        str(mp3_path),
                    ],
                    stdout=subprocess.DEVNULL,
                    stderr=subprocess.DEVNULL,
                )
                out.write_bytes(mp3_path.read_bytes())
            print(f"OK   {text!r} -> {out.stat().st_size}B")
            ok += 1
        except Exception as e:
            print(f"FAIL {text!r}: {e}")
            fail += 1

    print(f"Done ok={ok} skip={skip} fail={fail} speaker={SPEAKER_NAME}")
    if fail and not ok:
        sys.exit(1)


if __name__ == "__main__":
    main()
