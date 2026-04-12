"""
Stream and preprocess training datasets from HuggingFace.
Uses streaming mode — no full downloads needed (Colab-safe).
"""
import random
from typing import Iterator

import numpy as np
from datasets import load_dataset, Audio

from augment import simulate_telephony, add_noise, speed_perturb, white_noise

SAMPLE_RATE = 16000
SPEED_RATES = [0.9, 1.0, 1.0, 1.1, 1.3]   # 1.0 appears twice → more weight on natural speed
SNR_CHOICES = [None, 15.0, 10.0, 8.0, 5.0]  # None = clean


def _normalize_sample(raw: dict) -> dict:
    """Extract audio array and transcript from varying dataset schemas."""
    audio = raw["audio"]["array"].astype(np.float32)
    sr = raw["audio"]["sampling_rate"]
    text = raw.get("text") or raw.get("sentence") or raw.get("transcript") or ""
    return {"audio": audio, "sr": sr, "text": text.strip()}


def _augment(audio: np.ndarray, sr: int, snr_db: float = None, rate: float = 1.0) -> np.ndarray:
    audio = simulate_telephony(audio, sr)
    if rate != 1.0:
        audio = speed_perturb(audio, rate=rate)
    if snr_db is not None:
        noise = white_noise(len(audio))
        audio = add_noise(audio, noise, snr_db=snr_db)
    return audio


def stream_librispeech(max_samples: int = 5000) -> Iterator[dict]:
    """
    Stream LibriSpeech train-clean-100.
    Applies telephony simulation + random speed perturbation + optional noise.
    Yields: {"audio": np.ndarray at 16kHz, "text": str}
    """
    ds = load_dataset(
        "openslr/librispeech_asr",
        "clean",
        split="train.clean.100",
        streaming=True,
        trust_remote_code=True,
    )
    ds = ds.cast_column("audio", Audio(sampling_rate=SAMPLE_RATE))

    count = 0
    for raw in ds:
        if count >= max_samples:
            break
        s = _normalize_sample(raw)
        if not s["text"]:
            continue
        rate = random.choice(SPEED_RATES)
        snr = random.choice(SNR_CHOICES)
        audio = _augment(s["audio"], s["sr"], snr_db=snr, rate=rate)
        yield {"audio": audio, "text": s["text"]}
        count += 1
    print(f"LibriSpeech: streamed {count} samples")


def stream_commonvoice(max_samples: int = 3000) -> Iterator[dict]:
    """
    Stream CommonVoice English validated split.
    Yields: {"audio": np.ndarray at 16kHz, "text": str}
    """
    ds = load_dataset(
        "mozilla-foundation/common_voice_13_0",
        "en",
        split="train",
        streaming=True,
        trust_remote_code=True,
    )
    ds = ds.cast_column("audio", Audio(sampling_rate=SAMPLE_RATE))

    count = 0
    for raw in ds:
        if count >= max_samples:
            break
        s = _normalize_sample(raw)
        if not s["text"]:
            continue
        rate = random.choice(SPEED_RATES)
        snr = random.choice(SNR_CHOICES)
        audio = _augment(s["audio"], s["sr"], snr_db=snr, rate=rate)
        yield {"audio": audio, "text": s["text"]}
        count += 1
    print(f"CommonVoice: streamed {count} samples")


def load_synthetic(manifest_path: str) -> Iterator[dict]:
    """Load pre-generated synthetic audio from manifest.json."""
    import json, librosa
    with open(manifest_path) as f:
        samples = json.load(f)
    for s in samples:
        audio, _ = librosa.load(s["audio"], sr=SAMPLE_RATE, mono=True)
        yield {"audio": audio.astype(np.float32), "text": s["text"]}
    print(f"Synthetic: loaded {len(samples)} samples from {manifest_path}")
