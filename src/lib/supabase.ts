import { createClient } from "@supabase/supabase-js";

const url = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const publishable =
  process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ??
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const secret =
  process.env.SUPABASE_SECRET_KEY ?? process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!publishable) {
  throw new Error(
    "Missing Supabase browser key. Set NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY (preferred) or NEXT_PUBLIC_SUPABASE_ANON_KEY.",
  );
}

if (!secret) {
  throw new Error(
    "Missing Supabase server key. Set SUPABASE_SECRET_KEY (preferred) or SUPABASE_SERVICE_ROLE_KEY.",
  );
}

// Browser client (respects RLS)
export const supabaseBrowser = createClient(url, publishable);

// Server/admin client (bypasses RLS — use only in API routes and Edge Functions)
export const supabaseAdmin = createClient(url, secret, {
  auth: { persistSession: false },
});
