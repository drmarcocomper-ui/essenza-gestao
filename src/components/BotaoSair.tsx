"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { LogOut } from "lucide-react";

import { createClient } from "@/lib/supabase/client";

export default function BotaoSair() {
  const router = useRouter();
  const [saindo, setSaindo] = useState(false);

  async function sair() {
    setSaindo(true);

    const supabase = createClient();
    await supabase.auth.signOut();

    router.replace("/login");
    // Limpa o cache do Router Server para a sessão encerrada não voltar.
    router.refresh();
  }

  return (
    <button
      type="button"
      onClick={sair}
      disabled={saindo}
      className="inline-flex min-h-11 items-center justify-center gap-2 rounded-xl border border-neutral-300 bg-white px-4 font-medium text-neutral-700 active:bg-neutral-100 disabled:opacity-60"
    >
      <LogOut aria-hidden="true" className="size-5" />
      {saindo ? "Saindo…" : "Sair"}
    </button>
  );
}
