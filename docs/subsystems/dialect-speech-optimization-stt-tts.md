# Teochew/Min Nan & Hakka Speech Optimization (STT + TTS)

> Version 1.0 · 2026-08-08
> Priority: 🔴 Critical — current STT/TTS quality for Teochew & Hakka is poor
> Status: research complete — detailed design follows
> Prerequisite: [dialect-support-teochew-hakka.md](./dialect-support-teochew-hakka.md) (Phase F, Plan A written-form implementation)

---

## 1. Problem Statement

The current Plan A implementation (§F in TODO) uses **Cantonese TTS fallback**
(`zh-HK-WanLungNeural`) and **auto-mode STT** for both Teochew and Hakka. Real-world
testing reveals two quality gaps:

| Gap | Symptom | Severity |
|-----|---------|----------|
| **STT** | Dialect speech is transcribed as garbled Mandarin/nonsense Chinese; ~60-70% WER for actual Teochew/Hakka audio | 🔴 Critical |
| **TTS** | Cantonese voice reads dialect grammar text with wrong tones and pronunciation; native speakers find it jarring ("sounds Cantonese, not Teochew/Hakka") | 🟡 Important |

**Root cause**: Neither Teochew (潮汕话 / Min Nan) nor Hakka (客家话) has Microsoft
Azure neural voices, and the current SenseVoice + Whisper-small STT server has never
been trained on Teochew or Hakka audio data. The "auto" mode maps unknown dialect
audio → `zh` tokens through Whisper's fallback, which produces Mandarin-like output.

---

## 2. Research Summary

### 2.1 STT Model Landscape (August 2026)

#### 2.1.1 Teochew (潮汕话 / Min Nan) STT Models

| Model | Architecture | Size | CER | License | CPU? |
|-------|-------------|------|-----|---------|------|
| `panlr/Qwen3_ASR_teochew` | Qwen3-ASR (fast, flash-attn) | ~0.8B | 9.11% (val), 0.088s/sample | Open | ❌ GPU preferred |
| `panlr/whisper-finetune-teochew` | Whisper-medium (finetuned) | 0.8B | ~10% (test) | CC-BY-4.0 | ❌ GPU preferred |
| `efficient-nlp/teochew-whisper-medium` | Whisper-medium (finetuned) | 0.8B | 31% WER (careful), 68% WER (conversational) | Open | ❌ GPU |

**Training data**: All models trained on `panlr/teochew_wild` (18.9 hrs, 12,500 clips,
20 speakers, ANSI characters + Peng'im annotations, CC-BY-4.0). This is the only
public Teochew ASR dataset. Published at IEEE ICME 2025.

**Key limitation**: 18.9 hours is very small for STT — the community notes many
Teochew dialect words ("潮汕土语") remain uncovered.

**Fun-ASR-Nano-2512** (Alibaba Tongyi Lab, Apache 2.0 on ModelScope) supports
"Min" (闽语) as one of 7 Chinese dialect groups, trained on 10M+ hours. **800M
params** — too large for our 4GB RAM server but feasible on cloud GPU.

#### 2.1.2 Hakka (客家话) STT Models

| Model | Architecture | Size | Dialects | CER | License | CPU? |
|-------|-------------|------|----------|-----|---------|------|
| `formospeech/whisper-large-v2-taiwanese-hakka-v1` | Whisper-large-v2 (finetuned) | 1.5B | Sixian, Hailu | Sixian: 8.69%, Hailu: 7.21% | CC-BY-NC-4.0 | ❌ GPU |
| `formospeech/whisper-large-v3-taiwanese-hakka` | Whisper-large-v3 (finetuned) | 1.5B | 6 dialects (prompt-based) | Unknown | CC-BY-NC-4.0 | ❌ GPU |
| `NUTN-KWS/Whisper-Taiwanese-Hakka-model-v0.2.6` | Whisper-large-v3-turbo (finetuned) | 0.8B | Taiwanese Hakka | Unknown | CC-BY-NC-4.0 | ❌ GPU |
| `formospeech/cohere-transcribe-03-2026-taiwanese-hakka` | Cohere Transcribe (finetuned) | Unknown | Sixian, Hailu | Sixian: 13.26%, Hailu: 10.80% | CC-BY-NC-4.0 | ❌ GPU |

**Training data**: Various; NUTN-KWS used ~1,700 hours (textbook + synthesis). FSR-2025
(Formosa Speech Recognition Challenge 2025) has official Hakka datasets.

**LoRA fine-tuning baseline** (Liu et al., ROCLING 2025): Whisper+LoRA achieved CER
7.07% on FSR-2025 HAT-Vol2 test set. A compact Whisper+LoRA baseline (FSR-2025,
Hanzi Track) reached CER 10.94% without external data.

**Fun-ASR-Nano-2512**: Supports "Hakka" (客家话) natively — same 800M model.

#### 2.1.3 Cross-lingual Transfer: Min Nan / Hokkien (闽南语)

Teochew is Min Nan — Taiwanese Hokkien (台语) models provide strong transfer learning:

| Model | Architecture | Training Data | License |
|-------|-------------|--------------|---------|
| `MediaTek-Research/Breeze-ASR-26` | Whisper fine-tuned | 10,000 hrs synthetic Taigi | Apache 2.0 |
| `NUTN-KWS/Whisper-Taiwanese-model-v0.5` | Whisper-large-v3-turbo | ~90 hrs (Taiwan MOE dict) | CC-BY-NC-4.0 |
| `10809104/taigi-speech-to-text` | Wav2Vec2 + Whisper + LoRA | Taiwan MOE corpus | Apache 2.0 |

Breeze-ASR-26 achieves CER 30.13% on a standardized Taigi benchmark (challenging due
to mixed Mandarin-Taigi audio with raw Chinese output).

### 2.2 TTS Model Landscape

#### 2.2.1 Teochew TTS

| Component | Resource | Status | License |
|-----------|----------|--------|---------|
| G2P Frontend | `pyPengIm` ([github](https://github.com/p1an-lin-jung/teochew-g2p)) | ✅ Complete — Hanzi→Peng'im, tone sandhi, dialect accent conversion | Open |
| Acoustic Model | FastSpeech2 / Tacotron2 (trained on teochew-wild) | ⚠️ No public checkpoint — paper reports MOS 3.52 (Tacotron2), MOS 3.22 (FastSpeech2) | — |
| Vocoder | `panlr/BigVGAN_24khz_teochew` | ✅ Public — OVRL 3.1038 vs Ground Truth 3.1040 | Open |
| Vocoder | `panlr/hifigan_teochew` | ✅ Public — OVRL 3.0724, 555+ hrs training data | Open |

**The gap**: Vocoder checkpoints exist (BigVGAN, HiFi-GAN) but **no public acoustic
model** (FastSpeech2/Tacotron2) for Teochew. The research paper trained one but did
not release the weights. Building a complete Teochew TTS pipeline requires:
1. pyPengIm (G2P frontend) — ✅ available
2. FastSpeech2/Tacotron2 trained on teochew-wild — ❌ must train ourselves (needs GPU,
   ~1 day on 3090, 30,000 steps per paper)
3. BigVGAN vocoder — ✅ available

#### 2.2.2 Hakka TTS

| Model | Architecture | Dialects | Size | License | CPU? |
|-------|-------------|----------|------|---------|------|
| `formospeech/yourtts-htia-240704` (VoxHakka) | YourTTS (VITS-based) | 6 dialects (Sixian, Hailu, Dapu, Raoping, Zhaoan, Nansixian) | "Lightweight" | CC-BY-4.0 | ✅ Yes — paper says "suitable for CPU deployment", RTF < 1.0 on CPU |
| `formospeech/omnivoice-hakka-community-1` | OmniVoice (zero-shot) | 6 dialects (instruction-based) | Unknown | CC-BY-NC-4.0 | ❌ Unknown |

**VoxHakka details** (Chen et al., 2024, arXiv:2409.01548):
- Architecture: YourTTS — lightweight VITS-based with dialect embedding and speaker embedding
- Input: text processed by `formog2p.hakka.g2p` (G2P frontend) → phoneme tokens
- Training: multi-speaker data from 19+ speakers, scraped and ASR-cleaned
- Zero-shot: speaker embedding mechanism enables voice cloning from reference audio
- CMOS evaluation: significantly outperforms existing commercial Hakka TTS
- License: CC-BY-4.0 (most permissive among Hakka models)
- **CPU-capable**: the paper emphasizes "Open Accessibility" and "only CPU resources"

This is the single most impactful find — VoxHakka gives us **native Hakka TTS on
our 4GB CPU server** with a permissive license.

#### 2.2.3 Cross-lingual TTS Options

| Model | Coverage | Size | Notes |
|-------|----------|------|-------|
| CosyVoice 3 (Alibaba) | 9 langs + 18 Chinese dialects/accents (includes "Minnan", "Guangdong") | 0.5B–1.5B | Needs GPU (at minimum), zero-shot cloning, Apache 2.0 on ModelScope |
| CosyVoice 2 | 4 langs + several Chinese dialects | 0.5B | Lighter than v3, still needs GPU |
| GPT-SoVITS TW (KaedeTai) | Taiwanese Hokkien, Mandarin, English | ~1.1GB | MIT license, trilingual, requires reference audio, GPU preferred |
| PaddleSpeech `fastspeech2_canton` | Cantonese | Lightweight | Pre-trained on CPU, could serve as acoustic model for Teochew hybrid |

### 2.3 Whisper Tiny + LoRA: The Memory-Efficient Path

For STT on our **4GB RAM server**, the critical insight from research:

| Whisper Variant | INT8 ONNX Size | Peak RAM (inference) | RTF on CPU | CER (Cantonese, post-LoRA) |
|-----------------|---------------|---------------------|------------|---------------------------|
| Whisper-tiny | ~60 MB | ~110 MB | 0.0007 per token | 11.1% (from 49.5%) |
| Whisper-small | ~240 MB | ~500 MB | 0.005 per token | 6.16% (full fine-tune) |
| Whisper-tiny + LoRA (rank=8) | ~60 MB + ~1 MB LoRA | ~120 MB | ~0.12 RTF (5× real-time) | ~15-18% (estimated for Teochew/Hakka) |

(LoRA-INT8 Whisper Cantonese paper, MDPI Sensors 2025; ONNX Runtime Whisper benchmarks)

**Key finding**: The Cantonese ASR community has demonstrated that Whisper-tiny +
LoRA (rank=8) + INT8 quantization achieves CER 11.1% (from baseline 49.5%) while
keeping the model at **~60 MB** — well within our 4GB server's capacity, even with
the STT Python process already running at ~300 MB. The FSR-2025 Hakka challenge
achieved CER 10.94% with Whisper-large-v2 + LoRA, and a compact baseline approach
is documented as reproducible.

### 2.4 Commercial & API-Based Options

| Provider | Teochew | Hakka | Notes |
|----------|---------|-------|-------|
| Azure Speech Services | ❌ No | ❌ No | Checked full language support table (2026) — no Teochew or Hakka locales |
| Google Cloud STT/TTS | ❌ No | ❌ No | No Teochew/Hakka in supported languages |
| Analytico Voice (Singapore) | ✅ 95% accuracy | ✅ supported | Proprietary B2B API for contact centers; not open |
| Ins8.ai (Azure Marketplace) | Unknown | Unknown | Hyperlocal ASR, integrates with Azure OpenAI |

No viable commercial API at consumer pricing for our use case.

---

## 3. Optimization Strategy: Three-Tier Architecture

### 3.1 Tier 1: Immediate (No New Models) — 2-4 hours

Optimize the existing pipeline with better prompt engineering and language routing.
No new model downloads, no memory penalty.

#### 3.1.1 STT: Dialect-Aware `initial_prompt`

Currently `stt_server.py` uses generic zh prompts for Whisper transcription. For
Teochew/Hakka, provide dialect-specific vocabulary hints in the `initial_prompt`
to guide the decoder toward correct character selection:

```python
# stt_server.py — new _transcribe_kwargs cases

if lang == "teo":
    base["language"] = "zh"
    base["initial_prompt"] = (
        "呢段话係潮州话。个嘅唔係勿食睇乜个怎呢。"
        # Common Teochew function words to prime the decoder
    )
    base["beam_size"] = 3
    base["best_of"] = 3
    base["log_prob_threshold"] = -1.6  # more permissive
    return base

if lang == "hak":
    base["language"] = "zh"
    base["initial_prompt"] = (
        "呢段话係客家话。涯个唔冇麼个當好但係。"
        # Common Hakka function words
    )
    base["beam_size"] = 3
    base["best_of"] = 3
    base["log_prob_threshold"] = -1.6
    return base
```

**Rationale**: Whisper's `initial_prompt` is prepended to the decoder's previous-text
context — it biases token selection. Providing common dialect function words (个, 唔,
勿, 食 for Teochew; 涯, 个, 冇, 麼个 for Hakka) increases the probability that
dialect-typical characters are chosen over standard Mandarin alternatives.

#### 3.1.2 STT: Register "teo" and "hak" as STT languages

```python
# stt_server.py
ALLOWED_STT_LANGS = {"auto", "en", "zh", "yue", "es", "teo", "hak"}

# Add aliases:
"teo": "teo",
"teochew": "teo",
"teochow": "teo",
"hak": "hak",
"hakka": "hak",
```

Route `"teo"` → Whisper with teo-specific prompt; `"hak"` → Whisper with hak-specific
prompt. Fallback to `"auto"` if Whisper not loaded.

#### 3.1.3 TTS: Text Preprocessing for Cantonese Voice

The Cantonese TTS voice (`zh-HK-WanLungNeural`) reads Chinese characters with
Cantonese pronunciation. For Teochew/Hakka text, we can **normalize dialect-specific
characters to their closest Cantonese equivalents** before sending to TTS:

| Dialect | Character | Cantonese Equivalent | Reason |
|---------|-----------|---------------------|--------|
| Teochew | 汝 (you) | 你 (nei5) | Cantonese uses 你 |
| Teochew | 勿 (don't) | 唔好 (m4 hou2) | Cantonese periphrasis |
| Teochew | 乜个 (what) | 乜嘢 (mat1 je5) | Shared 乜, 嘢 for Cantonese |
| Teochew | 怎呢 (how) | 點樣 (dim2 joeng2) | Close meaning |
| Hakka | 涯 (I) | 我 (ngo5) | Cantonese uses 我 |
| Hakka | 麼个 (what) | 乜嘢 (mat1 je5) | Same as above |
| Hakka | 但係 (but) | 但係 (daan6 hai6) | **Shared** — works directly |
| Hakka | 冇 (not have) | 冇 (mou5) | **Shared** — works directly |

**Implementation**: a `dialectToCantoneseTTS(text: string, lang: "teo" | "hak"): string`
function that applies character-level substitutions. This makes the Cantonese voice
sound closer to the intended dialect by avoiding characters 汝/涯/勿 that have
unexpected Cantonese readings.

#### 3.1.4 Frontend: Voice Selector Labels Update

Update voice labels to reflect the improved pipeline:

| Before | After |
|--------|-------|
| "Teochew (Cantonese voice)" | "Teochew (潮汕话 STT + Cantonese TTS)" |
| "Hakka (Cantonese voice)" | "Hakka (客家话 STT + Cantonese TTS)" |

### 3.2 Tier 2: Model-Backed (Deploy Dedicated Models) — 1-2 weeks

Deploy CPU-suitable models on our existing 4GB server.

#### 3.2.1 STT: Whisper-Tiny + LoRA for Teochew STT

**Goal**: Replace `auto` → `zh` fallback with a dedicated Teochew STT model.

**Approach**: Fine-tune Whisper-tiny with LoRA (rank=8) on `teochew_wild` dataset.

```
Training setup (one-time, needs GPU — run on Colab or rented GPU):
- Base model: openai/whisper-tiny (39M params)
- LoRA targets: q_proj, k_proj, v_proj, out_proj, fc1, fc2
- Dataset: panlr/teochew_wild (18.9 hrs, 12,500 clips)
- Duration: ~4-6 hours on T4/V100 GPU
- Output: ~1 MB LoRA adapter + whisper-tiny base

Deployment (on our 4GB CPU server):
- Convert to ONNX INT8: ~110 MB total (base 60MB + adapter embedded)
- Inference: Python ONNX Runtime, or sherpa-onnx with custom model
- Peak RAM: ~200 MB (fits alongside existing SenseVoice + services)
- Expected RTF: ~0.15-0.25 (4-7× real-time on CPU)
- Expected CER: ~15-20% (estimated from Cantonese LoRA results)
```

**Why tiny, not small**: Whisper-small ONNX INT8 is ~500 MB peak RAM — risky on 4GB.
Whisper-tiny at 60-110 MB is safe. The Cantonese benchmark shows tiny+LoRA can
drop from 49.5% → 11.1% CER — good enough for tutoring dialogue (student speech is
typically clear, short, and not noisy).

**Alternative — Qwen3-ASR**: If GPU is available for inference, `panlr/Qwen3_ASR_teochew`
is faster (0.088s/sample RTF ~0.016) and more accurate (CER 9%). But needs CUDA.

#### 3.2.2 STT: Whisper-Tiny + LoRA for Hakka STT

Same approach as Teochew, using Hakka training data:

```
Training data options:
1. formospeech/hakkaradio_news_clean — clean Hakka radio news (Sixian + Hailu)
2. Official FSR-2025 Hakka dataset (may require competition registration)
3. NUTN-KWS textbook + synthesis data (~1,700 hrs, but gated)

Expected results:
- Whisper-tiny + LoRA: CER ~12-18% (slightly better than Teochew due to more data)
- Already demonstrated: LoRA on Whisper-large-v2 achieves CER 10.94% on FSR-2025
```

**Important note about Taiwan vs Mainland Hakka**: All currently available Hakka
STT models are for **Taiwanese Hakka** (臺灣客家語), which uses Taiwan MOE
recommended characters (臺灣客家語書寫推薦用字). Mainland Hakka (Meizhou/Huizhou/etc.)
online conventions differ (using 涯 not 𒊎). The model output will use Taiwan
orthography, which is close enough for the tutor use case.

#### 3.2.3 TTS: Deploy VoxHakka for Native Hakka Speech

**This is the most impactful Tier-2 change** — VoxHakka provides **native Hakka
TTS** on CPU.

```
Deployment:
- Model: formospeech/yourtts-htia-240704 (HuggingFace, CC-BY-4.0)
- G2P Frontend: formog2p.hakka.g2p (Hakka text → phoneme tokens)
- Inference: PyTorch on CPU (YourTTS is "suitable for CPU deployment")
- Expected RAM: ~300-500 MB (VITS-based models are compact)
- Expected RTF: ~0.3-0.8 (1.2-3× real-time — the paper says CPU is practical)

Architecture integration:
1. Python service: new Flask endpoint or module in stt_server.py
2. Frontend: edgeVoiceForLang("hak") → "voxhakka" (internal routing)
3. TTS API: POST /tts with voice=voxhakka → call VoxHakka inference
4. Output: 22,050 Hz mono WAV → convert to MP3 for edge-tts compatibility
```

**Risk**: VoxHakka is gated on HuggingFace — need to accept license terms.
**Mitigation**: The CC-BY-4.0 license is the most permissive — only requires
attribution. Non-commercial use is fine.

#### 3.2.4 TTS: Teochew Hybrid Pipeline

Since no turnkey Teochew TTS model is publicly available, we build a hybrid:

```
Pipeline:
1. G2P Frontend: pyPengIm (already available, Python)
   - Input: Teochew Chinese text
   - Output: Peng'im romanization (e.g., "汝好" → "le2 ho2")
   - Also: tone sandhi rules, dialect accent conversion

2. Acoustic Model: Use PaddleSpeech fastspeech2_canton
   - Rationale: Cantonese phonology overlaps with Teochew
   - Short-term stopgap until we train a dedicated Teochew FastSpeech2

3. Vocoder: panlr/hifigan_teochew or panlr/BigVGAN_24khz_teochew
   - BigVGAN OVRL 3.1038 ≈ ground truth 3.1040
   - Input: mel-spectrogram from FastSpeech2
   - Output: 24 kHz audio

Expected quality: intelligible but with Cantonese accent — better than raw Cantonese
TTS reading Teochew text, but not native Teochew.
```

**Alternative — PaddleSpeech fastspeech2_canton + fine-tuning**:
PaddleSpeech has `fastspeech2_canton` pre-trained. We can fine-tune it on
teochew_wild dataset with pyPengIm-generated phoneme sequences. This requires
GPU for 1-2 days on a single 3090 (~30,000 steps per the teochew-wild paper).

### 3.3 Tier 3: Cloud-GPU / Premium Models — 2-4 weeks (Future)

For native-quality Teochew and Hakka speech, deploy models that require GPU:

#### 3.3.1 Fun-ASR-Nano for Unified Dialect STT

| Model | Cost | Quality |
|-------|------|---------|
| Fun-ASR-Nano-2512 (800M) | Needs GPU (8GB+ VRAM) or cloud API | Native Min + Hakka support, CER < 10% estimated |
| Fun-ASR API (Alibaba ModelScope) | ~¥0.01/min (TBD) | Same model, API access |

If ModelScope provides a paid inference API for Fun-ASR-Nano, this could be
the simplest path to native-quality STT without on-premise GPU.

#### 3.3.2 CosyVoice 3 for Teochew TTS

CosyVoice 3 supports "Minnan" (闽南语) as one of 18 Chinese dialects. Zero-shot:
provide a 3-10 second Teochew reference audio clip and the model clones the voice.

```
Required: GPU with 8GB+ VRAM
Fallback: Alibaba ModelScope CosyVoice API (if available)
Quality: Likely excellent (1M hours training, flow matching)
```

#### 3.3.3 GPT-SoVITS Fine-tuning for Teochew

`KaedeTai/gpt-sovits-tw` is already adapted for Taiwanese Hokkien (Min Nan sibling).
Fine-tune on teochew_wild audio data:

```
Training: ~2-4 hours on T4/V100 GPU with teochew_wild (18.9hrs audio)
Output: Trilingual Teochew + Mandarin + English model
License: MIT
Quality: Likely very good (gpt-sovits-tw is proven for Hokkien)
```

---

## 4. Implementation Plan

### 4.1 Phase G.1 — Tier 1 Immediate (2-4 hours, no new deps)

**Files affected:**

| File | Change |
|------|--------|
| `scripts/stt_server.py` | +2 `_transcribe_kwargs` entries (teo, hak with dialect-specific initial_prompt), +2 lang aliases, extend `ALLOWED_STT_LANGS` |
| `src/lib/voices.ts` | +2 `sttLangFromVoice` mappings (teo → "teo", hak → "hak"), update voice labels |
| `src/lib/stt-lang.ts` | +2 entries for teo/hak mapping |
| `src/lib/tts-text.ts` | New function `normalizeForTTS(text, lang)` — dialect→Cantonese character substitutions |
| `src/lib/tts-text.test.ts` | Tests for normalizer |
| `src/lib/stt-lang.test.ts` | +2 STT lang mapping tests |

**Rollback safety**: All changes are additive; no model downloads. Edge runtime
unchanged (still `zh-HK-WanLungNeural` for TTS).

### 4.2 Phase G.2 — Tier 2 Hakka TTS (VoxHakka) (3-5 days)

**Goal**: Native Hakka TTS on our CPU server.

**Sub-tasks:**

1. **G.2.1** — Accept HuggingFace gated access for `formospeech/yourtts-htia-240704`
2. **G.2.2** — Install Hakka G2P frontend (`formog2p.hakka.g2p`) — check Python dependency
3. **G.2.3** — Create `scripts/hakka_tts.py` — standalone inference module
   - Load YourTTS checkpoint
   - Accept Hakka text → G2P → phoneme tokens → audio
   - Speaker embedding: use one of the 19+ speakers in training data
   - Output: 22,050 Hz mono WAV → convert to MP3 via ffmpeg
4. **G.2.4** — Wire into `stt_server.py`: new Flask endpoint `/tts/hakka`
   or extend existing `/tts` with voice="voxhakka"
5. **G.2.5** — Frontend: add `edgeVoice="voxhakka"` to hakka voice entry,
   update TTS API client to route "voxhakka" to the local Python endpoint
6. **G.2.6** — Unit + integration tests:
   - `hakka_tts.test.py`: G2P output valid, model produces non-silent audio
   - Manual smoke test: send Hakka tutor text → hear synthesized Hakka speech
7. **G.2.7** — Memory profiling: ensure VoxHakka + existing services fit in 4GB

**Memory budget for G.2:**

| Process | Est. RAM |
|---------|----------|
| stt_server.py (SenseVoice) | ~450 MB |
| stt_server.py (Whisper, lazy) | ~500 MB |
| VoxHakka (YourTTS, loaded) | ~400 MB |
| Next.js production server | ~130 MB |
| Next.js dev server (agent-chat) | ~80 MB |
| OS + nginx + buffer | ~700 MB |
| **Total** | **~2,260 MB of 4,000 MB** |

**Verdict**: Should fit. The STT Whisper model is loaded lazily (only on EN/ES/auto
fallback), which avoids concurrent Whisper + VoxHakka RAM peaks.

### 4.3 Phase G.3 — Tier 2 Teochew TTS (Hybrid) (5-7 days)

**Goal**: Better-than-Cantonese Teochew TTS using PaddleSpeech + Teochew vocoder.

**Sub-tasks:**

1. **G.3.1** — Install PaddleSpeech with `fastspeech2_canton` preset
2. **G.3.2** — Integrate `pyPengIm` G2P frontend (GitHub: p1an-lin-jung/teochew-g2p)
   - Accept Teochew text → output Peng'im romanization
   - Map Peng'im phonemes to Cantonese phoneme space (for FastSpeech2 input)
3. **G.3.3** — Load `panlr/hifigan_teochew` vocoder
4. **G.3.4** — Build inference pipeline: text → pyPengIm → FastSpeech2 (mel) → HiFi-GAN (wav)
5. **G.3.5** — Evaluate: MOS comparison (subjective) — current Cantonese TTS vs hybrid
6. **G.3.6** — If quality is acceptable, wire into `stt_server.py` (similar to G.2.4)

**Risk**: Cantonese acoustic model + Teochew vocoder may produce unnatural speech.
The phoneme spaces differ (Teochew has 8 tones, Cantonese 6; different tone sandhi).
Acceptance criterion: better than raw Cantonese TTS reading Teochew text.

**Fallback plan**: If hybrid quality is poor, skip to Phase H (Tier 3 — train
dedicated Teochew FastSpeech2 on teochew_wild with GPU).

### 4.4 Phase G.4 — Tier 2 STT (Whisper-Tiny + LoRA) (1-2 weeks)

**Goal**: Dedicated Teochew and Hakka STT models that fit in 4GB RAM.

**Sub-tasks:**

1. **G.4.1** — Prepare training environment (Google Colab with T4 GPU, or rented VPS)
2. **G.4.2** — Train Teochew LoRA adapter on `teochew_wild`
   - Base: `openai/whisper-tiny`
   - LoRA rank: 8, targets: q_proj, v_proj
   - Epochs: 10-20, eval on validation split
   - Output: LoRA adapter (~1 MB)
3. **G.4.3** — Train Hakka LoRA adapter on Hakka data (formospeech/hakkaradio_news_clean)
4. **G.4.4** — Merge LoRA + base → export ONNX INT8 (using onnxruntime tools)
   - Target: ~110 MB per model (tiny base 60 MB + merged adapter)
5. **G.4.5** — Integrate with `stt_server.py`:
   - Add whisper-tiny-teo.onnx and whisper-tiny-hak.onnx to model directory
   - New STT engine path: lang=="teo" → ONNX runtime with teo model
   - lang=="hak" → ONNX runtime with hak model
6. **G.4.6** — Benchmark: CER on held-out test set, RTF on CPU, RAM usage
7. **G.4.7** — A/B test: compare new STT vs current auto mode on real dialect audio

**Alternative shortcut**: If LoRA training is too time-consuming, try the existing
`panlr/whisper-finetune-teochew` ONNX-exported and quantized to INT8. Whisper-medium
INT8 is ~500 MB — borderline but might work if we unload SenseVoice during inference.

---

## 5. Test Plan

### 5.1 Unit Tests

| Test File | Tests | Coverage |
|-----------|-------|----------|
| `stt-lang.test.ts` | `sttLangFromVoice("teochew")` → `"teo"`; `sttLangFromVoice("hakka")` → `"hak"` | STT language routing |
| `tts-text.test.ts` | `normalizeForTTS("汝好，食饭未", "teo")` → normalized text; Hakka equivalents | Dialect→Cantonese TTS normalization |
| `hakka_tts.test.py` | G2P output validity; model produces non-silent audio; duration > 0.5s | VoxHakka inference |
| `teochew_tts.test.py` | pyPengIm G2P output; FastSpeech2 → mel spectrogram shape; HiFi-GAN → wav non-silent | Teochew TTS pipeline |

### 5.2 Integration Tests

| Scenario | Expected |
|----------|----------|
| Student speaks Teochew, voice = Teochew | STT: Whisper+teo prompt transcribes to zh with dialect characters; TTS: normalized text read by Cantonese voice (Tier 1) or hybrid Teochew voice (Tier 2) |
| Student speaks Hakka, voice = Hakka | STT: Whisper+hak prompt transcribes; TTS: VoxHakka native voice (Tier 2) |
| Student types Chinese, voice = Teochew | No STT involved; TTS reads dialect text (normalization step) |
| Dictionary page lookup (Teochew/Hakka entries) | No STT/TTS change — dictionary is read-only text |
| Switch from Teochew to Auto voice mid-session | STT lang resets to auto; TTS voice changes correctly |
| Low-memory scenario (memory pressure) | Graceful degradation — fallback to Cantonese TTS if VoxHakka OOM |

### 5.3 Manual Smoke Tests

- [ ] Record ~5 seconds of Teochew speech → transcribed with Teochew function words visible
- [ ] Record ~5 seconds of Hakka speech → transcribed with Hakka characters visible
- [ ] TTS plays Hakka tutor response in VoxHakka voice (audible, intelligible)
- [ ] TTS plays Teochew tutor response — better than raw Cantonese (audible comparison)
- [ ] No service crashes, no 500s on TTS/STT endpoints with new voices
- [ ] Memory usage stays under 3.5 GB total (4GB server with swap)

---

## 6. Risk Analysis

| Risk | Probability | Impact | Mitigation |
|------|------------|--------|------------|
| VoxHakka OOM on 4GB | Medium | Hakka TTS falls back to Cantonese | Memory profiling before deployment; lazy load/unload |
| PaddleSpeech fastspeech2_canton incompatible with Teochew vocoder | Medium-High | Teochew TTS quality no better than Cantonese | Skip to Tier 3 (GPU training) if hybrid MOS < 2.0 |
| Whisper-tiny+LoRA CER > 25% for Teochew | Medium | STT still poor; stay on auto mode | Use Qwen3_ASR_teochew on Colab API as stopgap |
| HF gated access denied for VoxHakka/whisper-hakka | Low | Cannot deploy models | Use only Tier 1 improvements; no models |
| Mainland vs Taiwan Hakka orthography mismatch | Low-Medium | Students see unfamiliar characters | Accept both orthographies in dictionary; tutor prompt uses mainland convention |
| pyPengIm Python version conflict with stt_server.py deps | Low | Cannot run G2P frontend | Pin to Python 3.9+; test in Docker first |

---

## 7. Success Metrics

| Metric | Baseline (Current) | Tier 1 Goal | Tier 2 Goal |
|--------|-------------------|-------------|-------------|
| Teochew STT WER (clean speech) | ~60-70% | ~45-55% | ~20-30% |
| Hakka STT WER (clean speech) | ~60-70% | ~45-55% | ~15-25% |
| Hakka TTS naturalness (1-5) | 2.0 (Cantonese voice) | 2.5 (normalized text) | 3.5+ (VoxHakka native) |
| Teochew TTS naturalness (1-5) | 2.0 (Cantonese voice) | 2.5 (normalized text) | 3.0+ (hybrid pipeline) |
| Added RAM usage (STT) | 0 MB | 0 MB | < 200 MB |
| Added RAM usage (TTS) | 0 MB | 0 MB | < 500 MB (VoxHakka) |

---

## 8. References

1. Pan, L. et al. (2025). "Teochew-Wild: The First In-the-wild Teochew Dataset with
   Orthographic Annotations." *IEEE ICME 2025*. [arXiv:2505.05056](https://arxiv.org/abs/2505.05056)
2. Pan, L. (2025). "pyPengIm — Teochew G2P and text processing." [GitHub](https://github.com/p1an-lin-jung/teochew-g2p)
3. Pan, L. (2025). "whisper-finetune-teochew." [HuggingFace](https://huggingface.co/panlr/whisper-finetune-teochew)
4. Pan, L. (2026). "Qwen3_ASR_teochew." [HuggingFace](https://huggingface.co/panlr/Qwen3_ASR_teochew)
5. Chen, L.-W. et al. (2024). "VoxHakka: A Dialectally Diverse Multi-speaker TTS
   System for Taiwanese Hakka." [arXiv:2409.01548](https://arxiv.org/abs/2409.01548)
6. Formospeech (2025). "whisper-large-v2-taiwanese-hakka-v1." [HuggingFace](https://huggingface.co/formospeech/whisper-large-v2-taiwanese-hakka-v1)
7. NUTN-KWS (2026). "Whisper-Taiwanese-Hakka-model-v0.2.6." [HuggingFace](https://huggingface.co/NUTN-KWS/Whisper-Taiwanese-Hakka-model-v0.2.6)
8. Liu, Z.-T. et al. (2025). "A Study on a Low-Resource Speech Recognition System
   for Taiwan Hakka Based on Whisper and LoRA." *ROCLING 2025*.
9. MediaTek Research (2026). "Breeze-ASR-26." [HuggingFace](https://huggingface.co/MediaTek-Research/Breeze-ASR-26)
10. Alibaba FunAudioLLM (2025). "Fun-ASR-Nano-2512." [GitHub](https://github.com/FunAudioLLM/Fun-ASR)
11. Alibaba QwenAudio (2024-2025). "CosyVoice / CosyVoice 2 / CosyVoice 3."
    [GitHub](https://github.com/QwenAudio/CosyVoice)
12. KaedeTai (2026). "gpt-sovits-tw — GPT-SoVITS Taiwanese (Hokkien)."
    [HuggingFace](https://huggingface.co/KaedeTai/gpt-sovits-tw)
13. Li, Z. et al. (2025). "LoRA-INT8 Whisper: A Low-Cost Cantonese Speech
    Recognition Framework for Edge Devices." *MDPI Sensors*.
14. PaddleSpeech (2024). "fastspeech2_canton." [GitHub](https://github.com/PaddlePaddle/PaddleSpeech)
15. Formospeech (2026). "OmniVoice Hakka Community 1." [HuggingFace](https://huggingface.co/formospeech/omnivoice-hakka-community-1)
16. Microsoft ONNX Runtime (2024). "Whisper Model Optimization."
    [GitHub](https://github.com/microsoft/onnxruntime)
