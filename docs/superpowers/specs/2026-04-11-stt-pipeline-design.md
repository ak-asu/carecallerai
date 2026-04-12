# CareCaller STT Pipeline — Design Spec
**Date:** 2026-04-11
**Scope:** Two-stage STT system + post-processing enhancements + evaluation framework
**Compute:** Google Colab free (T4 GPU) for fine-tuning; Modal.com for serving
**Model:** openai/whisper-small (fine-tuned)
**Languages:** English (primary), Spanish (secondary via CommonVoice)

---

## 1. System Architecture

The full system is two stages, with the CareCaller voice agent as the integration demo layer.

```
[8kHz Telephony Audio — Vapi]
           ↓
┌──────────────────────────────────────────────────────────┐
│  STAGE 1: STT Layer  (STT_PROVIDER env var switches)     │
│                                                          │
│  "assembly-ai" → AssemblyAI Medical (via Vapi native)   │
│  "custom"      → Fine-tuned Whisper (Modal.com FastAPI) │
│                  + Whisper initial_prompt biasing        │
│                    using patient's known med list        │
│                                                          │
│  Output: raw transcript + per-word confidence scores     │
└──────────────────────────────────────────────────────────┘
           ↓
┌──────────────────────────────────────────────────────────┐
│  STAGE 2: Post-Processing Pipeline  (existing + enhanced)│
│                                                          │
│  Layer 1 — Rules (~5ms)                                  │
│    • Expanded RxNorm drug dict (~500 drugs)              │
│    • Phonetic fuzzy matching (DoubleMetaphone + Levenshtein) │
│    • Numeric ambiguity flags (fifteen/fifty pairs)       │
│    • Dose normalization, frequency map, safety scan      │
│                                                          │
│  Layer 2 — Context (~30ms)                               │
│    • Contradiction detection vs patient records          │
│    • NUMERIC_AMBIGUOUS resolution using known doses      │
│    • Negation validation                                 │
│                                                          │
│  Layer 3 — Groq (~200ms, conditional)                    │
│    • Triggers: confidence < 0.85 OR contradiction        │
│      OR NUMERIC_AMBIGUOUS flag                           │
│    • Structured JSON, grounded on patient records        │
│                                                          │
│  Post-call — Gemini 2.5 Flash (async, full transcript)   │
│    • Structured extraction: drugs + doses, symptoms,     │
│      adherence flags, numeric entities, confidence/entity│
└──────────────────────────────────────────────────────────┘
           ↓
┌──────────────────────────────────────────────────────────┐
│  BONUS: CareCaller Voice Agent Demo                      │
│  Vapi + ElevenLabs + Dashboard + Clinician Timeline      │
└──────────────────────────────────────────────────────────┘
```

### Config Switch

Single env var in `.env.local` and Vercel:
```
STT_PROVIDER=assembly-ai   # or "custom"
CUSTOM_STT_URL=https://your-modal-endpoint.modal.run/transcribe
```

The `assistant-request` handler in `src/app/api/vapi/route.ts` reads `STT_PROVIDER` and returns an inline assistant config to Vapi — either the AssemblyAI transcriber (with wordBoost drug list) or the custom transcriber URL. No other code paths change.

---

## 2. Python STT Pipeline

### 2.1 Model

`openai/whisper-small` — 244M parameters, fits comfortably in T4 12GB VRAM, trains in ~2.5 hours on Colab free tier. Fine-tuned via HuggingFace `Seq2SeqTrainer`.

Served via `faster-whisper` (CTranslate2 backend) on Modal.com — 4× faster inference than standard HuggingFace Whisper, same accuracy.

### 2.2 Training Data

| Source | Purpose | Subset size | Streaming |
|---|---|---|---|
| LibriSpeech `train-clean-100` | Base speech + 8kHz robustness | ~20 hrs | Yes |
| CommonVoice `en` validated | Accent diversity | ~10 hrs | Yes |
| Synthetic medical audio | Drug names, dosages, symptoms | ~3 hrs | Generated |
| CHiME-4 noise | Noisy environment robustness | Mixed in | Subset |
| Speed perturbation (0.9×–1.3×) | Fast speech | Applied to all | — |

All datasets streamed via HuggingFace `datasets` — no full downloads, Colab-safe.

### 2.3 8kHz Simulation (Key Training Technique)

All audio → resample to 8kHz (simulates telephony bandwidth, strips high frequencies) → resample back to 16kHz for Whisper's feature extractor. This teaches the model the telephony frequency distribution without requiring a custom feature extractor. μ-law quantization noise optionally applied (scipy.signal) to simulate G.711 codec artifacts.

### 2.4 Synthetic Medical Audio Generation

Use `edge-tts` (Microsoft TTS, free, high quality) to speak medical sentence templates, then apply 8kHz simulation + MUSAN noise:

Templates include:
- Medication + dosage: `"I take {drug} {dose} {frequency}"`
- Numeric confusion pairs: `"take fifteen milligrams"` and `"take fifty milligrams"` (both, so model learns distinction)
- Symptoms + severity: `"my pain is about {n} out of ten"`
- Adherence: `"I missed my {drug} dose this morning"`
- Refill requests: `"I need a refill for {drug}"`

Multiple TTS voices + slight pitch variation for speaker diversity.

### 2.5 Whisper Initial Prompt Biasing

At inference time, the patient's known medication list (pre-cached in `call_sessions`) is passed as Whisper's `initial_prompt`:

```python
prompt = f"Patient medications: {', '.join(patient_meds)}. Medical phone call transcription."
result = model.transcribe(audio, initial_prompt=prompt, language="en")
```

This biases beam search toward known drug names before any word is transcribed — the single highest-impact accuracy improvement at inference time, with zero training cost.

### 2.6 Modal.com Serving Endpoint

- **POST `/transcribe`** — accepts raw audio bytes + optional `patient_meds: list[str]`
- Returns `{ transcript: str, words: [{word, start, end, confidence}] }`
- GPU: T4 on Modal free tier
- Cold start: ~3s; warm inference: ~400ms for 10s audio chunk
- Stable HTTPS URL (never rotates, unlike ngrok free tier)

### 2.7 Directory Structure

```
stt/
├── data/
│   ├── prepare.py          ← stream + preprocess all datasets
│   ├── synthetic.py        ← generate medical audio via edge-tts + MUSAN noise
│   └── augment.py          ← 8kHz sim, speed perturb, μ-law noise
├── train/
│   └── fine_tune.py        ← HuggingFace Seq2SeqTrainer, checkpoint every epoch
├── eval/
│   ├── benchmark.py        ← WER/CER/numeric/medical term recall metrics
│   └── test_sets/
│       └── generate.py     ← build numeric confusion + medical term test sets
├── serve/
│   └── modal_app.py        ← Modal.com FastAPI endpoint (faster-whisper)
└── requirements.txt
```

---

## 3. Next.js Enhancements

### 3.1 `src/app/api/vapi/route.ts` — Config Switch

The `assistant-request` case returns an inline assistant config instead of a static `assistantId`. Conditionally sets transcriber based on `STT_PROVIDER`. AssemblyAI path adds `wordBoost` with expanded drug list. Custom path sets `customTranscriber.server.url` to `CUSTOM_STT_URL`.

### 3.2 `src/lib/nlp.ts` — Three Additions

**Expanded drug dict:** Replace 12-drug hardcoded dict with a static JSON import of ~500 RxNorm drugs (generic + brand names). JSON file lives at `src/lib/data/rxnorm-drugs.json`.

**Phonetic fuzzy matching:** `normalizeDrugName()` gets a three-stage fallback:
1. Exact dict lookup (current behavior)
2. DoubleMetaphone phonetic match — catches "Fasix"→"Lasix", "Lexipro"→"Lexapro"
3. Levenshtein distance ≤ 2 — catches minor transcription errors

Uses `natural` npm package (already a common dependency, MIT license).

**Numeric ambiguity flags:** A new `flagNumericAmbiguity()` function runs after `normalizeDose()`. Detects acoustically confusable dose quantities using a hardcoded confusion table:
- `fifty mg` ↔ `fifteen mg`
- `forty {unit}` ↔ `fourteen {unit}`
- `ninety {unit}` ↔ `nineteen {unit}`
- `eighty {unit}` ↔ `eighteen {unit}`

Returns `NUMERIC_AMBIGUOUS` token in place of the ambiguous value. This always routes to Layer 3 for context-based resolution.

### 3.3 `src/lib/vapi.ts` — NUMERIC_AMBIGUOUS Routing

`runCallPipeline()` checks for `NUMERIC_AMBIGUOUS` tokens after Layer 1 and forces Layer 3 invocation regardless of confidence score. Passed to Groq as a structured flag alongside any contradiction data.

### 3.4 `supabase/functions/post-call-processor/index.ts` — Structured Extraction

Replace flat `symptoms[]` / `medicationChanges[]` string arrays with structured JSON extraction:

```json
{
  "summary": "...",
  "severity": 0-10,
  "entities": [
    {
      "type": "drug|dose|symptom|adherence|numeric",
      "value_raw": "...",
      "value_normalized": "...",
      "confidence": 0.0-1.0,
      "negated": false
    }
  ],
  "followUpRequired": true
}
```

Each entity inserted into `call_entities` table with full lifecycle tracking. Directly improves the audit trail judges evaluate.

---

## 4. Evaluation Framework

### 4.1 Test Sets

| Set | How built | What it tests |
|---|---|---|
| Clean 8kHz | LibriSpeech `test-clean` downsampled to 8kHz | Baseline telephony WER |
| Noisy 8kHz | Above + MUSAN noise at 10dB SNR | Noise robustness |
| Accented | CommonVoice non-native English subset | Accent robustness |
| Medical terms | TTS drug-name sentences at 8kHz + noise | Domain vocabulary |
| Numeric confusion | TTS "fifteen mg" / "fifty mg" pairs | Numeric accuracy |

### 4.2 Metrics

- **WER** — `jiwer` library, word error rate on raw STT output
- **CER** — character error rate, catches partial drug name errors (e.g. "warfar" for "warfarin")
- **Medical term recall** — for each reference containing a known drug, did hypothesis contain it (exact or phonetic fuzzy match)?
- **Numeric accuracy** — extract numerals from reference + hypothesis, compute digit-level match rate

### 4.3 Results Table

Three comparison rows, four metrics. The key narrative:

| Model | Clean WER | Noisy WER | Med Recall | Numeric Acc |
|---|---|---|---|---|
| Whisper-small baseline | measured | measured | measured | measured |
| Fine-tuned Whisper (ours) | lower | lower | higher | higher |
| Fine-tuned + post-processing | same as above | same as above | higher still | higher still |

The third row demonstrates that WER is not the full picture — medical term recall and numeric accuracy are separately improvable by the post-processing layer, matching the evaluation criteria in the problem statement exactly.

### 4.4 Output

`python eval/benchmark.py` produces `results/benchmark_results.json` + prints a formatted table. One command, reproducible.

---

## 5. Key Design Decisions

| Decision | Choice | Reason |
|---|---|---|
| Fine-tune target | whisper-small | Fits Colab T4 12GB, trains in ~2.5hrs, good WER/speed tradeoff |
| Serving framework | faster-whisper on Modal.com | 4× faster than HuggingFace Whisper, stable URL, free GPU |
| 8kHz handling | Downsample→upsample trick | No custom feature extractor needed; teaches telephony distribution |
| Drug dict size | ~500 RxNorm drugs | Full coverage of common prescriptions without bloating runtime |
| Fuzzy matching | DoubleMetaphone + Levenshtein ≤ 2 | Catches phonetic STT errors (Fasix→Lasix) that exact match misses |
| Numeric ambiguity | Flag → Layer 3, never auto-accept | Safety-critical: wrong dose can cause patient harm |
| Config switch | Single env var | Zero-friction switching for demo + evaluation |
| Synthetic data | edge-tts + MUSAN noise | Free, high quality, covers drug names that no public dataset has |
| Training datasets | Streamed via HuggingFace | No full downloads — Colab session-safe |

---

## 6. Files Changed / Created

### New files
```
stt/data/prepare.py
stt/data/synthetic.py
stt/data/augment.py
stt/train/fine_tune.py
stt/eval/benchmark.py
stt/eval/test_sets/generate.py
stt/serve/modal_app.py
stt/requirements.txt
src/lib/data/rxnorm-drugs.json
```

### Modified files
```
src/app/api/vapi/route.ts              ← config switch
src/lib/nlp.ts                         ← drug dict, fuzzy match, numeric ambiguity
src/lib/vapi.ts                        ← NUMERIC_AMBIGUOUS routing
supabase/functions/post-call-processor/index.ts  ← structured extraction
.env.local                             ← STT_PROVIDER, CUSTOM_STT_URL
```

### No changes needed
Everything else in the Next.js app (dashboard, clinician view, Groq/Gemini libs, Supabase schema, Edge Functions) is unchanged.
