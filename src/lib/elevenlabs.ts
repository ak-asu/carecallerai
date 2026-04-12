export interface GeneratedSpeech {
  audioBase64: string;
  mimeType: string;
}

export async function generateSpeechFromText(
  text: string,
): Promise<GeneratedSpeech | null> {
  const apiKey = process.env.ELEVENLABS_API_KEY?.trim();
  const voiceId =
    process.env.ELEVENLABS_VOICE_ID?.trim() || "21m00Tcm4TlvDq8ikWAM";

  if (!apiKey || !text.trim()) {
    return null;
  }

  const response = await fetch(
    `https://api.elevenlabs.io/v1/text-to-speech/${voiceId}`,
    {
      method: "POST",
      headers: {
        Accept: "audio/mpeg",
        "Content-Type": "application/json",
        "xi-api-key": apiKey,
      },
      body: JSON.stringify({
        text,
        model_id: "eleven_multilingual_v2",
        voice_settings: {
          stability: 0.45,
          similarity_boost: 0.8,
          style: 0.2,
          use_speaker_boost: true,
        },
      }),
    },
  );

  if (!response.ok) {
    const detail = await response.text();

    throw new Error(`elevenlabs_tts_failed:${response.status}:${detail}`);
  }

  const audioBuffer = Buffer.from(await response.arrayBuffer());

  return {
    audioBase64: audioBuffer.toString("base64"),
    mimeType: "audio/mpeg",
  };
}
