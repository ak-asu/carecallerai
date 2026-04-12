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

    return (res.results ?? [])
      .map((r) => {
        if (r.content) {
          return r.content;
        }

        if (Array.isArray(r.chunks)) {
          return r.chunks
            .map((chunk) => chunk.content ?? "")
            .filter(Boolean)
            .join("\n");
        }

        return "";
      })
      .filter(Boolean)
      .join("\n");
  } catch {
    return "";
  }
}
