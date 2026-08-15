#!/usr/bin/env python3
"""
FormoSpeech 客家话 TTS sidecar（yourtts-htia-240704）。

POST /tts  JSON {"text":"..."}  → audio/mpeg
GET  /health                     → {"ok":true,"model":"ready|loading"}

环境：
  FORMOSPEECH_SPEAKER   默认 江芮敏（女 / 苗栗）
  FORMOSPEECH_DIALECT   默认 sixian
  FORMOSPEECH_PORT      默认 9876
  FORMOSPEECH_LENGTH_SCALE  语速，默认 1.05（自然语速）
  FORMOSPEECH_NOISE_SCALE   解码噪声，默认 0.55（更干净）
  FORMOSPEECH_NOISE_SCALE_DUR 时长预测噪声，默认 0.8（更稳定）
  FORMOSPEECH_CLAUSE_SILENCE_MS  分句静音，默认 100
"""
from __future__ import annotations

import hashlib
import os
import re
import sys
import tempfile
import threading
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
SPACE = ROOT / "vendor" / "taiwanese-hakka-tts"
MODEL_ID = "formospeech/yourtts-htia-240704"
VOICE = "formospeech-sixian-v3"
CACHE_SALT = "hakka-tts-v3"

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
NOISE_SCALE = float(os.environ.get("FORMOSPEECH_NOISE_SCALE", "0.55"))
NOISE_SCALE_DUR = float(os.environ.get("FORMOSPEECH_NOISE_SCALE_DUR", "0.8"))
CLAUSE_SILENCE_MS = int(os.environ.get("FORMOSPEECH_CLAUSE_SILENCE_MS", "100"))
CACHE_DIR = Path(os.environ.get("SPARK_DATA_DIR", ROOT / "data")) / "tts-cache"

_model = None
_g2p = None
_np = None
_lock = threading.Lock()
_state = "cold"
_error: str | None = None

_DIGIT_ZH = "零一二三四五六七八九"

# 与 src/lib/hakka-tts-text.ts 对齐（最长优先）
_HAKKA_LEXICON = [
    ("是不是", "係唔係"),
    ("好不好", "好唔好"),
    ("對不對", "著唔著"),
    ("对不对", "著唔著"),
    ("可不可以", "做得無"),
    ("能不能", "做得唔做得"),
    ("為什麼", "做麼个"),
    ("为什么", "做麼个"),
    ("怎麼樣", "仰般"),
    ("怎么样", "仰般"),
    ("怎麼辦", "仰般辦"),
    ("怎么办", "仰般辦"),
    ("怎麼", "仰般"),
    ("怎么", "仰般"),
    ("什麼", "麼个"),
    ("什么", "麼个"),
    ("哪裏", "哪位"),
    ("哪里", "哪位"),
    ("哪兒", "哪位"),
    ("哪儿", "哪位"),
    ("多少", "幾多"),
    ("沒有", "冇"),
    ("没有", "冇"),
    ("不是", "毋係"),
    ("不會", "毋會"),
    ("不会", "毋會"),
    ("不知道", "毋知"),
    ("不知", "毋知"),
    ("告訴", "講分"),
    ("告诉", "講分"),
    ("我們", "涯等"),
    ("我们", "涯等"),
    ("你們", "你等"),
    ("你们", "你等"),
    ("他們", "佢等"),
    ("他们", "佢等"),
    ("她們", "佢等"),
    ("她们", "佢等"),
    ("可以", "做得"),
    ("一起", "共下"),
    ("非常", "當"),
    ("很好", "當好"),
    ("現在", "這下"),
    ("现在", "這下"),
    ("今天", "今日"),
    ("但是", "毋過"),
    ("可是", "毋過"),
    ("如果", "若係"),
    ("或者", "定係"),
    ("還是", "定係"),
    ("还是", "定係"),
    ("自己", "自家"),
    ("別人", "別儕"),
    ("别人", "別儕"),
    ("誰", "麼儕"),
    ("谁", "麼儕"),
    ("一個", "一隻"),
    ("一个", "一隻"),
    ("這個", "這隻"),
    ("这个", "這隻"),
    ("那個", "該隻"),
    ("那个", "該隻"),
    ("一點", "一滴仔"),
    ("一点", "一滴仔"),
    ("一次", "一擺"),
    ("看看", "看一下"),
    ("試試", "試一下"),
    ("试试", "試一下"),
    ("想想", "想一下"),
    ("走路", "行路"),
    ("吃飯", "食飯"),
    ("吃饭", "食飯"),
    ("同你", "摎你"),
    ("同佢", "摎佢"),
    ("同他", "摎佢"),
    ("同她", "摎佢"),
    ("同涯", "摎涯"),
    ("跟你", "摎你"),
    ("跟佢", "摎佢"),
    ("和他", "摎佢"),
    ("和她", "摎佢"),
    ("和你", "摎你"),
    ("和涯", "摎涯"),
    ("給你", "分你"),
    ("给你", "分你"),
    ("給涯", "分涯"),
    ("给我", "分涯"),
    ("沒", "冇"),
    ("没", "冇"),
    ("嗎", "無"),
    ("吗", "無"),
    ("他", "佢"),
    ("她", "佢"),
    ("它", "佢"),
    ("吃", "食"),
    ("說", "講"),
    ("说", "講"),
    ("傾", "講"),
    ("倾", "講"),
    ("給", "分"),
    ("给", "分"),
    ("和", "摎"),
    ("跟", "摎"),
    ("的", "个"),
]


def cache_key(text: str, voice: str) -> str:
    return hashlib.sha256(f"{CACHE_SALT}\0{text}\0{voice}".encode("utf-8")).hexdigest()


def number_to_zh(n: int) -> str:
    if n < 10:
        return _DIGIT_ZH[n]
    if n < 20:
        return "十" if n == 10 else f"十{_DIGIT_ZH[n % 10]}"
    if n < 100:
        tens, ones = divmod(n, 10)
        return f"{_DIGIT_ZH[tens]}十" + (_DIGIT_ZH[ones] if ones else "")
    if n < 1000:
        hundreds, rest = divmod(n, 100)
        s = f"{_DIGIT_ZH[hundreds]}百"
        if rest == 0:
            return s
        if rest < 10:
            return f"{s}零{_DIGIT_ZH[rest]}"
        return s + number_to_zh(rest)
    if n < 10000:
        thousands, rest = divmod(n, 1000)
        s = f"{_DIGIT_ZH[thousands]}千"
        if rest == 0:
            return s
        if rest < 100:
            return f"{s}零{number_to_zh(rest)}"
        return s + number_to_zh(rest)
    return "".join(_DIGIT_ZH[int(ch)] for ch in str(n))


def replace_numbers(text: str) -> str:
    def dig(m: re.Match[str]) -> str:
        raw = m.group(0)
        ascii_s = "".join(
            chr(ord(ch) - 0xFEE0) if "０" <= ch <= "９" else ch for ch in raw
        )
        if "." in ascii_s:
            a, _, b = ascii_s.partition(".")
            head = number_to_zh(int(a or "0"))
            frac = "".join(_DIGIT_ZH[int(d)] for d in b if d.isdigit())
            return f"{head}點{frac}" if frac else head
        if len(ascii_s) > 6:
            return "".join(_DIGIT_ZH[int(d)] for d in ascii_s if d.isdigit())
        return number_to_zh(int(ascii_s))

    return re.sub(r"[0-9０-９]+(?:\.[0-9０-９]+)?", dig, text)


def apply_lexicon(text: str) -> str:
    t = text
    for frm, to in sorted(_HAKKA_LEXICON, key=lambda x: len(x[0]), reverse=True):
        if frm and frm in t:
            t = t.replace(frm, to)
    t = t.replace("个確", "的確").replace("目个", "目的")
    return t


def normalize_hakka(raw: str) -> str:
    """与 src/lib/hakka-tts-text.ts 对齐。"""
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

    t = re.sub(r"\bA\s*[)）．.]", "甲，", t, flags=re.I)
    t = re.sub(r"\bB\s*[)）．.]", "乙，", t, flags=re.I)
    t = re.sub(r"\bC\s*[)）．.]", "丙，", t, flags=re.I)
    t = re.sub(r"\bD\s*[)）．.]", "丁，", t, flags=re.I)

    t = replace_numbers(t)
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
    t = re.sub(r"[－\-]", "减", t)

    t = re.sub(r"[^\u4e00-\u9fffA-Za-z\s，。！？；：]", " ", t)
    t = OpenCC("s2tw").convert(t)
    t = apply_lexicon(t)
    t = re.sub(r"我(?!們)", "涯", t)
    t = re.sub(r"\s+", " ", t).strip()
    # 模型词表仅含「，」——句读收成逗号以保留停顿
    t = re.sub(r"[。！？；：]+", "，", t)
    t = re.sub(r"，{2,}", "，", t)
    t = re.sub(r"\s*，\s*", "，", t)
    t = re.sub(r"^[，\s]+", "", t)
    t = re.sub(r"[，\s]+$", "", t)
    return t.strip()


def strip_unknowns(text: str, unknown: list[str]) -> str:
    out = text
    for u in unknown:
        if u:
            out = out.replace(u, "")
    out = re.sub(r"\s+", " ", out).strip()
    out = re.sub(r"，{2,}", "，", out)
    out = re.sub(r"^[，\s]+", "", out)
    out = re.sub(r"[，\s]+$", "", out)
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


def apply_sixian_sandhi(tokens: list[str]) -> list[str]:
    """六县腔连读变调（contextual tone sandhi for Sixian Hakka）。

    规则：左向右扫描 IPA token 序列，找到声调数字 token 并对其后的声调应用规则：
      - 24 → 11 / _ [55, 11, 5]   (阴平在去/平/入前变阳平)
      - 31 → 33 / _ [55, 11, 5]   (阴去在去/平/入前变阳去)
    55（去声）、2/5（入声）不变。
    """
    tone_indices = []  # (index_in_tokens, tone_value_as_int)
    for i, tok in enumerate(tokens):
        if tok in ("11", "24", "31", "33", "55", "2", "5", "43", "53", "54", "113", "21"):
            tone_indices.append((i, int(tok)))
    if len(tone_indices) < 2:
        return tokens

    # Work on a copy to avoid mutating the input
    out = list(tokens)
    for idx in range(len(tone_indices) - 1):
        ci, cur_tone = tone_indices[idx]
        ni, next_tone = tone_indices[idx + 1]
        target_tones = {55, 11, 5}
        if cur_tone == 24 and next_tone in target_tones:
            out[ci] = "11"
        elif cur_tone == 31 and next_tone in target_tones:
            out[ci] = "33"
    return out


def clean_ipa_tokens(tokens: list[str]) -> list[str]:
    """只保留模型词表认识的标点（， 与空格）；丢掉 。！？ 避免无停顿连读。

    注意：formog2p/parse_ipa 会把声调数字整段保留（如 '55'/'11'），
    它们是词表里的多字符 token，不能对整段做 ord()。
    """
    out: list[str] = []
    for tok in tokens:
        if not tok:
            continue
        if tok in ("。", "！", "？", "；", "："):
            tok = "，"
        # Drop leftover Han characters; keep IPA letters, tones, punct, space
        if len(tok) == 1 and "\u4e00" <= tok <= "\u9fff":
            continue
        out.append(tok)
    # collapse runs of spaces / commas
    cleaned: list[str] = []
    prev = ""
    for tok in out:
        if tok == " " and prev == " ":
            continue
        if tok == "，" and prev == "，":
            continue
        cleaned.append(tok)
        prev = tok
    while cleaned and cleaned[0] in ("，", " "):
        cleaned.pop(0)
    while cleaned and cleaned[-1] in ("，", " "):
        cleaned.pop()
    return cleaned


def split_clauses(text: str, max_chars: int = 28) -> list[str]:
    """按逗号分句；短句合并到 max_chars，保证多数辅导句有呼吸停顿。"""
    parts = [p.strip() for p in text.split("，") if p.strip()]
    if not parts:
        return [text] if text else []
    # Prefer one clause per comma-separated unit when units are short;
    # only glue when a fragment is tiny (<8) to avoid choppy 1–2 char bursts.
    clauses: list[str] = []
    buf = ""
    for p in parts:
        if not buf:
            buf = p
            continue
        if len(buf) < 8 and len(buf) + 1 + len(p) <= max_chars:
            buf = f"{buf}，{p}"
        else:
            clauses.append(buf)
            buf = p
    if buf:
        clauses.append(buf)
    return clauses


def ensure_model():
    global _model, _g2p, _np, _state, _error
    with _lock:
        if _model is not None:
            return
        _state = "loading"
        _error = None
        try:
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
            _error = None
            print(
                f"[formospeech] model ready speaker={SPEAKER} dialect={DIALECT} "
                f"length_scale={LENGTH_SCALE}",
                flush=True,
            )
        except Exception as e:
            _error = str(e)
            _state = "error"
            raise


def g2p_speak(text: str):
    """Return (speak_text, pronunciations list) after stripping unknowns."""
    assert _g2p is not None
    speak = text
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
    return speak, result.pronunciations


def synth_clause_wav(clause: str):
    assert _model is not None and _np is not None
    speak, pronunciations = g2p_speak(clause)
    parsed = [p.replace(" ", "|") for p in pronunciations]
    raw_tokens = parse_ipa(" ".join(parsed))
    sandhi_tokens = apply_sixian_sandhi(raw_tokens)
    parsed_ipa = clean_ipa_tokens(sandhi_tokens)
    if not parsed_ipa:
        raise ValueError("empty ipa")
    dialect = "sixian" if DIALECT == "nansixian" else DIALECT
    _model.tts_model.length_scale = LENGTH_SCALE
    _model.tts_model.inference_noise_scale = NOISE_SCALE
    _model.tts_model.inference_noise_scale_dp = NOISE_SCALE_DUR
    wav = _model.tts(
        parsed_ipa,
        speaker_name=SPEAKER,
        language_name=dialect,
        split_sentences=False,
    )
    wav = _np.asarray(wav, dtype=_np.float32)
    wav = _np.clip(wav, -1.0, 1.0)
    return wav


def synthesize_mp3(text: str) -> bytes:
    ensure_model()
    assert _model is not None and _g2p is not None and _np is not None
    norm = normalize_hakka(text)
    if not norm:
        raise ValueError("empty text")

    CACHE_DIR.mkdir(parents=True, exist_ok=True)
    out_path = CACHE_DIR / f"{cache_key(norm, VOICE)}.mp3"
    if out_path.exists() and out_path.stat().st_size > 200:
        return out_path.read_bytes()

    with _lock:
        # Try full-text synthesis first (preserves model-internal prosody).
        # Fallback to clause splitting only if text is long or full-text fails.
        try_full = len(norm) <= 60
        if try_full:
            try:
                print(f"[formospeech] synth full text={norm[:80]!r}", flush=True)
                wav = synth_clause_wav(norm)
            except Exception as e:
                print(f"[formospeech] full-text failed: {e}", flush=True)
                try_full = False

        if not try_full:
            clauses = split_clauses(norm)
            print(
                f"[formospeech] synth clauses={len(clauses)} text={norm[:80]!r}",
                flush=True,
            )
            chunks = []
            sr = _model.tts_model.config.audio.sample_rate
            silence = _np.zeros(int(sr * CLAUSE_SILENCE_MS / 1000.0), dtype=_np.float32)
            for i, clause in enumerate(clauses):
                try:
                    wav = synth_clause_wav(clause)
                except Exception as e:
                    print(f"[formospeech] clause fail {clause!r}: {e}", flush=True)
                    if not chunks and len(clauses) == 1:
                        raise
                    continue
                chunks.append(wav)
                if i < len(clauses) - 1:
                    chunks.append(silence)
            if not chunks:
                raise ValueError("all clauses failed")
            wav = _np.concatenate(chunks)

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
                "-q:a",
                "0",
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
        ready = _state == "ready" and _model is not None
        return jsonify(
            {
                "ok": ready,
                "model": _state,
                "error": _error,
                "speaker": SPEAKER,
                "dialect": DIALECT,
                "voice": VOICE,
                "length_scale": LENGTH_SCALE,
                "noise_scale": NOISE_SCALE,
                "noise_scale_dur": NOISE_SCALE_DUR,
                "clause_silence_ms": CLAUSE_SILENCE_MS,
            }
        ), (200 if ready or _state in ("loading", "cold") else 503)

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
    def warm():
        global _state, _error
        try:
            ensure_model()
        except Exception as e:
            _error = str(e)
            _state = "error"
            print(f"[formospeech] warm failed: {e}", flush=True)

    threading.Thread(target=warm, daemon=True).start()
    app = create_app()
    print(f"[formospeech] listening on 127.0.0.1:{PORT}", flush=True)
    app.run(host="127.0.0.1", port=PORT, threaded=True)


if __name__ == "__main__":
    main()
