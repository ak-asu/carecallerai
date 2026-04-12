"""
Fine-tune openai/whisper-small on telephony + medical audio.
Designed for Google Colab T4 (12GB VRAM).

Run from stt/ directory:
    python train/fine_tune.py

Checkpoint saved to: stt/checkpoints/whisper-telephony-medical-final/
Upload that directory to Modal volume after training.
"""
import sys
import os
import random

sys.path.insert(0, os.path.join(os.path.dirname(__file__), ".."))

import numpy as np
import torch
from dataclasses import dataclass
from typing import Any, Dict, List, Union

import evaluate
from datasets import Dataset
from transformers import (
    WhisperForConditionalGeneration,
    WhisperProcessor,
    Seq2SeqTrainingArguments,
    Seq2SeqTrainer,
)

from data.prepare import stream_librispeech, stream_commonvoice, load_synthetic
from data.synthetic import generate_dataset
from data.augment import simulate_telephony

MODEL_NAME = "openai/whisper-small"
SAMPLE_RATE = 16000
CHECKPOINT_DIR = "./checkpoints"
SYNTHETIC_DIR = "./data/synthetic_audio"

processor = WhisperProcessor.from_pretrained(MODEL_NAME, language="English", task="transcribe")
wer_metric = evaluate.load("wer")


@dataclass
class DataCollatorSpeechSeq2SeqWithPadding:
    processor: Any

    def __call__(self, features: List[Dict[str, Union[List[int], torch.Tensor]]]) -> Dict[str, torch.Tensor]:
        input_features = [{"input_features": f["input_features"]} for f in features]
        batch = self.processor.feature_extractor.pad(input_features, return_tensors="pt")
        label_features = [{"input_ids": f["labels"]} for f in features]
        labels_batch = self.processor.tokenizer.pad(label_features, return_tensors="pt")
        labels = labels_batch["input_ids"].masked_fill(labels_batch.attention_mask.ne(1), -100)
        if (labels[:, 0] == self.processor.tokenizer.bos_token_id).all().cpu().item():
            labels = labels[:, 1:]
        batch["labels"] = labels
        return batch


def prepare_sample(sample: dict) -> dict | None:
    """Convert raw {audio, text} to model inputs. Returns None for invalid samples."""
    audio = sample["audio"]
    text = sample["text"].strip()
    if len(text) < 2:
        return None
    # Whisper expects max 30 seconds at 16kHz = 480,000 samples
    if len(audio) > 480_000:
        audio = audio[:480_000]
    input_features = processor.feature_extractor(
        audio, sampling_rate=SAMPLE_RATE, return_tensors="np"
    ).input_features[0]
    labels = processor.tokenizer(text).input_ids
    return {"input_features": input_features, "labels": labels}


def compute_metrics(pred) -> dict:
    pred_ids = pred.predictions
    label_ids = pred.label_ids
    label_ids[label_ids == -100] = processor.tokenizer.pad_token_id
    pred_str = processor.tokenizer.batch_decode(pred_ids, skip_special_tokens=True)
    label_str = processor.tokenizer.batch_decode(label_ids, skip_special_tokens=True)
    wer = 100 * wer_metric.compute(predictions=pred_str, references=label_str)
    return {"wer": round(wer, 2)}


def build_dataset() -> tuple[Dataset, Dataset]:
    """Collect all samples, prepare features, split 95/5 train/eval."""
    all_raw = []

    print("Streaming LibriSpeech...")
    all_raw.extend(list(stream_librispeech(max_samples=5000)))

    print("Streaming CommonVoice...")
    all_raw.extend(list(stream_commonvoice(max_samples=3000)))

    print("Generating synthetic medical audio...")
    generate_dataset(SYNTHETIC_DIR)
    all_raw.extend(list(load_synthetic(f"{SYNTHETIC_DIR}/manifest.json")))

    print(f"Total raw samples: {len(all_raw)}")
    random.shuffle(all_raw)

    print("Preparing features...")
    processed = []
    for s in all_raw:
        result = prepare_sample(s)
        if result is not None:
            processed.append(result)

    print(f"Valid samples after preparation: {len(processed)}")
    split = int(0.95 * len(processed))
    train_ds = Dataset.from_list(processed[:split])
    eval_ds = Dataset.from_list(processed[split:])
    return train_ds, eval_ds


def main():
    import argparse
    parser = argparse.ArgumentParser()
    parser.add_argument("--resume_from_checkpoint", type=str, default=None,
                        help="Path to a checkpoint directory to resume training from")
    args = parser.parse_args()

    print(f"CUDA available: {torch.cuda.is_available()}")
    if torch.cuda.is_available():
        print(f"GPU: {torch.cuda.get_device_name(0)}, VRAM: {torch.cuda.get_device_properties(0).total_memory / 1e9:.1f}GB")

    resume_path = args.resume_from_checkpoint
    if resume_path:
        print(f"Resuming from checkpoint: {resume_path}")

    print(f"Loading {MODEL_NAME}...")
    model = WhisperForConditionalGeneration.from_pretrained(MODEL_NAME)
    model.generation_config.language = "english"
    model.generation_config.task = "transcribe"
    model.generation_config.forced_decoder_ids = None

    train_ds, eval_ds = build_dataset()
    data_collator = DataCollatorSpeechSeq2SeqWithPadding(processor=processor)

    training_args = Seq2SeqTrainingArguments(
        output_dir=CHECKPOINT_DIR,
        per_device_train_batch_size=8,
        per_device_eval_batch_size=8,
        gradient_accumulation_steps=2,   # effective batch = 16
        learning_rate=1e-5,
        warmup_steps=100,
        max_steps=2000,                  # ~2.5 hrs on Colab T4
        gradient_checkpointing=True,
        fp16=True,
        eval_strategy="steps",
        predict_with_generate=True,
        generation_max_length=128,
        save_steps=500,
        eval_steps=500,
        logging_steps=25,
        load_best_model_at_end=True,
        metric_for_best_model="wer",
        greater_is_better=False,
        push_to_hub=False,
        dataloader_num_workers=2,
    )

    trainer = Seq2SeqTrainer(
        args=training_args,
        model=model,
        train_dataset=train_ds,
        eval_dataset=eval_ds,
        data_collator=data_collator,
        compute_metrics=compute_metrics,
        processing_class=processor.feature_extractor,
    )

    print("Starting training...")
    trainer.train(resume_from_checkpoint=resume_path)

    final_dir = f"{CHECKPOINT_DIR}/whisper-telephony-medical-final"
    trainer.save_model(final_dir)
    processor.save_pretrained(final_dir)
    print(f"\nTraining complete. Model saved to {final_dir}")
    print("Next step: upload this directory to Modal volume.")
    print("  modal volume put carecaller-stt-model ./checkpoints/whisper-telephony-medical-final /finetuned")


if __name__ == "__main__":
    main()
