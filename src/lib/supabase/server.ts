import { cookies } from "next/headers";
import { createServerClient } from "@supabase/ssr";

import { supabaseEnv } from "./env";

/**
 * Cliente Supabase para Server Components, Route Handlers e Server Actions.
 * Sempre criar um por request — nunca reaproveitar entre requests.
 *
 * Cookies no padrão getAll/setAll (o antigo get/set/remove é deprecado
 * e quebra em silêncio).
 */
export async function createClient() {
  const { url, anonKey } = supabaseEnv();
  const cookieStore = await cookies();

  return createServerClient(url, anonKey, {
    cookies: {
      getAll() {
        return cookieStore.getAll();
      },
      setAll(cookiesToSet) {
        try {
          cookiesToSet.forEach(({ name, value, options }) => {
            cookieStore.set(name, value, options);
          });
        } catch {
          // Server Component não pode escrever cookies. O refresh de sessão
          // acontece no middleware, então dá para ignorar com segurança.
        }
      },
    },
  });
}
