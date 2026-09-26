import type { Metadata } from "next";
import Link from "next/link";
import { Plus } from "lucide-react";

import ListaProdutos from "@/components/produtos/ListaProdutos";
import { listarProdutos } from "@/lib/produtos/consultas";

export const metadata: Metadata = {
  title: "Produtos — Essenza",
};

/**
 * A aba Produtos é feita de seções. Hoje só existe a de revenda; a de
 * peças de extensão (`pecas_extensao`, 018) entra depois como outra
 * `<section>` aqui, com as próprias rotas sob o segmento estático
 * `extensao`, que o Next resolve antes do `[id]` da revenda.
 */
export default async function ProdutosPage() {
  const produtos = await listarProdutos();

  return (
    <div className="space-y-4">
      <section aria-labelledby="secao-revenda" className="space-y-3">
        <h2
          id="secao-revenda"
          className="text-sm font-medium text-neutral-500"
        >
          Revenda
        </h2>

        <ListaProdutos produtos={produtos} />
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
