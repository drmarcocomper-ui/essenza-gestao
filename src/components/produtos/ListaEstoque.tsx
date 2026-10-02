import Link from "next/link";
import { ChevronRight } from "lucide-react";

import SaldoEstoque from "@/components/produtos/SaldoEstoque";
import type { ProdutoDeEstoque } from "@/lib/estoque/consultas";
import type { Saldo } from "@/lib/estoque/saldo";

export type ProdutoComSaldo = ProdutoDeEstoque & { saldo: Saldo };

/**
 * Os frascos de revenda ativos com o saldo de cada um, na ordem
 * alfabética que já vem da consulta. Cada linha abre a página do produto,
 * onde mora o "Contar estoque".
 */
export default function ListaEstoque({
  produtos,
}: {
  produtos: ProdutoComSaldo[];
}) {
  if (produtos.length === 0) {
    return (
      <p className="rounded-2xl border border-dashed border-neutral-300 px-4 py-6 text-center text-sm text-neutral-500">
        Nenhum produto de revenda ativo.
      </p>
    );
  }

  return (
    <ul className="divide-y divide-neutral-100 overflow-hidden rounded-2xl border border-neutral-200 bg-white">
      {produtos.map((produto) => (
        <li key={produto.id}>
          <Link
            href={`/produtos/${produto.id}`}
            className="flex min-h-14 items-center gap-3 px-4 py-2.5 active:bg-neutral-100"
          >
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-medium text-neutral-900">
                {produto.nome}
              </p>
              {produto.marca && (
                <p className="truncate text-xs text-neutral-500">
                  {produto.marca}
                </p>
              )}
            </div>

            <SaldoEstoque saldo={produto.saldo} />

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
