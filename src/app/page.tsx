import { redirect } from "next/navigation";

import { createClient } from "@/lib/supabase/server";

/** A raiz não tem tela própria: manda para /hoje ou para o login. */
export default async function Home() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  redirect(user ? "/hoje" : "/login");
}
