import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const supabase = createClient(
  Deno.env.get("SUPABASE_URL")!,
  Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
);

const TAVILY_URL = "https://api.tavily.com/search";

Deno.serve(async () => {
  const { data: meds } = await supabase
    .from("medications")
    .select("id, patient_id, drug_name_normalized")
    .eq("active", true);

  for (const med of meds ?? []) {
    const res = await fetch(TAVILY_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        api_key: Deno.env.get("TAVILY_API_KEY"),
        query: `${med.drug_name_normalized} patient savings program coupon GoodRx`,
        search_depth: "basic",
        max_results: 2,
        include_domains: ["goodrx.com", "needymeds.org", "pparx.org"],
      }),
    });

    if (!res.ok) continue;
    const data = await res.json();
    const links = (data.results ?? []).map(
      (r: { url: string; title: string }) => ({ url: r.url, title: r.title }),
    );

    await supabase.from("patient_timeline").insert({
      patient_id: med.patient_id,
      event_type: "savings_found",
      content: { drugName: med.drug_name_normalized, links },
      severity: 0,
      source: "stt_inferred",
    });
  }

  return new Response("ok");
});
