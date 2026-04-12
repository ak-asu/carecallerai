"""
Modal.com serving endpoint for CareCaller STT.

Deploy:
    modal deploy stt/serve/modal_app.py

Test:
    modal run stt/serve/modal_app.py

The deployed endpoint URL goes into CUSTOM_STT_URL in .env.local
"""
import modal

app = modal.App("carecaller-stt")

image = (
    modal.Image.debian_slim(python_version="3.11")
    .apt_install("libsndfile1", "ffmpeg")
    .pip_install(
        "faster-whisper==1.0.3",
        "numpy>=1.24.0",
        "librosa>=0.10.1",
        "soundfile>=0.12.1",
    )
)

# Persistent volume for model weights — upload fine-tuned checkpoint here
model_volume = modal.Volume.from_name("carecaller-stt-model", create_if_missing=True)
MODEL_DIR = "/model"


@app.cls(
    image=image,
    gpu="T4",
    volumes={MODEL_DIR: model_volume},
    container_idle_timeout=300,  # keep warm for 5 min between calls
)
class WhisperSTT:

    @modal.build()
    def download_base_model(self):
        """Download whisper-small at build time as fallback."""
        from faster_whisper import WhisperModel
        WhisperModel("small", download_root=f"{MODEL_DIR}/base", device="cpu")

    @modal.enter()
    def load_model(self):
        import os
        from faster_whisper import WhisperModel

        finetuned_path = f"{MODEL_DIR}/finetuned"
        if os.path.isdir(finetuned_path) and os.listdir(finetuned_path):
            print(f"Loading fine-tuned model from {finetuned_path}")
            self.model = WhisperModel(finetuned_path, device="cuda", compute_type="float16")
            self.model_name = "finetuned"
        else:
            print("Fine-tuned model not found -- loading whisper-small base")
            self.model = WhisperModel("small", device="cuda", compute_type="float16")
            self.model_name = "whisper-small-base"

    @modal.web_endpoint(method="POST")
    def transcribe(self, request: dict) -> dict:
        """
        Request body:
        {
          "audio_base64": "<base64-encoded WAV or MP3 bytes>",
          "patient_meds": ["warfarin", "lisinopril"]  // optional
        }

        Response:
        {
          "transcript": "I take warfarin five milligrams once a day",
          "words": [{"word": "I", "start": 0.0, "end": 0.2, "confidence": 0.98}, ...],
          "model": "finetuned"
        }
        """
        import base64
        import io

        import librosa
        import numpy as np
        import soundfile as sf

        audio_b64 = request.get("audio_base64", "")
        patient_meds = request.get("patient_meds", [])

        if not audio_b64:
            return {"error": "audio_base64 is required", "transcript": "", "words": []}

        # Decode and load audio
        audio_bytes = base64.b64decode(audio_b64)
        audio_arr, sr = sf.read(io.BytesIO(audio_bytes))
        audio_arr = audio_arr.astype(np.float32)

        # Ensure mono
        if audio_arr.ndim > 1:
            audio_arr = audio_arr.mean(axis=1)

        # Resample to 16kHz if needed
        if sr != 16000:
            audio_arr = librosa.resample(audio_arr, orig_sr=sr, target_sr=16000)

        # Build initial prompt from patient medication list
        initial_prompt = None
        if patient_meds:
            meds_str = ", ".join(str(m) for m in patient_meds[:20])  # cap at 20
            initial_prompt = (
                f"Patient medications: {meds_str}. Medical phone call transcription."
            )

        segments, _info = self.model.transcribe(
            audio_arr,
            initial_prompt=initial_prompt,
            language="en",
            word_timestamps=True,
            vad_filter=True,   # skip silence chunks
            vad_parameters={"min_silence_duration_ms": 300},
        )

        transcript_parts = []
        words = []
        for seg in segments:
            transcript_parts.append(seg.text.strip())
            for w in seg.words:
                words.append({
                    "word": w.word.strip(),
                    "start": round(w.start, 3),
                    "end": round(w.end, 3),
                    "confidence": round(w.probability, 4),
                })

        return {
            "transcript": " ".join(transcript_parts).strip(),
            "words": words,
            "model": self.model_name,
        }


@app.local_entrypoint()
def test():
    """Quick smoke test -- run with: modal run stt/serve/modal_app.py"""
    import base64
    import io

    import numpy as np
    import soundfile as sf

    # 1 second of silence
    silence = np.zeros(16000, dtype=np.float32)
    buf = io.BytesIO()
    sf.write(buf, silence, 16000, format="WAV")
    audio_b64 = base64.b64encode(buf.getvalue()).decode()

    stt = WhisperSTT()
    result = stt.transcribe.remote({
        "audio_base64": audio_b64,
        "patient_meds": ["warfarin", "lisinopril"],
    })
    print(f"Smoke test result: {result}")
    assert "transcript" in result, "Missing transcript key"
    assert "words" in result, "Missing words key"
    print("Modal endpoint smoke test passed.")
