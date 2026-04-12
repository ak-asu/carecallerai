import { tavily } from "@tavily/core";

let client: ReturnType<typeof tavily> | null = null;

function getTavilyClient() {
  const apiKey = process.env.TAVILY_API_KEY;

  if (!apiKey) {
    throw new Error(
      "Missing TAVILY_API_KEY. Set TAVILY_API_KEY before using Tavily.",
    );
  }

  if (!client) {
    client = tavily({ apiKey });
  }

  return client;
}

export async function searchMedSavings(drugName: string): Promise<string[]> {
  try {
    const client = getTavilyClient();
    const res = await client.search(
      `${drugName} patient savings program coupon discount GoodRx`,
      {
        searchDepth: "basic",
        maxResults: 3,
        includeDomains: [
          "goodrx.com",
          "rxsaver.com",
          "needymeds.org",
          "pparx.org",
        ],
      },
    );

    return (res.results ?? []).map((r) => `${r.title}: ${r.url}`);
  } catch {
    return [];
  }
}
