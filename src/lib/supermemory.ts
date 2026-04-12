import Supermemory from "supermemory";

let client: Supermemory | null = null;

function getSupermemoryClient() {
  const apiKey = process.env.SUPERMEMORY_API_KEY;

  if (!apiKey) {
    throw new Error(
      "Missing SUPERMEMORY_API_KEY. Set SUPERMEMORY_API_KEY before using Supermemory features.",
    );
  }

  if (!client) {
    client = new Supermemory({ apiKey });
  }

  return client;
}

export async function addMemory(
  patientId: string,
  content: string,
): Promise<void> {
  const client = getSupermemoryClient();

  await client.add({ content, metadata: { patientId } });
}

export async function queryMemory(
  patientId: string,
  query: string,
): Promise<string> {
  try {
    const client = getSupermemoryClient();
    const res = await client.search.execute({
      q: query,
      filters: {
        AND: [{ key: "patientId", value: patientId, filterType: "metadata" }],
      },
      limit: 5,
    });

    return (res.results ?? []).map((r) => r.content ?? "").join("\n");
  } catch {
    return "";
  }
}
