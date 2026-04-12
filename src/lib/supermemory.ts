import Supermemory from "supermemory";

const client = new Supermemory({ apiKey: process.env.SUPERMEMORY_API_KEY! });

export async function addMemory(
  patientId: string,
  content: string,
): Promise<void> {
  await client.add({ content, metadata: { patientId } });
}

export async function queryMemory(
  patientId: string,
  query: string,
): Promise<string> {
  try {
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
