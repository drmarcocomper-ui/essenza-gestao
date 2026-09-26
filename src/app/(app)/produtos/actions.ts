"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import { exigirSessao } from "@/lib/auth";
import {
  listarAtivosParaConferencia,
  obterProduto,
} from "@/lib/produtos/consultas";
import {
  encontrarDuplicado,
  mensagemDuplicado,
  MENSAGEM_DUPLICADO_BANCO,
} from "@/lib/produtos/regras";
import {
  errosPorCampo,
  lerFormulario,
  novoProdutoDoCatalogo,
  produtoSchema,
  type CampoProduto,
} from "@/lib/produtos/schema";

export type EstadoFormulario = {
  erros?: Partial<Record<CampoProduto, string>>;
  mensagem?: string;
  /** O que a usuária já tinha digitado, para o formulário não se apagar. */
  valores?: Partial<Record<CampoProduto, string>>;
};

/** 23505 é unique_violation: aqui, só pode ser o índice da 011. */
function ehDuplicado(erro: { code?: string } | null) {
  return erro?.code === "23505";
}

export async function criarProduto(
  _estado: EstadoFormulario,
  formData: FormData,
): Promise<EstadoFormulario> {
  const { supabase } = await exigirSessao();

  const bruto = lerFormulario(formData);
  const validacao = produtoSchema.safeParse(bruto);

  if (!validacao.success) {
    return { erros: errosPorCampo(validacao.error), valores: bruto };
  }

  const { nome, marca } = validacao.data;
  const existente = encontrarDuplicado(
    await listarAtivosParaConferencia(),
    nome,
    marca,
  );

  if (existente) {
    return { mensagem: mensagemDuplicado(existente), valores: bruto };
  }

  const { error } = await supabase
    .from("produtos")
    .insert(novoProdutoDoCatalogo(validacao.data));

  if (error) {
    return {
      mensagem: ehDuplicado(error)
        ? MENSAGEM_DUPLICADO_BANCO
        : `Não foi possível cadastrar: ${error.message}`,
      valores: bruto,
    };
  }

  revalidatePath("/produtos");
  redirect("/produtos");
}

/**
 * Só nome, marca e preço. `tipo`, `unidade` e `origem_registro` ficam
 * como estão: um produto criado na conta continua 'atendimento' depois
 * de ganhar preço.
 */
export async function atualizarProduto(
  id: string,
  _estado: EstadoFormulario,
  formData: FormData,
): Promise<EstadoFormulario> {
  const { supabase } = await exigirSessao();

  const bruto = lerFormulario(formData);
  const validacao = produtoSchema.safeParse(bruto);

  if (!validacao.success) {
    return { erros: errosPorCampo(validacao.error), valores: bruto };
  }

  const produto = await obterProduto(id);

  if (!produto) {
    return { mensagem: "Produto não encontrado.", valores: bruto };
  }

  // Inativo não ocupa nome no índice da 011: a conferência fica para a
  // reativação.
  if (produto.ativo) {
    const { nome, marca } = validacao.data;
    const existente = encontrarDuplicado(
      await listarAtivosParaConferencia(),
      nome,
      marca,
      id,
    );

    if (existente) {
      return { mensagem: mensagemDuplicado(existente), valores: bruto };
    }
  }

  const { error } = await supabase
    .from("produtos")
    .update(validacao.data)
    .eq("id", id)
    .eq("tipo", "revenda");

  if (error) {
    return {
      mensagem: ehDuplicado(error)
        ? MENSAGEM_DUPLICADO_BANCO
        : `Não foi possível salvar: ${error.message}`,
      valores: bruto,
    };
  }

  revalidatePath("/produtos");
  redirect("/produtos");
}

/**
 * Produto nunca é apagado (`atendimento_itens.produto_id` é on delete
 * restrict): sai da conta ficando inativo, e pode voltar.
 *
 * Devolve a mensagem em vez de lançar: reativar pode esbarrar num ativo
 * de mesmo nome e marca, e isso é recado para ela, não falha.
 */
export async function alternarAtivoProduto(
  id: string,
  ativo: boolean,
): Promise<{ erro?: string }> {
  const { supabase } = await exigirSessao();

  if (ativo) {
    const produto = await obterProduto(id);

    if (!produto) return { erro: "Produto não encontrado." };

    const existente = encontrarDuplicado(
      await listarAtivosParaConferencia(),
      produto.nome,
      produto.marca,
      id,
    );

    if (existente) {
      return {
        erro: `Não dá para reativar. ${mensagemDuplicado(existente)}`,
      };
    }
  }

  const { error } = await supabase
    .from("produtos")
    .update({ ativo })
    .eq("id", id)
    .eq("tipo", "revenda");

  if (error) {
    return {
      erro: ehDuplicado(error)
        ? `Não dá para reativar. ${MENSAGEM_DUPLICADO_BANCO}`
        : `Não foi possível atualizar o produto: ${error.message}`,
    };
  }

  revalidatePath("/produtos");
  revalidatePath(`/produtos/${id}/editar`);

  return {};
}
