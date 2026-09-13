import { redirect } from "next/navigation";

import { createClient } from "@/lib/supabase/server";

/**
 * Garante sessão e devolve o cliente Supabase já autenticado.
 *
 * O proxy barra a navegação sem login, mas Server Action é um POST que
 * pode ser disparado direto, fora da UI — por isso toda action e toda
 * consulta passa por aqui.
 */
export async function exigirSessao() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  return { supabase, user };
}
