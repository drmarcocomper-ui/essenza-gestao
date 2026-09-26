import type { Metadata } from "next";
import Link from "next/link";
import { Plus } from "lucide-react";

import ListaPecas from "@/components/produtos/ListaPecas";
import ListaProdutos from "@/components/produtos/ListaProdutos";
import {
  listarContasDasPecas,
  listarPecas,
} from "@/lib/pecas-extensao/consultas";
import { listarProdutos } from "@/lib/produtos/consultas";

export const metadata: Metadata = {
  title: "Produtos — Essenza",
};

/**
 * A aba Produtos é feita de seções: revenda (`produtos`) e peças de
 * extensão (`pecas_extensao`, 018). As rotas da extensão ficam sob o
 * segmento estático `extensao`, que o Next resolve antes do `[id]` da
 * revenda.
 */
export default async function ProdutosPage() {
  const [produtos, pecas, contas] = await Promise.all([
    listarProdutos(),
    listarPecas(),
    listarContasDasPecas(),
  ]);

  return (
    // Folga no fim para o botão flutuante não cobrir a última peça.
    <div className="space-y-8 pb-20">
      <section aria-labelledby="secao-revenda" className="space-y-3">
        <h2
          id="secao-revenda"
          className="text-sm font-medium text-neutral-500"
        >
          Revenda
        </h2>

        <ListaProdutos produtos={produtos} />
      </section>

      <section aria-labelledby="secao-extensao" className="space-y-3">
        <div className="flex items-center justify-between">
          <h2
            id="secao-extensao"
            className="text-sm font-medium text-neutral-500"
          >
            Extensão
          </h2>

          <Link
            href="/produtos/extensao/nova"
            className="-mr-2 flex min-h-11 items-center gap-1 rounded-xl px-2 text-sm font-medium text-rose-700 active:bg-rose-50"
          >
            <Plus aria-hidden="true" className="size-4" />
            Nova peça
          </Link>
        </div>

        <ListaPecas pecas={pecas} contas={contas} />
      </section>

      {/* Acima da BottomNav (h-14) e no canto do polegar. */}
      <Link
        href="/produtos/novo"
        aria-label="Cadastrar produto"
        className="fixed right-4 bottom-[calc(4.5rem+env(safe-area-inset-bottom))] z-30 flex size-14 items-center justify-center rounded-full bg-rose-600 text-white shadow-lg active:bg-rose-700"
      >
        <Plus aria-hidden="true" className="size-7" />
      </Link>
    </div>
  );
}
