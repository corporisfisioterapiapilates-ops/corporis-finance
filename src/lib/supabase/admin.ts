import { createClient } from "@supabase/supabase-js";

import type { Database } from "./types";

// Service role — bypassa RLS. APENAS em scripts/Edge Functions, nunca em
// código que roda no browser (CLAUDE.md §6, §15).
export function createAdminClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) {
    throw new Error("Configuração do Supabase admin ausente.");
  }
  return createClient<Database>(url, key, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
}
