import type { Database } from "./database.types";

import { createClient, type SupabaseClient } from "@supabase/supabase-js";

type AppSupabaseClient = SupabaseClient<Database>;

function getSupabaseUrl() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;

  if (!url) {
    throw new Error("Missing Supabase URL. Set NEXT_PUBLIC_SUPABASE_URL.");
  }

  return url;
}

let browserClient: AppSupabaseClient | null = null;
let adminClient: AppSupabaseClient | null = null;

function getSupabaseBrowserClient() {
  const publishable =
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ??
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (!publishable) {
    throw new Error(
      "Missing Supabase browser key. Set NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY (preferred) or NEXT_PUBLIC_SUPABASE_ANON_KEY.",
    );
  }

  if (!browserClient) {
    browserClient = createClient<Database>(getSupabaseUrl(), publishable);
  }

  return browserClient;
}

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
    adminClient = createClient<Database>(getSupabaseUrl(), secret, {
      auth: { persistSession: false },
    });
  }

  return adminClient;
}

// Browser client (respects RLS) — lazily initialized so server-only imports don't require browser env vars at build time.
export const supabaseBrowser = new Proxy({} as AppSupabaseClient, {
  get(_target, prop, _receiver) {
    const client = getSupabaseBrowserClient();
    const value = Reflect.get(client as unknown as object, prop);

    return typeof value === "function"
      ? (value as (...args: unknown[]) => unknown).bind(client)
      : value;
  },
});

// Server/admin client (bypasses RLS) — lazily initialized so browser bundles don't evaluate server env checks.
export const supabaseAdmin = new Proxy({} as AppSupabaseClient, {
  get(_target, prop, _receiver) {
    const client = getSupabaseAdminClient();
    const value = Reflect.get(client as unknown as object, prop);

    return typeof value === "function"
      ? (value as (...args: unknown[]) => unknown).bind(client)
      : value;
  },
});
