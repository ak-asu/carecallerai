CareCaller.ai ASU Hackathon Problem Statement 
Problem Statement: Robust STT for real world Telephony-Based Voice 
Systems 
In telephony-based voice interactions, speech recognition accuracy often degrades due to 
real-world constraints such as poor network quality, limited audio bandwidth, background 
noise, speaker accents, and variations in fluency or grammar. 
Participants are tasked with building a robust speech-to-text (STT) system capable of 
delivering high transcription accuracy across diverse and challenging conditions, including: 
● Low-quality telephony audio (narrowband frequencies) 
● Background noise and interruptions 
● Diverse accents and pronunciation styles 
● Non-standard grammar and conversational speech patterns 
● Accurate numeric capture, especially in cases where similar-sounding numbers 
(e.g., “fifteen” vs “fifty”, “nine” vs “five”) are often misinterpreted 
● Reliable recognition of domain-specific terminology, particularly addressing 
cases where drug names are commonly misunderstood or incorrectly 
transcribed. 
Expected Solution Direction 
Participants are expected to design systems that: 
● Improve robustness to telephony-specific artifacts such as compression noise and 
low sampling rates 
● Handle variability in speech patterns, accents, and conversational styles 
● Incorporate mechanisms for context-aware correction, especially for numerics and 
critical terms 
● Improve recognition accuracy for domain-specific vocabulary, including medical 
terminology 
● Balance transcription accuracy with low latency, enabling near real-time usage 
● Generalize effectively across unseen audio conditions rather than overfitting to clean 
datasets 
Additional Technical Context (Telephony Audio) 
Telephony systems typically operate at a sampling rate of 8000 Hz (8 kHz), standard in 
protocols such as G.711 (μ-law and A-law). 
For compatibility with real-world telephony pipelines: 
● Audio used for training, inference, and evaluation should be recorded or resampled 
to 8 kHz 
● Higher sampling rates (e.g., 16 kHz, 44.1 kHz) should be downsampled carefully to 
avoid aliasing 
● Recording pipelines should explicitly set the sample rate to 8 kHz prior to export 
Note: μ-law encoding introduces quantization noise but improves the dynamic range of 
speech signals; robust systems should be resilient to such artifacts. 
Evaluation Criteria 
Submissions will be evaluated based on: 
● Transcription accuracy across varied audio conditions 
● Robustness to background noise, accents, and telephony constraints 
● Accuracy in capturing numerics and critical entities 
● Handling of domain-specific vocabulary, particularly medical terminology 
● Latency and real-time performance 
Evaluation will be conducted using standardized telephony audio test sets, including: 
● Clean speech 
● Noisy environments 
● Accented speech 
● Medically relevant conversations 
Pre-recorded benchmark audio samples will be used to assess accuracy, consistency, and 
robustness across scenarios. 
Metrics 
Evaluation metrics may include: 
● Word Error Rate (WER) 
● Character Error Rate (CER) 
● Numeric accuracy / digit-level accuracy 
● Domain-specific keyword accuracy (especially medical terminology) 
Note 
Integrating the solution with a telephony-based voice agent or audio interaction system is 
strongly encouraged, as it enables more effective evaluation in realistic usage scenarios. 