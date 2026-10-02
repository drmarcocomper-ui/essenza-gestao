"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import { exigirSessao } from "@/lib/auth";
import {
  contagemSchema,
  errosPorCampo,
  lerContagem,
  type CampoContagem,
} from "@/lib/estoque/schema";
import { obterProduto } from "@/lib/produtos/consultas";

export type EstadoContagem = {
  erros?: Partial<Record<CampoContagem, string>>;
  mensagem?: string;
  /** O que a usuária já tinha digitado, para o formulário não se apagar. */
  valores?: Partial<Record<CampoContagem, string>>;
};

/**
 * "Contei e tinha N". Só produto de revenda ativo (021: a regra de
 * vocabulário mora na aplicação). Contagem não é única por dia: duas no
 * mesmo dia são legítimas, e vale a registrada por último.
 */
export async function registrarContagem(
  produtoId: string,
  _estado: EstadoContagem,
  formData: FormData,
): Promise<EstadoContagem> {
  const { supabase } = await exigirSessao();

  const bruto = lerContagem(formData);
  const validacao = contagemSchema.safeParse(bruto);

  if (!validacao.success) {
    return {
      erros: errosPorCampo<CampoContagem>(validacao.error),
      valores: bruto,
    };
  }

  const produto = await obterProduto(produtoId);

  if (!produto) {
    return { mensagem: "Produto não encontrado.", valores: bruto };
  }

  if (!produto.ativo) {
    return {
      mensagem: "Este produto está inativo e não tem estoque.",
      valores: bruto,
    };
  }

  const { error } = await supabase
    .from("estoque_contagens")
    .insert({ ...validacao.data, produto_id: produto.id });

  if (error) {
    return {
      mensagem: `Não foi possível registrar a contagem: ${error.message}`,
      valores: bruto,
    };
  }

  revalidatePath("/produtos");
  revalidatePath(`/produtos/${produto.id}`);
  redirect(`/produtos/${produto.id}`);
}
