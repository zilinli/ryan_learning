#!/usr/bin/env python3
"""
离线预合成 FormoSpeech 客家话（yourtts-htia-240704）到 Spark TTS 缓存。

建议在停 Spark 或另机运行（模型 ~970MB，4GB 机器与生产并存易 OOM）。

用法（需 Python ≥3.10，推荐 uv）：
  cd /root/codes/ryan_learning
  git clone --depth 1 https://huggingface.co/spaces/united-link/taiwanese-hakka-tts vendor/taiwanese-hakka-tts
  uv python install 3.11
  uv venv .venv-formospeech --python 3.11
  . .venv-formospeech/bin/activate
  uv pip install torch torchaudio --index-url https://download.pytorch.org/whl/cpu
  uv pip install TTS==0.22.0 omegaconf formog2p scipy numpy huggingface_hub
  python scripts/formospeech_presynth.py --phrases scripts/formospeech_phrases_hak.json

缓存 key 与 Node `ttsCacheKey(text, "formospeech-sixian")` 一致。
"""
from __future__ import annotations

import argparse
import hashlib
import json
import os
import re
import sys
import tempfile
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
SPACE = ROOT / "vendor" / "taiwanese-hakka-tts"
VOICE = "formospeech-sixian"
MODEL_ID = "formospeech/yourtts-htia-240704"
DIALECT = "sixian"
G2P_DIALECT = "hak_sx"
SPEAKER_NAME = "XF"


def cache_key(text: str, voice: str) -> str:
    return hashlib.sha256(f"{text}\0{voice}".encode("utf-8")).hexdigest()


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
        raise SystemExit(
            f"缺少 Space 代码：{SPACE}\n"
            "请先：git clone https://huggingface.co/spaces/united-link/taiwanese-hakka-tts vendor/taiwanese-hakka-tts"
        )
    sys.path.insert(0, str(SPACE))
    os.chdir(SPACE)

    import numpy as np
    import torch
    import TTS
    from formog2p.hakka import g2p
    from huggingface_hub import snapshot_download
    from TTS.utils.synthesizer import Synthesizer
    from replace.tts import ChangedVitsConfig

    TTS.tts.configs.vits_config.VitsConfig = ChangedVitsConfig

    model_dir = snapshot_download(MODEL_ID)
    config_file_path = os.path.join(model_dir, "config.json")
    model_ckpt_path = os.path.join(model_dir, "model.pth")
    speaker_file_path = os.path.join(model_dir, "speakers.pth")
    language_file_path = os.path.join(model_dir, "language_ids.json")
    speaker_embedding_file_path = os.path.join(model_dir, "speaker_embs.pth")

    with open(config_file_path, "r", encoding="utf-8") as f:
        content = f.read()
    content = content.replace("speakers.pth", speaker_file_path)
    content = content.replace("language_ids.json", language_file_path)
    content = content.replace("speaker_embs.pth", speaker_embedding_file_path)

    tmp_cfg = Path(tempfile.gettempdir()) / "formospeech_temp_config.json"
    tmp_cfg.write_text(content, encoding="utf-8")

    model = Synthesizer(
        tts_checkpoint=model_ckpt_path,
        tts_config_path=str(tmp_cfg),
        use_cuda=torch.cuda.is_available(),
    )
    return model, g2p, np


def wav_to_mp3(wav_path: Path, mp3_path: Path) -> None:
    import subprocess

    subprocess.check_call(
        [
            "ffmpeg",
            "-y",
            "-i",
            str(wav_path),
            "-codec:a",
            "libmp3lame",
            "-qscale:a",
            "4",
            str(mp3_path),
        ],
        stdout=subprocess.DEVNULL,
        stderr=subprocess.DEVNULL,
    )


def main() -> None:
    ap = argparse.ArgumentParser()
    ap.add_argument("--phrases", type=Path, required=True)
    ap.add_argument("--out-data-dir", type=Path, default=ROOT / "data")
    ap.add_argument("--skip-existing", action="store_true", default=True)
    args = ap.parse_args()

    phrases = json.loads(args.phrases.read_text(encoding="utf-8"))
    if not isinstance(phrases, list) or not phrases:
        raise SystemExit("phrases json must be a non-empty string array")

    cache_dir = args.out_data_dir / "tts-cache"
    cache_dir.mkdir(parents=True, exist_ok=True)

    print("Loading FormoSpeech model (may take a while / ~1GB download)...", flush=True)
    model, g2p, np = load_synthesizer()
    from scipy.io.wavfile import write as write_wav

    ok = 0
    skip = 0
    fail = 0
    for text in phrases:
        text = str(text).strip()
        if not text:
            continue
        out = cache_dir / f"{cache_key(text, VOICE)}.mp3"
        if args.skip_existing and out.exists() and out.stat().st_size > 100:
            print(f"SKIP {text!r}")
            skip += 1
            continue
        try:
            result = g2p(text, G2P_DIALECT, include_eng=True)
            if getattr(result, "unknown_words", None):
                print(f"WARN unknown words for {text!r}: {result.unknown_words}")
            parsed = [p.replace(" ", "|") for p in result.pronunciations]
            parsed_ipa = parse_ipa(" ".join(parsed))
            wav = model.tts(
                parsed_ipa,
                speaker_name=SPEAKER_NAME,
                language_name=DIALECT,
                split_sentences=False,
            )
            wav = np.asarray(wav, dtype=np.float32)
            sr = model.tts_model.config.audio.sample_rate
            with tempfile.TemporaryDirectory() as td:
                wav_path = Path(td) / "a.wav"
                mp3_path = Path(td) / "a.mp3"
                write_wav(str(wav_path), sr, wav)
                wav_to_mp3(wav_path, mp3_path)
                out.write_bytes(mp3_path.read_bytes())
            print(f"OK   {text!r} -> {out.name} ({out.stat().st_size} bytes)")
            ok += 1
        except Exception as e:
            print(f"FAIL {text!r}: {e}")
            fail += 1

    print(f"Done ok={ok} skip={skip} fail={fail} voice={VOICE} dir={cache_dir}")
    if fail and not ok:
        sys.exit(1)


if __name__ == "__main__":
    main()
