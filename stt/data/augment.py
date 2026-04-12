"""
Audio augmentation for telephony simulation.
All functions operate on float32 numpy arrays normalized to [-1, 1].
Input/output sample rate is 16000 Hz (Whisper's expected rate).
"""
import numpy as np
import librosa


def simulate_telephony(audio: np.ndarray, sr: int) -> np.ndarray:
    """
    Simulate G.711 telephony pipeline:
    1. Downsample to 8kHz (strips frequencies above 4kHz as real phone does)
    2. Apply μ-law encode/decode (quantization noise, dynamic range compression)
    3. Upsample back to 16kHz for Whisper's feature extractor

    This teaches Whisper the telephony frequency distribution without
    requiring a custom feature extractor.
    """
    audio = audio.astype(np.float32)
    # Step 1: Downsample to 8kHz
    audio_8k = librosa.resample(audio, orig_sr=sr, target_sr=8000)
    # Step 2: μ-law simulation
    audio_8k = _apply_mulaw(audio_8k)
    # Step 3: Upsample back to 16kHz
    return librosa.resample(audio_8k, orig_sr=8000, target_sr=16000)


def _apply_mulaw(audio: np.ndarray, mu: int = 255) -> np.ndarray:
    """Apply μ-law compression then expansion (G.711 quantization noise)."""
    audio = np.clip(audio, -1.0, 1.0)
    # Compress
    compressed = np.sign(audio) * np.log1p(mu * np.abs(audio)) / np.log1p(mu)
    # Quantize to 8-bit range and back
    quantized = np.round(compressed * 127).astype(np.int8)
    # Expand
    expanded = np.sign(quantized) * (
        np.exp(np.abs(quantized.astype(np.float32) / 127) * np.log1p(mu)) - 1
    ) / mu
    return expanded.astype(np.float32)


def add_noise(audio: np.ndarray, noise: np.ndarray, snr_db: float) -> np.ndarray:
    """
    Mix noise into audio at target SNR (dB).
    Noise array is trimmed or tiled to match audio length.
    """
    audio_power = np.mean(audio ** 2)
    noise_power = np.mean(noise ** 2)
    if noise_power < 1e-10:
        return audio
    target_noise_power = audio_power / (10 ** (snr_db / 10))
    noise_scaled = noise * np.sqrt(target_noise_power / (noise_power + 1e-10))
    # Match length
    if len(noise_scaled) < len(audio):
        repeats = int(np.ceil(len(audio) / len(noise_scaled)))
        noise_scaled = np.tile(noise_scaled, repeats)
    noise_scaled = noise_scaled[: len(audio)]
    return np.clip(audio + noise_scaled, -1.0, 1.0)


def speed_perturb(audio: np.ndarray, rate: float) -> np.ndarray:
    """
    Speed perturbation without pitch shift.
    rate < 1.0 → slower, rate > 1.0 → faster.
    Typical range: 0.9 – 1.3
    """
    return librosa.effects.time_stretch(audio, rate=rate)


def white_noise(length: int, amplitude: float = 0.005) -> np.ndarray:
    """Generate white noise array of given length."""
    return (np.random.randn(length) * amplitude).astype(np.float32)
