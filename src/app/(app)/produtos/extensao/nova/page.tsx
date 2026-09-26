import type { Metadata } from "next";

import { criarPeca } from "@/app/(app)/produtos/extensao/actions";
import FormularioPeca from "@/components/produtos/FormularioPeca";
import { listarSugestoes } from "@/lib/pecas-extensao/consultas";

export const metadata: Metadata = {
  title: "Nova peça — Essenza",
};

export default async function NovaPecaPage() {
  const { cores, texturas, origens } = await listarSugestoes();

  return (
    <div className="space-y-4">
      <h2 className="text-lg font-semibold text-neutral-900">
        Nova peça de extensão
      </h2>

      <FormularioPeca
        acao={criarPeca}
        cores={cores}
        texturas={texturas}
        origens={origens}
        rotuloEnviar="Cadastrar"
      />
    </div>
  );
}
