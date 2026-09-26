import type { Metadata } from "next";
import { notFound } from "next/navigation";

import { atualizarPeca } from "@/app/(app)/produtos/extensao/actions";
import BotaoExcluirPeca from "@/components/produtos/BotaoExcluirPeca";
import FormularioPeca from "@/components/produtos/FormularioPeca";
import {
  listarSugestoes,
  obterPeca,
  pecaTemFilhas,
} from "@/lib/pecas-extensao/consultas";
import { MENSAGEM_EXCLUSAO_TRAVADA } from "@/lib/pecas-extensao/regras";

export const metadata: Metadata = {
  title: "Editar peça — Essenza",
};

export default async function EditarPecaPage({
  params,
}: PageProps<"/produtos/extensao/[id]">) {
  const { id } = await params;

  const peca = await obterPeca(id);

  if (!peca) {
    notFound();
  }

  const [desmembrada, { cores, texturas }] = await Promise.all([
    pecaTemFilhas(peca.id),
    listarSugestoes(),
  ]);

  return (
    <div className="space-y-4">
      <h2 className="text-lg font-semibold text-neutral-900">
        Peça {peca.codigo}
      </h2>

      <FormularioPeca
        // O id vem amarrado no servidor: não trafega em campo escondido.
        acao={atualizarPeca.bind(null, peca.id)}
        peca={peca}
        codigoTravado={desmembrada}
        cores={cores}
        texturas={texturas}
        rotuloEnviar="Salvar"
      />

      <div className="border-t border-neutral-200 pt-4">
        {desmembrada ? (
          <p className="text-sm text-neutral-500">{MENSAGEM_EXCLUSAO_TRAVADA}</p>
        ) : (
          <BotaoExcluirPeca id={peca.id} codigo={peca.codigo} />
        )}
      </div>
    </div>
  );
}
