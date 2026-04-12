const TAVILY_URL = 'https://api.tavily.com/search'

export async function searchMedSavings(drugName: string): Promise<string[]> {
  try {
    const res = await fetch(TAVILY_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        api_key: process.env.TAVILY_API_KEY!,
        query: `${drugName} patient savings program coupon discount GoodRx`,
        search_depth: 'basic',
        max_results: 3,
        include_domains: ['goodrx.com', 'rxsaver.com', 'needymeds.org', 'pparx.org'],
      }),
    })
    if (!res.ok) return []
    const data = await res.json()
    return (data.results ?? []).map((r: { url: string; title: string }) => `${r.title}: ${r.url}`)
  } catch {
    return []
  }
}
