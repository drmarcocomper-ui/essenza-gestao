import type { Metadata } from "next";
import { notFound } from "next/navigation";

import { atualizarCompra } from "@/app/(app)/produtos/compras/actions";
import Voltar from "@/components/layout/Voltar";
import FormularioCompra, {
  type ProdutoParaCompra,
} from "@/components/produtos/FormularioCompra";
import {
  listarFornecedores,
  listarProdutosDeEstoque,
  obterCompra,
} from "@/lib/estoque/consultas";

export const metadata: Metadata = {
  title: "Editar compra — Essenza",
};

export default async function EditarCompraPage({
  params,
}: PageProps<"/produtos/compras/[id]/editar">) {
  const { id } = await params;

  const [compra, ativos, fornecedores] = await Promise.all([
    obterCompra(id),
    listarProdutosDeEstoque(),
    listarFornecedores(),
  ]);

  if (!compra) {
    notFound();
  }

  // Os ativos, mais o produto de uma linha que já era da compra e foi
  // desativado depois: a linha pode continuar como está.
  const idsAtivos = new Set(ativos.map((produto) => produto.id));
  const produtos: ProdutoParaCompra[] = [
    ...ativos.map((produto) => ({ ...produto, ativo: true })),
    ...compra.itens
      .filter((item) => !idsAtivos.has(item.produtoId))
      .map((item) => ({
        id: item.produtoId,
        nome: item.produtoNome,
        marca: item.produtoMarca,
        ativo: false,
      })),
  ];

  return (
    <div className="space-y-4">
      <Voltar href={`/produtos/compras/${compra.id}`} rotulo="Compra" />

      <h2 className="text-lg font-semibold text-neutral-900">Editar compra</h2>

      <FormularioCompra
        // O id vem amarrado no servidor: não trafega em campo escondido.
        acao={atualizarCompra.bind(null, compra.id)}
        produtos={produtos}
        fornecedores={fornecedores}
        compra={compra}
        cancelarHref={`/produtos/compras/${compra.id}`}
        rotuloEnviar="Salvar"
      />
    </div>
  );
}
