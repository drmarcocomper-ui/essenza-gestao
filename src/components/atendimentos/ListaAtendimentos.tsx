import Link from "next/link";
import { ChevronRight, FlaskConical } from "lucide-react";

import type { AtendimentoNaLista } from "@/lib/atendimentos/consultas";
import { formatarData, formatarMoeda } from "@/lib/formatters";

/**
 * O que foi feito, quando, e por quanto.
 *
 * O cartão inteiro é o link para o atendimento — alvo grande, para o
 * dedo achar em pé, entre uma cliente e outra. Por isso o atalho da
 * fórmula virou só um ícone: link dentro de link não existe em HTML, e a
 * fórmula está a um toque de distância na tela de dentro.
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
        <li key={atendimento.id}>
          <Link
            href={`/clientes/${clienteId}/atendimentos/${atendimento.id}`}
            className="flex gap-3 rounded-2xl border border-neutral-200 bg-white px-4 py-3 active:bg-neutral-50"
          >
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-2">
                <span className="text-sm text-neutral-500 tabular-nums">
                  {formatarData(atendimento.data)}
                </span>

                {atendimento.formulaId && (
                  <FlaskConical
                    aria-label="Tem fórmula"
                    className="size-4 shrink-0 text-rose-600"
                  />
                )}
              </div>

              <p className="text-neutral-900">
                {atendimento.servicos.join(", ") || "Sem serviços anotados"}
              </p>

              {atendimento.observacao && (
                <p className="mt-1 line-clamp-2 text-sm text-neutral-500">
                  {atendimento.observacao}
                </p>
              )}
            </div>

            <div className="flex shrink-0 items-center gap-1">
              {/* Conta aberta é a que ela ainda precisa fechar. É o que
                  esta lista tem de mais acionável, então vem em âmbar. */}
              {atendimento.fechada ? (
                <span className="font-medium text-neutral-900 tabular-nums">
                  {formatarMoeda(atendimento.total)}
                </span>
              ) : (
                <span className="rounded-full bg-amber-50 px-2 py-0.5 text-xs font-medium text-amber-800">
                  Conta aberta
                </span>
              )}

              <ChevronRight
                aria-hidden="true"
                className="size-5 text-neutral-300"
              />
            </div>
          </Link>
        </li>
      ))}
    </ul>
  );
}
