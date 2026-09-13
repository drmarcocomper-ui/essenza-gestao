import { createBrowserClient } from "@supabase/ssr";

import { supabaseEnv } from "./env";

/**
 * Cliente Supabase para uso no browser (Client Components).
 * Sessão persistida em cookie para que o proxy e os Server Components
 * enxerguem o mesmo login.
 *
 * Sem `options`: o createBrowserClient já entra com persistSession e
 * autoRefreshToken ligados, que é o que mantém a usuária logada entre
 * um uso e outro. Não sobrescrever.
 */
export function createClient() {
  const { url, anonKey } = supabaseEnv();

  return createBrowserClient(url, anonKey);
}
