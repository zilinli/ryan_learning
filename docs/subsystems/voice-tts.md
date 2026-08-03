# Subsystem: Voice & TTS/STT

> Parent: [Design Overview](/docs/DESIGN.md)

---

## 1. Responsibility

Convert tutor text to spoken audio (TTS) and student speech to text (STT), with automatic language switching.

---

## 2. Voice Architecture

```mermaid
flowchart TB
    subgraph Client["Browser"]
        PICKER["VoicePicker\nava / ryan / yunxi / wanLung / alvaro / jorge / auto"]
        PLAYER["SpeechPlayer\nQueue + play chunks"]
        RECORDER["WavRecorder\nCapture + encode"]
    end

    subgraph Server["Next.js API"]
        TTS_API["POST /api/tts\n{ text, voice }"]
        STT_API["POST /api/transcribe\n{ audio, voice, lang }"]
    end

    subgraph Backend["External Services"]
        EDGE["Edge Neural TTS\n6 voices · mp3"]
        WHISPER["Whisper · English/Spanish"]
        SENSE["SenseVoice · Cantonese/Mandarin"]
    end

    PICKER -->|"voiceId"| TTS_API
    PLAYER -->|"GET audio/mpeg"| TTS_API
    TTS_API -->|"edge-tts"| EDGE
    RECORDER -->|"POST audio/wav"| STT_API
    STT_API -->|"faster-whisper"| WHISPER
    STT_API -->|"sensevoice"| SENSE
```

---

## 3. Language Detection

```mermaid
flowchart TD
    TEXT["Tutor reply text"]
    CHECK{"detectSpeechLang()"}

    CJK{"CJK ≥ 4\nand ≥ latin letters"}
    ES{"Spanish marks ñ¿¡\nor keyword hola/gracias"}
    EN{"Default"}

    TEXT --> CHECK
    CHECK --> CJK
    CHECK --> ES
    CHECK --> EN
    CJK -->|"yes"| YUE["yue\nzh-HK-WanLungNeural"]
    CJK -->|"no"| ES
    ES -->|"yes"| ESP["es\nes-ES-AlvaroNeural"]
    ES -->|"no"| ENG["en\nen-US-AvaNeural"]
```

**Key rule:** All Chinese defaults to **粤语**. Mandarin only when the student explicitly picks the **云希** voice, or when the replyLanguage is set to `zh`.

---

## 4. TTS Text Cleaning

```mermaid
flowchart LR
    RAW["Raw tutor reply\nwith markdown + LaTeX + diagrams"]
    STRIP["cleanTutorSpeechText()"]
    STEP1["1. Strip diagrams\n(data URIs, <svg>, mermaid fences)"]
    STEP2["2. Convert LaTeX → speech\n\\frac{1}{2} → 1 over 2\nx^2 → x squared"]
    STEP3["3. Strip markdown chrome\n# ## > - * ** ` links"]
    STEP4["4. Normalize whitespace\nCJK: no spaces between chars\nLatin: single space"]
    STEP5["5. Sanity check\nIs the result still %-encoded junk?"]

    RAW --> STRIP
    STRIP --> STEP1 --> STEP2 --> STEP3 --> STEP4 --> STEP5
```

**LaTeX → Speech conversions:**

| LaTeX | Speech |
|-------|--------|
| `\frac{a}{b}` | a over b |
| `\sqrt{x}` | square root of x |
| `x^2` | x squared |
| `x^3` | x cubed |
| `\pm` | plus or minus |
| `\angle` | angle |
| `\triangle` | triangle |

---

## 5. Streaming Speech

```mermaid
sequenceDiagram
    participant SSE as Chat SSE
    participant Player as SpeechPlayer
    participant TTS as /api/tts

    SSE-->>Player: push(delta)
    Player->>Player: pullSpeakableFromBuffer()
    Note over Player: Find ready sentences at pause markers (.!?。！？)
    loop each ready chunk
        Player->>TTS: POST { text: chunk, voice: wanLung }
        TTS-->>Player: audio/mpeg
        Player->>Player: Play via Audio()
    end
    SSE-->>Player: push(" ") (EOS signal)
    Player->>Player: finish(full reply)
    Note over Player: Synthesize remaining text
```

Chunks are kept ≤ 280 chars for fast synthesis. Boundaries respect sentence punctuation (`.`, `!`, `?`, `。`, `！`, `？`).

---

## 6. Voice Picker

| Voice ID | Label | Edge Voice | Language |
|----------|-------|------------|----------|
| `auto` | Auto · 自适应 | Detected | Auto-detect |
| `ava` | Ava · English | en-US-AvaNeural | en |
| `ryan` | Ryan · British | en-GB-RyanNeural | en |
| `yunxi` | 云希 · 普通话 | zh-CN-YunxiNeural | zh |
| `wanLung` | WanLung · 粤语 | zh-HK-WanLungNeural | yue |
| `alvaro` | Álvaro · Español | es-ES-AlvaroNeural | es |
| `jorge` | Jorge · Mexicano | es-MX-JorgeNeural | es |

Legacy female voice IDs (`xiaoxiao`, `hiuMaan`, `elvira`, `dalia`) are auto-mapped to their male equivalents.

---

## 7. STT

```mermaid
flowchart LR
    MIC["Student speaks"]
    WAV["WavRecorder\n16kHz mono PCM"]
    API["POST /api/transcribe\n{ audio, voice, lang }"]
    SERVER["stt_server.py :8765"]
    DECODE["faster-whisper · EN/ES\nSenseVoice · ZH/YUE"]
    TEXT["Transcribed text"]

    MIC --> WAV --> API --> SERVER --> DECODE --> TEXT
```

The local STT backend auto-picks the engine based on the voice/language preference sent from the frontend.

---

## 8. Edge Cases

| Case | Handling |
|------|----------|
| TTS returns empty audio | `SpeechPlayer` skips; TTS returns 422 |
| STT silence | Returns `"Didn't catch speech"` + 422 |
| Quick sequential TTS calls | `SpeechPlayer` queues; concurrent Audio() instances allowed |
| Fixed EN voice + Chinese text | `resolveEdgeVoice` auto-switches to Cantonese |
| "Speak" toggle disabled mid-stream | `wantSpeakRef` aborts `push()` / `finish()` |
| Empty cleaned text | `cleanTutorSpeechText` returns `""` |

---

## Next: [History & Storage](history-storage.md)
