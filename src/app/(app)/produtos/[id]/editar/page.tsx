import type { Metadata } from "next";
import { notFound } from "next/navigation";

import { atualizarProduto } from "@/app/(app)/produtos/actions";
import BotaoAtivoProduto from "@/components/produtos/BotaoAtivoProduto";
import FormularioProduto from "@/components/produtos/FormularioProduto";
import { obterProduto } from "@/lib/produtos/consultas";

export const metadata: Metadata = {
  title: "Editar produto — Essenza",
};

export default async function EditarProdutoPage({
  params,
}: PageProps<"/produtos/[id]/editar">) {
  const { id } = await params;

  // Só revenda: insumo de coloração não é editado por aqui.
  const produto = await obterProduto(id);

  if (!produto) {
    notFound();
  }

  return (
    <div className="space-y-4">
      <div>
        <h2 className="text-lg font-semibold text-neutral-900">
          Editar produto
        </h2>

        {(!produto.ativo || produto.origem === "atendimento") && (
          <p className="mt-0.5 text-sm text-neutral-500">
            {[
              !produto.ativo && "Inativo.",
              produto.origem === "atendimento" &&
                "Criado no fechamento de uma conta.",
            ]
              .filter(Boolean)
              .join(" ")}
          </p>
        )}
      </div>

      <FormularioProduto
        // O id vem amarrado no servidor: não trafega em campo escondido.
        acao={atualizarProduto.bind(null, produto.id)}
        produto={produto}
        rotuloEnviar="Salvar"
      />

      <div className="border-t border-neutral-200 pt-4">
        <BotaoAtivoProduto id={produto.id} ativo={produto.ativo} />
      </div>
    </div>
  );
}
