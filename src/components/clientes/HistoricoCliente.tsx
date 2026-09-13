import type { Lancamento } from "@/lib/clientes/consultas";
import { formatarData, formatarMoeda } from "@/lib/formatters";

/**
 * Histórico financeiro da cliente, do mais recente para o mais antigo.
 * Só leitura — lançamento se edita no Caixa.
 */
export default function HistoricoCliente({
  lancamentos,
}: {
  lancamentos: Lancamento[];
}) {
  if (lancamentos.length === 0) {
    return (
      <p className="rounded-2xl border border-dashed border-neutral-300 px-4 py-8 text-center text-neutral-500">
        Nenhum atendimento registrado.
      </p>
    );
  }

  return (
    <ul className="space-y-2">
      {lancamentos.map((lancamento) => {
        const pendente = lancamento.status === "Pendente";

        return (
          <li
            key={lancamento.id}
            className="rounded-2xl border border-neutral-200 bg-white px-4 py-3"
          >
            <div className="flex items-baseline justify-between gap-3">
              <span className="text-sm text-neutral-500">
                {formatarData(lancamento.data_competencia)}
              </span>
              <span className="font-medium text-neutral-900 tabular-nums">
                {formatarMoeda(lancamento.valor)}
              </span>
            </div>

            <p className="mt-1 text-neutral-900">{lancamento.descricao}</p>

            <div className="mt-1.5 flex flex-wrap items-center gap-2 text-xs">
              <span className="rounded-full bg-neutral-100 px-2 py-0.5 text-neutral-600">
                {lancamento.categoria}
              </span>

              <span
                className={`rounded-full px-2 py-0.5 font-medium ${
                  pendente
                    ? "bg-amber-100 text-amber-800"
                    : "bg-emerald-100 text-emerald-800"
                }`}
              >
                {lancamento.status}
              </span>

              {lancamento.forma_pagamento && (
                <span className="text-neutral-400">
                  {lancamento.forma_pagamento}
                </span>
              )}
            </div>
          </li>
        );
      })}
    </ul>
  );
}
