import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, RotateCcw } from "lucide-react";

import FotosFormula from "@/components/formulas/FotosFormula";
import { obterCliente } from "@/lib/clientes/consultas";
import { formatarData } from "@/lib/formatters";
import { obterFormula } from "@/lib/formulas/consultas";
import { formatarQuantidade } from "@/lib/formulas/repetir";
import { ROTULO_TIPO } from "@/lib/formulas/schema";

export async function generateMetadata({
  params,
}: PageProps<"/clientes/[id]/formulas/[formulaId]">): Promise<Metadata> {
  const { id, formulaId } = await params;
  const formula = await obterFormula(id, formulaId);

  return {
    title: formula
      ? `Fórmula de ${formatarData(formula.data)} — Essenza`
      : "Fórmula — Essenza",
  };
}

export default async function FormulaPage({
  params,
}: PageProps<"/clientes/[id]/formulas/[formulaId]">) {
  const { id, formulaId } = await params;

  const [cliente, formula] = await Promise.all([
    obterCliente(id),
    obterFormula(id, formulaId),
  ]);

  if (!cliente || !formula) {
    notFound();
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <Link
          href={`/clientes/${cliente.id}`}
          aria-label="Voltar para a cliente"
          className="flex size-11 shrink-0 items-center justify-center rounded-xl border border-neutral-300 text-neutral-600 active:bg-neutral-100"
        >
          <ArrowLeft aria-hidden="true" className="size-5" />
        </Link>

        <div className="min-w-0">
          <h2 className="truncate text-lg font-semibold text-neutral-900">
            {formatarData(formula.data)}
          </h2>
          <p className="truncate text-sm text-neutral-500">{cliente.nome}</p>
        </div>
      </div>

      <section className="rounded-2xl border border-neutral-200 bg-white p-4">
        <span className="inline-block rounded-full bg-rose-50 px-3 py-1 text-sm font-medium text-rose-800">
          {ROTULO_TIPO[formula.tipo] ?? formula.tipo}
        </span>

        <dl className="mt-4 space-y-2 text-sm">
          <Dado rotulo="Base" valor={formula.base_natural} />
          <Dado rotulo="Tom desejado" valor={formula.resultado_alvo} />
          <Dado
            rotulo="Oxidante"
            valor={
              formula.volume_oxidante ? `${formula.volume_oxidante} vol` : null
            }
          />
          <Dado
            rotulo="Pausa"
            valor={
              formula.tempo_pausa_min ? `${formula.tempo_pausa_min} min` : null
            }
          />
          <Dado rotulo="Técnica" valor={formula.tecnica} />
          <Dado rotulo="Resultado" valor={formula.resultado} />
          <Dado rotulo="Ajuste" valor={formula.observacao} />
        </dl>
      </section>

      {formula.itens.length > 0 && (
        <section className="space-y-3">
          <h3 className="text-sm font-medium text-neutral-500">Mistura</h3>

          <ul className="divide-y divide-neutral-100 overflow-hidden rounded-2xl border border-neutral-200 bg-white">
            {formula.itens.map((item) => (
              <li
                key={item.id}
                className="flex items-baseline justify-between gap-3 px-4 py-3"
              >
                <span className="min-w-0 flex-1 text-neutral-900">
                  {item.descricao}
                </span>
                <span className="shrink-0 font-medium text-neutral-700 tabular-nums">
                  {formatarQuantidade(item.quantidade)} {item.unidade}
                </span>
              </li>
            ))}
          </ul>
        </section>
      )}

      <section className="space-y-3">
        <h3 className="text-sm font-medium text-neutral-500">Antes e depois</h3>

        <FotosFormula
          clienteId={cliente.id}
          formulaId={formula.id}
          fotos={formula.fotos}
        />
      </section>

      <Link
        href={`/clientes/${cliente.id}/formulas/nova?repetir=${formula.id}`}
        className="flex h-14 w-full items-center justify-center gap-2 rounded-xl bg-rose-600 font-medium text-white active:bg-rose-700"
      >
        <RotateCcw aria-hidden="true" className="size-5" />
        Repetir esta fórmula
      </Link>
    </div>
  );
}

/** Linha da ficha. Campo vazio não vira linha em branco: some. */
function Dado({
  rotulo,
  valor,
}: {
  rotulo: string;
  valor: string | null | undefined;
}) {
  if (!valor) return null;

  return (
    <div className="flex gap-3">
      <dt className="w-28 shrink-0 text-neutral-500">{rotulo}</dt>
      <dd className="min-w-0 flex-1 break-words whitespace-pre-line text-neutral-900">
        {valor}
      </dd>
    </div>
  );
}
