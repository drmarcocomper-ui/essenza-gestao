import type { Metadata } from "next";
import { redirect } from "next/navigation";

import BotaoSair from "@/components/BotaoSair";
import { createClient } from "@/lib/supabase/server";

export const metadata: Metadata = {
  title: "Hoje — Essenza",
};

export default async function HojePage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  // O middleware já barra quem não tem sessão; isto é o cinto de segurança
  // e é o que estreita o tipo de `user` para o TypeScript.
  if (!user) {
    redirect("/login");
  }

  return (
    <div className="space-y-6">
      <section className="rounded-2xl border border-neutral-200 bg-white p-4">
        <p className="text-sm text-neutral-500">Conectada como</p>
        <p className="mt-1 font-medium break-all text-neutral-900">
          {user.email}
        </p>
      </section>

      <p className="text-neutral-600">
        A agenda do dia aparece aqui em breve.
      </p>

      <BotaoSair />
    </div>
  );
}
