import type { Metadata } from "next";
import Link from "next/link";
import { ChevronLeft } from "lucide-react";

import ConfirmarRecebimento from "@/components/caixa/ConfirmarRecebimento";
import { listarPendentes } from "@/lib/caixa/consultas";
import { formatarData, formatarMoeda } from "@/lib/formatters";

export const metadata: Metadata = {
  title: "A receber — Essenza",
};

/**
 * A receber: o dinheiro vendido que ainda não caiu — quase tudo parcela
 * de cartão esperando compensar.
 *
 * A data que aparece é a da VENDA. O app não prevê quando a parcela cai,
 * nem mostra prazo estimado: quem informa o dia é ela, ao confirmar.
 */
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
              em que as parcelas vão caindo. */}
          <ul className="space-y-2">
            {pendentes.map((pendente) => (
              <li
                key={pendente.id}
                className="space-y-3 rounded-2xl border border-neutral-200 bg-white px-4 py-3"
              >
                {/* O bloco inteiro abre a edição, como na lista do caixa —
                    alvo grande, para usar de pé e com uma mão. */}
                <Link
                  href={`/caixa/${pendente.id}/editar`}
                  className="block rounded-xl active:bg-neutral-50"
                >
                  <div className="flex items-baseline justify-between gap-3">
                    <span className="text-sm text-neutral-500">
                      Venda em{" "}
                      <span className="tabular-nums">
                        {formatarData(pendente.data_competencia)}
                      </span>
                    </span>
                    <span className="font-semibold tabular-nums text-neutral-900">
                      {formatarMoeda(pendente.valor)}
                    </span>
                  </div>

                  {/* Lançamento sem cliente é normal: nem toda entrada da
                      planilha veio com a pessoa identificada. */}
                  <p className="mt-0.5 font-medium text-neutral-900">
                    {pendente.cliente ?? "Sem cliente"}
                  </p>

                  <p className="text-sm text-neutral-600">
                    {pendente.descricao}
                  </p>

                  {/* Sem isto, as três parcelas da mesma venda são linhas
                      idênticas: mesmo nome, mesma data, mesmo valor. */}
                  {pendente.parcelamento && (
                    <p className="mt-1.5">
                      <span className="rounded-full bg-neutral-100 px-2 py-0.5 text-xs text-neutral-600">
                        Parcela {pendente.parcelamento}
                      </span>
                    </p>
                  )}
                </Link>

                <ConfirmarRecebimento
                  id={pendente.id}
                  descricao={pendente.descricao}
                />
              </li>
            ))}
          </ul>
        </>
      )}
    </div>
  );
}
