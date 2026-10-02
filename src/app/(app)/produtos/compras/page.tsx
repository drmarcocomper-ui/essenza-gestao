import type { Metadata } from "next";
import Link from "next/link";
import { ChevronRight, Paperclip, Plus } from "lucide-react";

import Voltar from "@/components/layout/Voltar";
import { listarCompras } from "@/lib/estoque/consultas";
import { formatarData, formatarMoeda } from "@/lib/formatters";

export const metadata: Metadata = {
  title: "Compras — Essenza",
};

/**
 * Entradas de frascos de revenda, da mais recente para a mais antiga.
 * Compra não é lançamento: o boleto já vai ao Caixa (021).
 */
export default async function ComprasPage() {
  const compras = await listarCompras();

  return (
    <div className="space-y-4">
      <Voltar href="/produtos" rotulo="Produtos" />

      <div className="flex items-center justify-between">
        <h2 className="text-lg font-semibold text-neutral-900">Compras</h2>

        <Link
          href="/produtos/compras/nova"
          className="-mr-2 flex min-h-11 items-center gap-1 rounded-xl px-2 text-sm font-medium text-rose-700 active:bg-rose-50"
        >
          <Plus aria-hidden="true" className="size-4" />
          Nova compra
        </Link>
      </div>

      {compras.length === 0 ? (
        <p className="rounded-2xl border border-dashed border-neutral-300 px-4 py-6 text-center text-sm text-neutral-500">
          Nenhuma compra registrada ainda.
        </p>
      ) : (
        <ul className="space-y-2">
          {compras.map((compra) => (
            <li key={compra.id}>
              <Link
                href={`/produtos/compras/${compra.id}`}
                className="flex min-h-16 items-center gap-3 rounded-2xl border border-neutral-200 bg-white px-4 py-3 active:bg-neutral-100"
              >
                <div className="min-w-0 flex-1">
                  <p className="truncate font-medium text-neutral-900">
                    {compra.fornecedor}
                  </p>
                  <p className="mt-0.5 flex items-center gap-1.5 text-sm text-neutral-500">
                    {formatarData(compra.data)} ·{" "}
                    {compra.quantidadeItens === 1
                      ? "1 produto"
                      : `${compra.quantidadeItens} produtos`}
                    {compra.temNota && (
                      <Paperclip
                        aria-label="Tem nota"
                        className="size-4 text-neutral-400"
                      />
                    )}
                  </p>
                </div>

                <span className="shrink-0 font-medium tabular-nums text-neutral-900">
                  {formatarMoeda(compra.total)}
                </span>

                <ChevronRight
                  aria-hidden="true"
                  className="size-5 shrink-0 text-neutral-300"
                />
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
