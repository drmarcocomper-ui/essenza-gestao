import Link from "next/link";
import { FlaskConical } from "lucide-react";

import type { AtendimentoNaLista } from "@/lib/atendimentos/consultas";
import { formatarData } from "@/lib/formatters";

/**
 * O que foi feito, e quando. Sem valores: o dinheiro do atendimento vive
 * no Caixa, em `lancamentos`.
 */
export default function ListaAtendimentos({
  clienteId,
  atendimentos,
}: {
  clienteId: string;
  atendimentos: AtendimentoNaLista[];
}) {
  if (atendimentos.length === 0) {
    return (
      <p className="rounded-2xl border border-dashed border-neutral-300 px-4 py-6 text-center text-sm text-neutral-500">
        Nenhum atendimento registrado ainda.
      </p>
    );
  }

  return (
    <ul className="space-y-2">
      {atendimentos.map((atendimento) => (
        <li
          key={atendimento.id}
          className="rounded-2xl border border-neutral-200 bg-white px-4 py-3"
        >
          <div className="flex items-baseline justify-between gap-3">
            <span className="text-sm text-neutral-500 tabular-nums">
              {formatarData(atendimento.data)}
            </span>

            {atendimento.formulaId && (
              <Link
                href={`/clientes/${clienteId}/formulas/${atendimento.formulaId}`}
                className="flex min-h-11 shrink-0 items-center gap-1.5 text-sm font-medium text-rose-700 active:text-rose-900"
              >
                <FlaskConical aria-hidden="true" className="size-4" />
                Ver fórmula
              </Link>
            )}
          </div>

          <p className="text-neutral-900">
            {atendimento.servicos.join(", ") || "Sem serviços anotados"}
          </p>

          {atendimento.observacao && (
            <p className="mt-1 text-sm whitespace-pre-line text-neutral-500">
              {atendimento.observacao}
            </p>
          )}
        </li>
      ))}
    </ul>
  );
}
