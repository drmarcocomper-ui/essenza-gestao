import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Lock } from "lucide-react";

import { atualizarLancamento } from "@/app/(app)/caixa/actions";
import BotaoExcluir from "@/components/caixa/BotaoExcluir";
import FormularioLancamento from "@/components/caixa/FormularioLancamento";
import {
  listarCategorias,
  listarInstituicoes,
  obterLancamento,
} from "@/lib/caixa/consultas";
import { exclusaoTravada } from "@/lib/caixa/travas";
import { formatarData } from "@/lib/formatters";

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

  // Entrada de conta: o dinheiro é da conta do atendimento, e só muda
  // reabrindo-a. A conta mora em /clientes/<cliente>/atendimentos/<id>.
  const conta =
    lancamento.atendimento_id && lancamento.cliente_id
      ? {
          href: `/clientes/${lancamento.cliente_id}/atendimentos/${lancamento.atendimento_id}`,
          cliente: lancamento.cliente?.nome ?? "a cliente",
        }
      : null;

  return (
    <div className="space-y-4">
      <h2 className="text-lg font-semibold text-neutral-900">
        Editar lançamento
      </h2>

      {conta && (
        <div className="space-y-2 rounded-xl border border-amber-200 bg-amber-50 px-3 py-3 text-sm text-amber-900">
          <p className="flex gap-2">
            <Lock aria-hidden="true" className="mt-0.5 size-4 shrink-0" />
            <span>
              {/* A competência da conta é a data do atendimento (travada). */}
              Esta entrada é da conta de {conta.cliente} em{" "}
              {formatarData(lancamento.data_competencia)}. Para mudar valor ou
              excluir, reabra a conta.
            </span>
          </p>

          <Link
            href={conta.href}
            className="flex h-11 items-center justify-center rounded-xl border border-amber-300 bg-white font-medium text-amber-900 active:bg-amber-100"
          >
            Abrir o atendimento
          </Link>
        </div>
      )}

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

      {/* Entrada de conta não tem excluir: o aviso do topo diz o caminho. */}
      {!exclusaoTravada(lancamento) && (
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
      )}
    </div>
  );
}
