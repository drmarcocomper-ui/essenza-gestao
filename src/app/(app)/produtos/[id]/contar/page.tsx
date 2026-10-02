import type { Metadata } from "next";
import { notFound } from "next/navigation";

import { registrarContagem } from "@/app/(app)/produtos/[id]/actions";
import Voltar from "@/components/layout/Voltar";
import FormularioContagem from "@/components/produtos/FormularioContagem";
import { obterProduto } from "@/lib/produtos/consultas";

export const metadata: Metadata = {
  title: "Contar estoque — Essenza",
};

export default async function ContarEstoquePage({
  params,
}: PageProps<"/produtos/[id]/contar">) {
  const { id } = await params;

  const produto = await obterProduto(id);

  // Inativo não tem estoque: a página dele não oferece o botão.
  if (!produto || !produto.ativo) {
    notFound();
  }

  return (
    <div className="space-y-4">
      <Voltar href={`/produtos/${produto.id}`} rotulo={produto.nome} />

      <div>
        <h2 className="text-lg font-semibold text-neutral-900">
          Contar estoque
        </h2>
        <p className="mt-0.5 text-sm text-neutral-500">
          Quantos frascos de {produto.nome} tem agora. O saldo passa a partir
          daqui.
        </p>
      </div>

      <FormularioContagem
        // O id vem amarrado no servidor: não trafega em campo escondido.
        acao={registrarContagem.bind(null, produto.id)}
        produtoId={produto.id}
      />
    </div>
  );
}
