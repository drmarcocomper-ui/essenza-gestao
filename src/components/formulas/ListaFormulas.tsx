import Link from "next/link";
import { ChevronRight, ImageOff } from "lucide-react";

import { formatarData } from "@/lib/formatters";
import type { FormulaNaLista } from "@/lib/formulas/consultas";
import { ROTULO_TIPO } from "@/lib/formulas/schema";

/**
 * Histórico de fórmulas da cliente, da mais recente para a mais antiga.
 *
 * Cada linha responde à pergunta que ela faz no meio do atendimento: o
 * que eu usei da última vez? Por isso o tom e o volume aparecem já na
 * lista, sem precisar abrir.
 */
export default function ListaFormulas({
  clienteId,
  formulas,
}: {
  clienteId: string;
  formulas: FormulaNaLista[];
}) {
  if (formulas.length === 0) {
    return (
      <p className="rounded-2xl border border-dashed border-neutral-300 px-4 py-8 text-center text-neutral-500">
        Nenhuma fórmula registrada ainda.
      </p>
    );
  }

  return (
    <ul className="space-y-2">
      {formulas.map((formula) => (
        <li key={formula.id}>
          <Link
            href={`/clientes/${clienteId}/formulas/${formula.id}`}
            className="flex min-h-20 items-center gap-3 rounded-2xl border border-neutral-200 bg-white p-3 active:bg-neutral-100"
          >
            <div className="size-16 shrink-0 overflow-hidden rounded-xl bg-neutral-100">
              {formula.miniatura ? (
                /* URL assinada com validade de minutos: o otimizador do
                   next/image cacheia pelo endereço e acabaria servindo
                   uma URL já vencida. */
                /* eslint-disable-next-line @next/next/no-img-element */
                <img
                  src={formula.miniatura}
                  alt=""
                  className="size-full object-cover"
                />
              ) : (
                <div className="flex size-full items-center justify-center text-neutral-300">
                  <ImageOff aria-hidden="true" className="size-6" />
                </div>
              )}
            </div>

            <div className="min-w-0 flex-1">
              <div className="flex items-baseline justify-between gap-2">
                <span className="font-medium text-neutral-900 tabular-nums">
                  {formatarData(formula.data)}
                </span>
                <span className="shrink-0 rounded-full bg-neutral-100 px-2 py-0.5 text-xs text-neutral-600">
                  {ROTULO_TIPO[formula.tipo] ?? formula.tipo}
                </span>
              </div>

              {formula.resultado_alvo && (
                <p className="mt-0.5 truncate text-neutral-900">
                  {formula.resultado_alvo}
                </p>
              )}

              <p className="mt-0.5 truncate text-xs text-neutral-500">
                {resumo(formula)}
              </p>
            </div>

            <ChevronRight
              aria-hidden="true"
              className="size-5 shrink-0 text-neutral-300"
            />
          </Link>
        </li>
      ))}
    </ul>
  );
}

/** "Base 5 · 20 vol · 35 min" — só o que estiver preenchido. */
function resumo(formula: FormulaNaLista) {
  const partes = [
    formula.base_natural && `Base ${formula.base_natural}`,
    formula.volume_oxidante && `${formula.volume_oxidante} vol`,
    formula.tempo_pausa_min && `${formula.tempo_pausa_min} min`,
    formula.tecnica,
  ].filter(Boolean);

  return partes.length > 0 ? partes.join(" · ") : "Sem detalhes anotados";
}
