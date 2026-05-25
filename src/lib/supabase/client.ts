import { createBrowserClient } from "@supabase/ssr";

import type { Database } from "./types";

// Client de browser (Client Components).
export function createClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !key) {
    throw new Error("Configuração do Supabase ausente (NEXT_PUBLIC_*).");
  }
  return createBrowserClient<Database>(url, key);
}
