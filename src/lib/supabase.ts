import { createClient } from "@supabase/supabase-js";

const url = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const publishable =
  process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ??
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

if (!publishable) {
  throw new Error(
    "Missing Supabase browser key. Set NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY (preferred) or NEXT_PUBLIC_SUPABASE_ANON_KEY.",
  );
}

// Browser client (respects RLS)
export const supabaseBrowser = createClient(url, publishable);

let adminClient: ReturnType<typeof createClient> | null = null;

function getSupabaseAdminClient() {
  if (typeof window !== "undefined") {
    throw new Error(
      "supabaseAdmin is server-only and cannot run in the browser.",
    );
  }

  const secret =
    process.env.SUPABASE_SECRET_KEY ?? process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!secret) {
    throw new Error(
      "Missing Supabase server key. Set SUPABASE_SECRET_KEY (preferred) or SUPABASE_SERVICE_ROLE_KEY.",
    );
  }

  if (!adminClient) {
    adminClient = createClient(url, secret, {
      auth: { persistSession: false },
    });
  }

  return adminClient;
}

// Server/admin client (bypasses RLS) — lazily initialized so browser bundles don't evaluate server env checks.
export const supabaseAdmin = new Proxy({} as ReturnType<typeof createClient>, {
  get(_target, prop, _receiver) {
    const client = getSupabaseAdminClient();
    const value = Reflect.get(client as unknown as object, prop);

    return typeof value === "function"
      ? (value as (...args: unknown[]) => unknown).bind(client)
      : value;
  },
});
