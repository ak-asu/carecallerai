import { tavily } from '@tavily/core'

const client = tavily({ apiKey: process.env.TAVILY_API_KEY! })

export async function searchMedSavings(drugName: string): Promise<string[]> {
  try {
    const res = await client.search(
      `${drugName} patient savings program coupon discount GoodRx`,
      {
        searchDepth: 'basic',
        maxResults: 3,
        includeDomains: ['goodrx.com', 'rxsaver.com', 'needymeds.org', 'pparx.org'],
      }
    )
    return (res.results ?? []).map((r) => `${r.title}: ${r.url}`)
  } catch {
    return []
  }
}
