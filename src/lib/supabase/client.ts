import { createBrowserClient } from "@supabase/ssr";

import { supabaseEnv } from "./env";

/**
 * Cliente Supabase para uso no browser (Client Components).
 * Sessão persistida em cookie para que o middleware e os Server
 * Components enxerguem o mesmo login.
 */
export function createClient() {
  const { url, anonKey } = supabaseEnv();

  return createBrowserClient(url, anonKey);
}
