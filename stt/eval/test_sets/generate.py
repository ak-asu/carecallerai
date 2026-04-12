"""
Generate evaluation test sets for the STT benchmark.
Run once before benchmarking:
    cd stt && python eval/test_sets/generate.py

Outputs: stt/eval/test_sets/test_audio/manifest.json
"""
import asyncio
import json
import os
import sys
import random

import librosa
import numpy as np
import soundfile as sf

sys.path.insert(0, os.path.join(os.path.dirname(__file__), "..", ".."))

from data.augment import simulate_telephony, add_noise, white_noise

VOICES = ["en-US-JennyNeural", "en-US-GuyNeural", "en-GB-SoniaNeural", "en-AU-NatashaNeural"]

NUMERIC_CONFUSION_SENTENCES = [
    ("take fifteen milligrams", "take fifteen milligrams"),
    ("take fifty milligrams", "take fifty milligrams"),
    ("fourteen units of insulin", "fourteen units of insulin"),
    ("forty units of insulin", "forty units of insulin"),
    ("nineteen milligrams daily", "nineteen milligrams daily"),
    ("ninety milligrams daily", "ninety milligrams daily"),
    ("eighteen tablets a week", "eighteen tablets a week"),
    ("eighty tablets a week", "eighty tablets a week"),
    ("pain level nine out of ten", "pain level nine out of ten"),
    ("pain level five out of ten", "pain level five out of ten"),
    ("thirteen milligrams twice a day", "thirteen milligrams twice a day"),
    ("thirty milligrams twice a day", "thirty milligrams twice a day"),
]

MEDICAL_TERM_SENTENCES = [
    "I take warfarin five milligrams once a day",
    "My lisinopril prescription needs a refill",
    "I have been on metformin five hundred milligrams for two years",
    "The atorvastatin is causing muscle pain",
    "I need more amlodipine",
    "I take sertraline fifty milligrams every morning",
    "My gabapentin dose was recently increased",
    "I ran out of omeprazole",
    "Furosemide forty milligrams once daily",
    "Escitalopram ten milligrams for anxiety",
    "I take metoprolol twenty five milligrams twice daily",
    "My Lexapro prescription is empty",
    "Lasix forty milligrams in the morning",
    "I started Zoloft last week",
    "My Lipitor causes leg cramps",
]


async def _tts_mp3(text: str, voice: str, path: str) -> None:
    import edge_tts
    communicate = edge_tts.Communicate(text, voice)
    await communicate.save(path)


def _make_wav(text: str, voice: str, path: str, snr_db: float = None) -> None:
    mp3 = path.replace(".wav", "_tmp.mp3")
    asyncio.run(_tts_mp3(text, voice, mp3))
    audio, sr = librosa.load(mp3, sr=16000, mono=True)
    os.remove(mp3)
    audio = simulate_telephony(audio, sr)
    if snr_db is not None:
        noise = white_noise(len(audio))
        audio = add_noise(audio, noise, snr_db=snr_db)
    sf.write(path, audio, 16000)


def generate(output_dir: str = None) -> dict:
    if output_dir is None:
        output_dir = os.path.join(os.path.dirname(__file__), "test_audio")

    sets = {
        "clean_8k": [],
        "noisy_8k": [],
        "medical_terms": [],
        "numeric_confusion": [],
    }

    for set_name in sets:
        os.makedirs(os.path.join(output_dir, set_name), exist_ok=True)

    # Medical terms — clean + noisy variants
    for i, text in enumerate(MEDICAL_TERM_SENTENCES):
        for vi, voice in enumerate(VOICES[:2]):
            uid = f"med_{i}_{vi}"
            clean_path = os.path.join(output_dir, "clean_8k", f"{uid}.wav")
            noisy_path = os.path.join(output_dir, "noisy_8k", f"{uid}.wav")
            mt_path = os.path.join(output_dir, "medical_terms", f"{uid}.wav")

            if not os.path.exists(clean_path):
                _make_wav(text, voice, clean_path, snr_db=None)

            if not os.path.exists(noisy_path):
                _make_wav(text, voice, noisy_path, snr_db=10.0)

            if not os.path.exists(mt_path):
                import shutil
                shutil.copy(clean_path, mt_path)

            sets["clean_8k"].append({"audio": clean_path, "text": text})
            sets["noisy_8k"].append({"audio": noisy_path, "text": text})
            sets["medical_terms"].append({"audio": mt_path, "text": text})

    # Numeric confusion set
    for i, (text, reference) in enumerate(NUMERIC_CONFUSION_SENTENCES):
        for vi, voice in enumerate(VOICES[:2]):
            uid = f"num_{i}_{vi}"
            path = os.path.join(output_dir, "numeric_confusion", f"{uid}.wav")
            if not os.path.exists(path):
                _make_wav(text, voice, path, snr_db=8.0)
            sets["numeric_confusion"].append({"audio": path, "text": reference})

    manifest = {k: v for k, v in sets.items()}
    manifest_path = os.path.join(output_dir, "manifest.json")
    with open(manifest_path, "w") as f:
        json.dump(manifest, f, indent=2)

    for name, items in sets.items():
        print(f"  {name}: {len(items)} samples")
    print(f"\nManifest -> {manifest_path}")
    return manifest


if __name__ == "__main__":
    print("Generating evaluation test sets...")
    generate()
