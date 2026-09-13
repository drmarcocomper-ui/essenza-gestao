"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import { exigirSessao } from "@/lib/auth";
import {
  erroDosItens,
  errosPorCampo,
  formulaSchema,
  itensSchema,
  lerFormulario,
  lerItens,
  MOMENTOS,
  type CampoErroFormula,
  type CampoFormula,
  type ItemBruto,
  type Momento,
} from "@/lib/formulas/schema";
import { BUCKET_FORMULAS, caminhoFoto } from "@/lib/formulas/storage";

export type EstadoFormula = {
  erros?: Partial<Record<CampoErroFormula, string>>;
  mensagem?: string;
  /** O que a usuária já tinha digitado, para o formulário não se apagar. */
  valores?: Partial<Record<CampoFormula, string>>;
  itens?: ItemBruto[];
};

/**
 * Grava a fórmula e leva para a ficha dela, que é onde as fotos entram.
 *
 * Salvar primeiro e fotografar depois é proposital: o upload acontece
 * numa tela onde a fórmula já está no banco, então uma falha de rede no
 * meio do atendimento nunca apaga o que ela digitou.
 */
export async function criarFormula(
  clienteId: string,
  _estado: EstadoFormula,
  formData: FormData,
): Promise<EstadoFormula> {
  const { supabase } = await exigirSessao();

  const bruto = lerFormulario(formData);
  const itensBrutos = lerItens(formData);

  const validacao = formulaSchema.safeParse(bruto);
  const validacaoItens = itensSchema.safeParse(itensBrutos);

  if (!validacao.success || !validacaoItens.success) {
    return {
      erros: {
        ...(validacao.success ? {} : errosPorCampo(validacao.error)),
        ...(validacaoItens.success
          ? {}
          : { itens: erroDosItens(validacaoItens.error) }),
      },
      valores: bruto,
      itens: itensBrutos,
    };
  }

  const { data, error } = await supabase
    .from("formulas")
    .insert({ ...validacao.data, cliente_id: clienteId })
    .select("id")
    .single();

  if (error) {
    return {
      mensagem: `Não foi possível salvar a fórmula: ${error.message}`,
      valores: bruto,
      itens: itensBrutos,
    };
  }

  if (validacaoItens.data.length > 0) {
    const { error: erroItens } = await supabase.from("formula_itens").insert(
      validacaoItens.data.map((item, ordem) => ({
        ...item,
        formula_id: data.id,
        ordem,
      })),
    );

    if (erroItens) {
      // Sem transação no PostgREST: a fórmula sem a mistura seria pior
      // que nenhuma fórmula — some com ela e devolve o formulário
      // inteiro, com a mistura preservada.
      await supabase.from("formulas").delete().eq("id", data.id);

      return {
        mensagem: `Não foi possível salvar a mistura: ${erroItens.message}`,
        valores: bruto,
        itens: itensBrutos,
      };
    }
  }

  revalidatePath(`/clientes/${clienteId}`);
  redirect(`/clientes/${clienteId}/formulas/${data.id}`);
}

function ehMomento(valor: string): valor is Momento {
  return (MOMENTOS as readonly string[]).includes(valor);
}

/**
 * Confere que a fórmula é mesmo desta cliente antes de mexer na foto.
 *
 * Server Action é um POST que pode ser disparado fora da UI: o par
 * (cliente, fórmula) chega do navegador e não pode ser aceito de graça.
 */
async function exigirFormula(clienteId: string, formulaId: string) {
  const { supabase } = await exigirSessao();

  const { data, error } = await supabase
    .from("formulas")
    .select("id")
    .eq("cliente_id", clienteId)
    .eq("id", formulaId)
    .maybeSingle();

  if (error) {
    throw new Error(`Não foi possível abrir a fórmula: ${error.message}`);
  }

  if (!data) {
    throw new Error("Fórmula não encontrada.");
  }

  return supabase;
}

/**
 * Registra no banco a foto que o navegador acabou de subir.
 *
 * O caminho é recalculado aqui a partir de cliente, fórmula e momento —
 * o navegador não escolhe onde o arquivo mora. Upsert porque o índice
 * único da 007 garante uma linha por momento: refazer a foto substitui,
 * não acumula.
 */
export async function registrarFoto(
  clienteId: string,
  formulaId: string,
  momento: string,
) {
  if (!ehMomento(momento)) {
    throw new Error("Momento inválido.");
  }

  const supabase = await exigirFormula(clienteId, formulaId);

  const { error } = await supabase.from("formula_fotos").upsert(
    {
      formula_id: formulaId,
      momento,
      storage_path: caminhoFoto(clienteId, formulaId, momento),
    },
    { onConflict: "formula_id,momento" },
  );

  if (error) {
    throw new Error(`Não foi possível registrar a foto: ${error.message}`);
  }

  revalidatePath(`/clientes/${clienteId}`);
  revalidatePath(`/clientes/${clienteId}/formulas/${formulaId}`);
}

/** Tira a foto errada do bucket e do banco, nessa ordem. */
export async function removerFoto(
  clienteId: string,
  formulaId: string,
  momento: string,
) {
  if (!ehMomento(momento)) {
    throw new Error("Momento inválido.");
  }

  const supabase = await exigirFormula(clienteId, formulaId);

  const { error: erroArquivo } = await supabase.storage
    .from(BUCKET_FORMULAS)
    .remove([caminhoFoto(clienteId, formulaId, momento)]);

  if (erroArquivo) {
    throw new Error(`Não foi possível apagar a foto: ${erroArquivo.message}`);
  }

  const { error } = await supabase
    .from("formula_fotos")
    .delete()
    .eq("formula_id", formulaId)
    .eq("momento", momento);

  if (error) {
    throw new Error(`Não foi possível apagar a foto: ${error.message}`);
  }

  revalidatePath(`/clientes/${clienteId}`);
  revalidatePath(`/clientes/${clienteId}/formulas/${formulaId}`);
}
