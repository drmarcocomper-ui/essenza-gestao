import type { Metadata } from "next";
import Link from "next/link";
import { ChevronLeft } from "lucide-react";

import BotaoMarcarPago from "@/components/caixa/BotaoMarcarPago";
import { listarPendentes } from "@/lib/caixa/consultas";
import { formatarData, formatarMoeda } from "@/lib/formatters";

export const metadata: Metadata = {
  title: "A receber — Essenza",
};

export default async function PendentesPage() {
  const pendentes = await listarPendentes();

  const total = pendentes.reduce((soma, item) => soma + item.valor, 0);

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2">
        <Link
          href="/caixa"
          aria-label="Voltar para o caixa"
          className="flex size-11 shrink-0 items-center justify-center rounded-xl border border-neutral-300 bg-white text-neutral-600 active:bg-neutral-100"
        >
          <ChevronLeft aria-hidden="true" className="size-6" />
        </Link>

        <h2 className="text-lg font-semibold text-neutral-900">A receber</h2>
      </div>

      {pendentes.length === 0 ? (
        <p className="rounded-2xl border border-dashed border-neutral-300 px-4 py-10 text-center text-neutral-600">
          Nenhuma pendência. Está tudo recebido.
        </p>
      ) : (
        <>
          <section className="rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3">
            <p className="text-sm text-amber-900">
              {pendentes.length === 1
                ? "1 pendência"
                : `${pendentes.length} pendências`}
            </p>
            <p className="mt-1 text-xl font-semibold tabular-nums text-amber-900">
              {formatarMoeda(total)}
            </p>
          </section>

          {/* A view já entrega da mais antiga para a mais nova: é a ordem
              em que ela vai cobrar. */}
          <ul className="space-y-2">
            {pendentes.map((pendente) => (
              <li
                key={pendente.id}
                className="space-y-3 rounded-2xl border border-neutral-200 bg-white px-4 py-3"
              >
                <div>
                  <div className="flex items-baseline justify-between gap-3">
                    <span className="text-sm tabular-nums text-neutral-500">
                      {formatarData(pendente.data_competencia)}
                    </span>
                    <span className="font-semibold tabular-nums text-neutral-900">
                      {formatarMoeda(pendente.valor)}
                    </span>
                  </div>

                  <p className="mt-0.5 font-medium text-neutral-900">
                    {pendente.cliente ?? "Sem cliente"}
                  </p>
                  <p className="text-sm text-neutral-600">
                    {pendente.descricao}
                  </p>
                </div>

                <div className="flex gap-3">
                  <div className="flex-1">
                    <BotaoMarcarPago
                      id={pendente.id}
                      descricao={pendente.descricao}
                    />
                  </div>

                  <Link
                    href={`/caixa/${pendente.id}/editar`}
                    className="flex h-12 shrink-0 items-center justify-center rounded-xl border border-neutral-300 px-4 font-medium text-neutral-700 active:bg-neutral-100"
                  >
                    Abrir
                  </Link>
                </div>
              </li>
            ))}
          </ul>
        </>
      )}
    </div>
  );
}
