const BASE_URL = 'https://api.supermemory.ai/v3'
const headers = () => ({
  Authorization: `Bearer ${process.env.SUPERMEMORY_API_KEY!}`,
  'Content-Type': 'application/json',
})

export async function addMemory(patientId: string, content: string): Promise<void> {
  await fetch(`${BASE_URL}/memories`, {
    method: 'POST',
    headers: headers(),
    body: JSON.stringify({ content, metadata: { patientId } }),
  })
}

export async function queryMemory(patientId: string, query: string): Promise<string> {
  const res = await fetch(`${BASE_URL}/search`, {
    method: 'POST',
    headers: headers(),
    body: JSON.stringify({ q: query, metadata: { patientId }, limit: 5 }),
  })
  if (!res.ok) return ''
  const data = await res.json()
  return (data.results ?? []).map((r: { content: string }) => r.content).join('\n')
}
