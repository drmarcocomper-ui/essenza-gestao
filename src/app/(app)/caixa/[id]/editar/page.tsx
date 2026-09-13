import type { Metadata } from "next";
import { notFound } from "next/navigation";

import { atualizarLancamento } from "@/app/(app)/caixa/actions";
import BotaoExcluir from "@/components/caixa/BotaoExcluir";
import FormularioLancamento from "@/components/caixa/FormularioLancamento";
import {
  listarCategorias,
  listarInstituicoes,
  obterLancamento,
} from "@/lib/caixa/consultas";

export const metadata: Metadata = {
  title: "Editar lançamento — Essenza",
};

export default async function EditarLancamentoPage({
  params,
}: PageProps<"/caixa/[id]/editar">) {
  const { id } = await params;

  const lancamento = await obterLancamento(id);

  if (!lancamento) {
    notFound();
  }

  const [categorias, instituicoes] = await Promise.all([
    listarCategorias(),
    listarInstituicoes(),
  ]);

  // O histórico importado é editável, mas não é apagável: é o registro do
  // que já aconteceu, e a planilha não está mais lá para reconstruir.
  const daPlanilha = lancamento.origem_registro !== "app";

  return (
    <div className="space-y-4">
      <h2 className="text-lg font-semibold text-neutral-900">
        Editar lançamento
      </h2>

      <FormularioLancamento
        // O id vem amarrado no servidor: não trafega em campo escondido.
        acao={atualizarLancamento.bind(null, lancamento.id)}
        lancamento={lancamento}
        tipoInicial={lancamento.tipo}
        categorias={categorias}
        instituicoes={instituicoes}
        rotuloEnviar="Salvar"
        cancelarHref={`/caixa?mes=${lancamento.data_competencia.slice(0, 7)}`}
      />

      <div className="border-t border-neutral-200 pt-4">
        {daPlanilha ? (
          <p className="text-sm text-neutral-500">
            Este lançamento veio da planilha. Pode ser corrigido, mas não
            excluído.
          </p>
        ) : (
          <BotaoExcluir id={lancamento.id} />
        )}
      </div>
    </div>
  );
}
