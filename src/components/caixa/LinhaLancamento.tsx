import Link from "next/link";

import type { LancamentoLista } from "@/lib/caixa/consultas";
import {
  dataReferenciaCaixa,
  marcaCaixa,
  type VisaoCaixa,
} from "@/lib/caixa/visao";
import { formatarDiaMes, formatarMoeda } from "@/lib/formatters";

/**
 * Uma linha da lista do caixa. A linha inteira abre a edição — alvo de
 * toque grande, para usar de pé e com uma mão.
 *
 * Entrada e saída se distinguem por três sinais ao mesmo tempo: a cor da
 * borda, a cor do valor e o sinal antes dele. Cor sozinha não basta.
 *
 * Na visão Caixa a data é a da entrada do dinheiro. Quando ainda não é
 * dinheiro, o selo ao lado da data diz por quê — "Previsto" ou
 * "Pendente" — e ocupa o lugar do selo de status, para não repetir.
 */
export default function LinhaLancamento({
  lancamento,
  visao = "competencia",
}: {
  lancamento: LancamentoLista;
  visao?: VisaoCaixa;
}) {
  const entrada = lancamento.tipo === "Entrada";
  const pendente = lancamento.status === "Pendente";
  const contraparte = entrada
    ? lancamento.cliente?.nome
    : lancamento.fornecedor;
  const caixa = visao === "caixa";
  const data = caixa
    ? dataReferenciaCaixa(lancamento)
    : lancamento.data_competencia;
  const marca = caixa ? marcaCaixa(lancamento) : null;

  return (
    <Link
      href={`/caixa/${lancamento.id}/editar`}
      className={`block rounded-2xl border border-l-4 border-neutral-200 bg-white px-4 py-3 active:bg-neutral-50 ${
        entrada ? "border-l-emerald-500" : "border-l-rose-400"
      }`}
    >
      <div className="flex items-baseline justify-between gap-3">
        <span className="flex items-baseline gap-2">
          <span className="text-sm tabular-nums text-neutral-500">
            {formatarDiaMes(data)}
          </span>

          {marca && (
            <span className="rounded-full border border-amber-300 px-1.5 text-xs text-amber-800">
              {marca}
            </span>
          )}
        </span>

        <span
          className={`font-semibold tabular-nums ${
            entrada ? "text-emerald-700" : "text-rose-700"
          }`}
        >
          <span className="sr-only">{lancamento.tipo} de </span>
          <span aria-hidden="true">{entrada ? "+" : "−"} </span>
          {formatarMoeda(lancamento.valor)}
        </span>
      </div>

      <p className="mt-0.5 font-medium text-neutral-900">
        {lancamento.descricao}
      </p>

      {contraparte && (
        <p className="mt-0.5 text-sm text-neutral-600">{contraparte}</p>
      )}

      <div className="mt-1.5 flex flex-wrap items-center gap-2 text-xs">
        <span className="rounded-full bg-neutral-100 px-2 py-0.5 text-neutral-600">
          {lancamento.categoria}
        </span>

        {!marca && (
          <span
            className={`rounded-full px-2 py-0.5 font-medium ${
              pendente
                ? "bg-amber-100 text-amber-800"
                : "bg-emerald-100 text-emerald-800"
            }`}
          >
            {lancamento.status}
          </span>
        )}

        {lancamento.forma_pagamento && (
          <span className="text-neutral-400">{lancamento.forma_pagamento}</span>
        )}
      </div>
    </Link>
  );
}
