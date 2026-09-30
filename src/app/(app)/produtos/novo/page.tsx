import type { Metadata } from "next";

import { criarProduto } from "@/app/(app)/produtos/actions";
import Voltar from "@/components/layout/Voltar";
import FormularioProduto from "@/components/produtos/FormularioProduto";

export const metadata: Metadata = {
  title: "Novo produto — Essenza",
};

export default function NovoProdutoPage() {
  return (
    <div className="space-y-4">
      <Voltar href="/produtos" rotulo="Produtos" />

      <h2 className="text-lg font-semibold text-neutral-900">Novo produto</h2>

      <FormularioProduto acao={criarProduto} rotuloEnviar="Cadastrar" />
    </div>
  );
}
