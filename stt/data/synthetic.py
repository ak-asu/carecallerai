"""
Synthetic medical audio generation using edge-tts.
Produces .wav files at 16kHz (after telephony simulation) with paired transcripts.
"""
import asyncio
import os
import random
import json
from pathlib import Path

import librosa
import numpy as np
import soundfile as sf
import edge_tts

from augment import simulate_telephony, add_noise, white_noise

# TTS voices for speaker diversity
VOICES = [
    "en-US-JennyNeural",
    "en-US-GuyNeural",
    "en-GB-SoniaNeural",
    "en-AU-NatashaNeural",
    "en-US-AriaNeural",
    "en-CA-LiamNeural",
]

# Drug entries: (generic_name, brand_name, dose, frequency)
DRUGS = [
    ("warfarin", "Coumadin", "five milligrams", "once a day"),
    ("lisinopril", "Zestril", "ten milligrams", "once daily"),
    ("metformin", "Glucophage", "five hundred milligrams", "twice a day"),
    ("atorvastatin", "Lipitor", "twenty milligrams", "at bedtime"),
    ("amlodipine", "Norvasc", "five milligrams", "once a day"),
    ("sertraline", "Zoloft", "fifty milligrams", "once daily"),
    ("gabapentin", "Neurontin", "three hundred milligrams", "three times a day"),
    ("omeprazole", "Prilosec", "twenty milligrams", "once daily"),
    ("furosemide", "Lasix", "forty milligrams", "once a day"),
    ("escitalopram", "Lexapro", "ten milligrams", "once daily"),
    ("metoprolol", "Lopressor", "twenty five milligrams", "twice daily"),
    ("losartan", "Cozaar", "fifty milligrams", "once a day"),
    ("levothyroxine", "Synthroid", "fifty micrograms", "once daily"),
    ("albuterol", "Ventolin", "two point five milligrams", "as needed"),
    ("prednisone", "Deltasone", "ten milligrams", "once daily"),
]

DRUG_TEMPLATES = [
    "I take {name} {dose} {frequency}",
    "My doctor prescribed {name} {dose}",
    "I need a refill for {name}",
    "I have been on {name} {dose} for two years",
    "Can I get more {name}",
    "My {name} prescription is running out",
    "I started taking {name} {dose} last month",
    "I am on {name} {dose} {frequency}",
]

# Numeric confusion pairs — both sides trained so model learns the distinction
NUMERIC_CONFUSION_PAIRS = [
    ("take fifteen milligrams", "take fifteen milligrams"),
    ("take fifty milligrams", "take fifty milligrams"),
    ("fourteen units of insulin", "fourteen units of insulin"),
    ("forty units of insulin", "forty units of insulin"),
    ("nineteen milligrams", "nineteen milligrams"),
    ("ninety milligrams", "ninety milligrams"),
    ("eighteen tablets", "eighteen tablets"),
    ("eighty tablets", "eighty tablets"),
    ("thirteen milligrams", "thirteen milligrams"),
    ("thirty milligrams", "thirty milligrams"),
    ("fifteen units", "fifteen units"),
    ("fifty units", "fifty units"),
    ("pain is nine out of ten", "pain is nine out of ten"),
    ("pain is five out of ten", "pain is five out of ten"),
]

SYMPTOM_TEMPLATES = [
    "My pain is about {n} out of ten",
    "I have had this symptom for {n} days",
    "I missed my {name} dose this morning",
    "I stopped taking {name} last week",
    "I have chest pain",
    "I am having trouble breathing",
    "No chest pain today",
    "I do not have shortness of breath",
    "I feel dizzy when I stand up",
    "My blood pressure reading was {n} over {m}",
    "I have been feeling nauseous since I started {name}",
    "The swelling in my legs has gotten worse",
]


async def _synthesize(text: str, voice: str, path: str) -> None:
    """Synthesize text to mp3 then save."""
    communicate = edge_tts.Communicate(text, voice)
    await communicate.save(path)


def _tts_to_wav(text: str, voice: str, output_path: str, snr_db: float = None) -> None:
    """TTS → load → telephony simulation → optional noise → save as 16kHz wav."""
    mp3_path = output_path.replace(".wav", "_tmp.mp3")
    asyncio.run(_synthesize(text, voice, mp3_path))
    audio, sr = librosa.load(mp3_path, sr=16000, mono=True)
    os.remove(mp3_path)
    audio = simulate_telephony(audio, sr)
    if snr_db is not None:
        noise = white_noise(len(audio))
        audio = add_noise(audio, noise, snr_db=snr_db)
    sf.write(output_path, audio, 16000)


def generate_dataset(output_dir: str) -> list[dict]:
    """
    Generate all synthetic samples. Returns list of {audio, text} dicts.
    Saves a manifest.json to output_dir.
    """
    Path(output_dir).mkdir(parents=True, exist_ok=True)
    samples = []
    snr_choices = [None, 15.0, 10.0, 8.0]  # None = clean

    # Drug mention samples
    for drug, brand, dose, freq in DRUGS:
        for template in DRUG_TEMPLATES:
            for name in [drug, brand]:
                text = template.format(name=name, dose=dose, frequency=freq)
                for voice in random.sample(VOICES, 2):
                    snr = random.choice(snr_choices)
                    uid = abs(hash(text + voice + str(snr))) % 1_000_000
                    path = os.path.join(output_dir, f"drug_{uid}.wav")
                    if not os.path.exists(path):
                        _tts_to_wav(text, voice, path, snr)
                    samples.append({"audio": path, "text": text})

    # Numeric confusion pairs
    for text, reference in NUMERIC_CONFUSION_PAIRS:
        for voice in VOICES:
            snr = random.choice(snr_choices)
            uid = abs(hash(text + voice + str(snr))) % 1_000_000
            path = os.path.join(output_dir, f"numeric_{uid}.wav")
            if not os.path.exists(path):
                _tts_to_wav(text, voice, path, snr)
            samples.append({"audio": path, "text": reference})

    # Symptom samples
    for template in SYMPTOM_TEMPLATES:
        for drug, _, _, _ in DRUGS[:5]:
            text = template.format(
                n=random.randint(1, 10),
                m=random.randint(60, 90),
                name=drug,
            )
            for voice in random.sample(VOICES, 2):
                snr = random.choice(snr_choices)
                uid = abs(hash(text + voice + str(snr))) % 1_000_000
                path = os.path.join(output_dir, f"symptom_{uid}.wav")
                if not os.path.exists(path):
                    _tts_to_wav(text, voice, path, snr)
                samples.append({"audio": path, "text": text})

    manifest_path = os.path.join(output_dir, "manifest.json")
    with open(manifest_path, "w") as f:
        json.dump(samples, f, indent=2)

    print(f"Generated {len(samples)} synthetic samples → {manifest_path}")
    return samples


if __name__ == "__main__":
    generate_dataset("./synthetic_audio")
