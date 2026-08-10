# Shanghainese (上海话 · sha) Language Support

> **Subsystem document** — part of [Spark Design Docs](../DESIGN.md)  
> Status: **shipped** · updated 2026-08-10  
> Pattern: same Bailian-first stack as [Hokkien `teo`](bailian-stt-tts.md)  
> Downstream: [TODO.md](../TODO.md)

---

## 1. Goal

Shanghainese (`sha`) is a first-class dialect: **STT + TTS both via 阿里云百炼**, mirroring Hokkien — **no Cantonese edge-tts stand-in**.

---

## 2. TTS (Bailian)

| Priority | Provider | Condition |
|----------|----------|-----------|
| ① | CosyVoice **clone** (`SHA_CLONE_VOICE_ID`) | Family clone when configured |
| ② | **千问3-TTS** `qwen3-tts-flash` + voice **`Jada`**（上海-阿珍） | Default when API key present |
| ✗ | edge `zh-HK-*` | **Forbidden** — 503 if Bailian unavailable |

`POST /api/tts` with `lang=sha` → `synthesizeDialect` → `X-TTS-Engine: qwen-shanghai` (or `aliyun-clone`).

Do **not** run Cantonese `normalizeForTTS` on Bailian Shanghai audio — keep Wu characters (侬 / 阿拉 / …) for Jada.

```ts
// ttsProviderForLang("sha")
SHA_CLONE_VOICE_ID → aliyun-clone
else ALIYUN key → qwen-tts { voiceId: "Jada", model: "qwen3-tts-flash" }
else throw DialectTtsUnavailableError
```

---

## 3. STT (Bailian)

Same engine order as Hokkien:

```
DEFAULT_ORDER["sha"] = ["bailian", "iflytek", "local"]
bailianAsrLanguageHint("sha") → "zh"   // Wu under Chinese Fun-ASR
```

Fun-ASR-Flash covers 吴语 / 上海话. Optional `STT_BACKUP_IFYTEK=1`.

---

## 4. Key files

| File | Role |
|------|------|
| `src/lib/tts-provider.ts` | `sha` → qwen-tts / clone |
| `src/lib/tts-provider.ts` `callQwenTts` | multimodal-generation TTS |
| `src/app/api/tts/route.ts` | `lang=sha` dialect path |
| `src/lib/voices.ts` | `shanghainese` voice; no WanLung edgeVoice |
| `src/lib/stt-engine-order.ts` | Bailian-first for sha |
| `src/lib/bailian-asr.ts` | language hint `zh` |

---

## 5. Env

```bash
ALIYUN_DASHSCOPE_API_KEY=sk-xxx
# optional family clone (CosyVoice)
# SHA_CLONE_VOICE_ID=cosyvoice-v3-plus-xxxx
```

---

## 6. Tests / manual

| ID | Case |
|----|------|
| SHA-1 | `ttsProviderForLang("sha")` with key → `qwen-tts` / Jada |
| SHA-2 | no key → throw, never edge yue |
| SHA-3 | `/api/tts` lang=sha → 200, `X-TTS-Engine: qwen-shanghai` |
| SHA-4 | Mic with Shanghainese voice → Bailian STT |
