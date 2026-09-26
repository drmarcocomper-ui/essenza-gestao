"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import { exigirSessao } from "@/lib/auth";
import {
  listarCodigos,
  obterPeca,
  pecaTemFilhas,
} from "@/lib/pecas-extensao/consultas";
import {
  encontrarCodigoDuplicado,
  mensagemCodigoDuplicado,
  MENSAGEM_CODIGO_TRAVADO,
  MENSAGEM_EXCLUSAO_TRAVADA,
} from "@/lib/pecas-extensao/regras";
import {
  errosPorCampo,
  lerFormulario,
  novaPeca,
  pecaSchema,
  type CampoPeca,
} from "@/lib/pecas-extensao/schema";

export type EstadoFormularioPeca = {
  erros?: Partial<Record<CampoPeca, string>>;
  mensagem?: string;
  /** O que a usuária já tinha digitado, para o formulário não se apagar. */
  valores?: Partial<Record<CampoPeca, string>>;
};

/** 23505 é unique_violation: aqui, só pode ser o índice do código (018). */
function ehDuplicado(erro: { code?: string } | null) {
  return erro?.code === "23505";
}

/** 23503 é foreign_key_violation: a peça ganhou parte entre a tela e o toque. */
function temParte(erro: { code?: string } | null) {
  return erro?.code === "23503";
}

export async function criarPeca(
  _estado: EstadoFormularioPeca,
  formData: FormData,
): Promise<EstadoFormularioPeca> {
  const { supabase } = await exigirSessao();

  const bruto = lerFormulario(formData);
  const validacao = pecaSchema.safeParse(bruto);

  if (!validacao.success) {
    return { erros: errosPorCampo(validacao.error), valores: bruto };
  }

  const { codigo } = validacao.data;
  const existente = encontrarCodigoDuplicado(await listarCodigos(), codigo);

  if (existente) {
    return {
      erros: { codigo: mensagemCodigoDuplicado(existente.codigo) },
      valores: bruto,
    };
  }

  const { error } = await supabase
    .from("pecas_extensao")
    .insert(novaPeca(validacao.data));

  if (error) {
    return ehDuplicado(error)
      ? { erros: { codigo: mensagemCodigoDuplicado(codigo) }, valores: bruto }
      : { mensagem: `Não foi possível cadastrar: ${error.message}`, valores: bruto };
  }

  revalidatePath("/produtos");
  redirect("/produtos");
}

/**
 * Os campos do formulário, e só eles: `peca_mae_id` nunca entra num
 * update (ver 018). O código só muda em peça sem partes — reavaliado
 * aqui, não só travado na tela.
 */
export async function atualizarPeca(
  id: string,
  _estado: EstadoFormularioPeca,
  formData: FormData,
): Promise<EstadoFormularioPeca> {
  const { supabase } = await exigirSessao();

  const bruto = lerFormulario(formData);
  const validacao = pecaSchema.safeParse(bruto);

  if (!validacao.success) {
    return { erros: errosPorCampo(validacao.error), valores: bruto };
  }

  const peca = await obterPeca(id);

  if (!peca) {
    return { mensagem: "Peça não encontrada.", valores: bruto };
  }

  const { codigo, ...resto } = validacao.data;

  if (codigo !== peca.codigo && (await pecaTemFilhas(id))) {
    return { erros: { codigo: MENSAGEM_CODIGO_TRAVADO }, valores: bruto };
  }

  const existente = encontrarCodigoDuplicado(await listarCodigos(), codigo, id);

  if (existente) {
    return {
      erros: { codigo: mensagemCodigoDuplicado(existente.codigo) },
      valores: bruto,
    };
  }

  // Código igual ao gravado não vai no update: nada a mudar, e assim uma
  // peça que ganhou parte no meio do caminho não tem o código tocado.
  const alteracao = codigo === peca.codigo ? resto : { codigo, ...resto };

  const { error } = await supabase
    .from("pecas_extensao")
    .update(alteracao)
    .eq("id", id);

  if (error) {
    return ehDuplicado(error)
      ? { erros: { codigo: mensagemCodigoDuplicado(codigo) }, valores: bruto }
      : { mensagem: `Não foi possível salvar: ${error.message}`, valores: bruto };
  }

  revalidatePath("/produtos");
  revalidatePath(`/produtos/extensao/${id}`);
  redirect("/produtos");
}

/**
 * Exclusão física: peça não tem `ativo` (018). Só de peça sem partes —
 * conferido aqui, e o `on delete restrict` da 018 é a rede de baixo.
 *
 * Devolve o recado em vez de redirecionar: a volta para a lista é do
 * cliente, como no Caixa.
 */
export async function excluirPeca(id: string): Promise<{ erro?: string }> {
  const { supabase } = await exigirSessao();

  if (await pecaTemFilhas(id)) {
    return { erro: MENSAGEM_EXCLUSAO_TRAVADA };
  }

  const { error } = await supabase.from("pecas_extensao").delete().eq("id", id);

  if (error) {
    return {
      erro: temParte(error)
        ? MENSAGEM_EXCLUSAO_TRAVADA
        : `Não foi possível excluir: ${error.message}`,
    };
  }

  revalidatePath("/produtos");

  return {};
}
