import type { Metadata } from "next";

import { criarCompra } from "@/app/(app)/produtos/compras/actions";
import Voltar from "@/components/layout/Voltar";
import FormularioCompra from "@/components/produtos/FormularioCompra";
import {
  listarFornecedores,
  listarProdutosDeEstoque,
} from "@/lib/estoque/consultas";

export const metadata: Metadata = {
  title: "Nova compra — Essenza",
};

export default async function NovaCompraPage() {
  const [produtos, fornecedores] = await Promise.all([
    listarProdutosDeEstoque(),
    listarFornecedores(),
  ]);

  return (
    <div className="space-y-4">
      <Voltar href="/produtos/compras" rotulo="Compras" />

      <div>
        <h2 className="text-lg font-semibold text-neutral-900">Nova compra</h2>
        <p className="mt-0.5 text-sm text-neutral-500">
          Frascos que chegaram para revenda. Não lança nada no Caixa.
        </p>
      </div>

      <FormularioCompra
        acao={criarCompra}
        produtos={produtos.map((produto) => ({ ...produto, ativo: true }))}
        fornecedores={fornecedores}
        comNota
        cancelarHref="/produtos/compras"
        rotuloEnviar="Salvar compra"
      />
    </div>
  );
}
