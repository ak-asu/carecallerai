import { GoogleGenerativeAI } from '@google/generative-ai'

const genai = new GoogleGenerativeAI(process.env.GEMINI_API_KEY!)
const model = genai.getGenerativeModel({ model: 'gemini-2.0-flash' })

export async function summarizeCall(transcript: string, language: string): Promise<{
  summary: string
  severity: number
  symptoms: string[]
  medicationChanges: string[]
  followUpRequired: boolean
}> {
  const prompt = `You are a clinical documentation assistant. Analyze this patient call transcript and return ONLY valid JSON.

Transcript: "${transcript}"

Return:
{
  "summary": "2-3 sentence clinical summary",
  "severity": 0-10,
  "symptoms": ["list of reported symptoms"],
  "medicationChanges": ["list of any medication changes mentioned"],
  "followUpRequired": true/false
}

Severity scale: 0=no concerns, 5=moderate (follow up within 24h), 8=urgent (follow up within 4h), 10=emergency.
Be conservative — only escalate severity if clearly warranted by the transcript.`

  const result = await model.generateContent(prompt)
  const text = result.response.text().replace(/```json\n?|\n?```/g, '').trim()
  return JSON.parse(text)
}
