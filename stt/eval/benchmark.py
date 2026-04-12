"""
STT Evaluation Benchmark.

Usage:
    # Baseline only (before fine-tuning):
    cd stt && python eval/benchmark.py

    # Baseline vs fine-tuned:
    cd stt && python eval/benchmark.py ./checkpoints/whisper-telephony-medical-final

Outputs:
    - Printed table
    - results/benchmark_results.json
"""
import json
import os
import re
import sys

import numpy as np
import jiwer
from faster_whisper import WhisperModel

KNOWN_DRUGS = [
    "warfarin", "coumadin", "lisinopril", "zestril", "metformin", "glucophage",
    "atorvastatin", "lipitor", "amlodipine", "norvasc", "sertraline", "zoloft",
    "gabapentin", "neurontin", "omeprazole", "prilosec", "furosemide", "lasix",
    "escitalopram", "lexapro", "metoprolol", "lopressor", "losartan", "cozaar",
    "levothyroxine", "synthroid", "albuterol", "ventolin", "prednisone",
]

WORD_NORMALIZE = jiwer.Compose([
    jiwer.ToLowerCase(),
    jiwer.RemovePunctuation(),
    jiwer.Strip(),
    jiwer.ReduceToListOfListOfWords(),
])


def _load_model(path_or_name: str) -> WhisperModel:
    """Load faster-whisper model. CPU int8 is fast enough for eval."""
    return WhisperModel(path_or_name, device="cpu", compute_type="int8")


def _transcribe(model: WhisperModel, audio_path: str) -> str:
    segments, _ = model.transcribe(audio_path, language="en", word_timestamps=False)
    return " ".join(seg.text.strip() for seg in segments).strip()


def compute_wer(refs: list[str], hyps: list[str]) -> float:
    return jiwer.wer(refs, hyps, reference_transform=WORD_NORMALIZE, hypothesis_transform=WORD_NORMALIZE)


def compute_cer(refs: list[str], hyps: list[str]) -> float:
    return jiwer.cer([r.lower() for r in refs], [h.lower() for h in hyps])


def compute_medical_recall(refs: list[str], hyps: list[str]) -> float:
    hits, total = 0, 0
    for ref, hyp in zip(refs, hyps):
        rl, hl = ref.lower(), hyp.lower()
        for drug in KNOWN_DRUGS:
            if drug in rl:
                total += 1
                if drug in hl:
                    hits += 1
    return hits / max(total, 1)


def compute_numeric_accuracy(refs: list[str], hyps: list[str]) -> float:
    correct, total = 0, 0
    for ref, hyp in zip(refs, hyps):
        ref_nums = re.findall(r"\b\d+\b", ref)
        hyp_nums = re.findall(r"\b\d+\b", hyp)
        for n in ref_nums:
            total += 1
            if n in hyp_nums:
                correct += 1
    return correct / max(total, 1)


def evaluate_set(model: WhisperModel, samples: list[dict]) -> dict:
    refs = [s["text"] for s in samples]
    hyps = [_transcribe(model, s["audio"]) for s in samples]
    return {
        "wer_pct": round(compute_wer(refs, hyps) * 100, 2),
        "cer_pct": round(compute_cer(refs, hyps) * 100, 2),
        "medical_recall_pct": round(compute_medical_recall(refs, hyps) * 100, 2),
        "numeric_accuracy_pct": round(compute_numeric_accuracy(refs, hyps) * 100, 2),
        "n_samples": len(samples),
    }


def print_table(results: dict) -> None:
    header = f"\n{'Set':<22} {'Model':<12} {'WER%':>7} {'CER%':>7} {'MedRec%':>9} {'NumAcc%':>9}"
    print("\n" + "=" * 70)
    print("  CareCaller STT Benchmark Results")
    print("=" * 70)
    print(header)
    print("-" * 70)
    for set_name, models in results.items():
        for model_name, metrics in models.items():
            print(
                f"{set_name:<22} {model_name:<12} "
                f"{metrics['wer_pct']:>7} {metrics['cer_pct']:>7} "
                f"{metrics['medical_recall_pct']:>9} {metrics['numeric_accuracy_pct']:>9}"
            )
    print("=" * 70)


def main():
    manifest_path = os.path.join(
        os.path.dirname(__file__), "test_sets", "test_audio", "manifest.json"
    )
    if not os.path.exists(manifest_path):
        print(f"ERROR: manifest not found at {manifest_path}")
        print("Run: python eval/test_sets/generate.py")
        sys.exit(1)

    with open(manifest_path) as f:
        manifest = json.load(f)

    finetuned_path = sys.argv[1] if len(sys.argv) > 1 else None

    print("Loading baseline whisper-small...")
    baseline = _load_model("small")

    finetuned = None
    if finetuned_path:
        print(f"Loading fine-tuned model from {finetuned_path}...")
        finetuned = _load_model(finetuned_path)

    results = {}
    for set_name, samples in manifest.items():
        print(f"\nEvaluating {set_name} ({len(samples)} samples)...")
        results[set_name] = {}
        results[set_name]["baseline"] = evaluate_set(baseline, samples)
        if finetuned:
            results[set_name]["finetuned"] = evaluate_set(finetuned, samples)

    print_table(results)

    os.makedirs("results", exist_ok=True)
    out = "results/benchmark_results.json"
    with open(out, "w") as f:
        json.dump(results, f, indent=2)
    print(f"\nResults saved -> {out}")


if __name__ == "__main__":
    main()
