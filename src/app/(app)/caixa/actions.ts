"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import { exigirSessao } from "@/lib/auth";
import { hoje } from "@/lib/caixa/mes";
import {
  errosPorCampo,
  lancamentoSchema,
  lerFormulario,
  type CampoLancamento,
} from "@/lib/caixa/schema";
import { listarClientes } from "@/lib/clientes/consultas";

export type EstadoFormulario = {
  erros?: Partial<Record<CampoLancamento, string>>;
  mensagem?: string;
  /** O que a usuária já tinha digitado, para o formulário não se apagar. */
  valores?: Partial<Record<CampoLancamento, string>>;
};

/** Todas as telas que mostram lançamento saem do cache de uma vez. */
function revalidarCaixa(id?: string) {
  revalidatePath("/caixa");
  revalidatePath("/caixa/pendentes");

  if (id) revalidatePath(`/caixa/${id}/editar`);
}

export async function criarLancamento(
  _estado: EstadoFormulario,
  formData: FormData,
): Promise<EstadoFormulario> {
  const { supabase } = await exigirSessao();

  const bruto = lerFormulario(formData);
  const validacao = lancamentoSchema.safeParse(bruto);

  if (!validacao.success) {
    return { erros: errosPorCampo(validacao.error), valores: bruto };
  }

  const { error } = await supabase
    .from("lancamentos")
    // `origem_registro` fica no default 'app': é o que separa o que nasce
    // aqui do histórico importado da planilha, e o que a UI pode excluir.
    .insert(validacao.data);

  if (error) {
    return {
      mensagem: `Não foi possível lançar: ${error.message}`,
      valores: bruto,
    };
  }

  // O histórico da cliente é montado a partir dos lançamentos dela.
  if (validacao.data.cliente_id) {
    revalidatePath(`/clientes/${validacao.data.cliente_id}`);
  }

  revalidarCaixa();
  // Volta para o mês do lançamento, não para o mês corrente: ela precisa
  // ver o que acabou de registrar.
  redirect(`/caixa?mes=${validacao.data.mes_competencia}`);
}

export async function atualizarLancamento(
  id: string,
  _estado: EstadoFormulario,
  formData: FormData,
): Promise<EstadoFormulario> {
  const { supabase } = await exigirSessao();

  const bruto = lerFormulario(formData);
  const validacao = lancamentoSchema.safeParse(bruto);

  if (!validacao.success) {
    return { erros: errosPorCampo(validacao.error), valores: bruto };
  }

  const { error } = await supabase
    .from("lancamentos")
    .update(validacao.data)
    .eq("id", id);

  if (error) {
    return {
      mensagem: `Não foi possível salvar: ${error.message}`,
      valores: bruto,
    };
  }

  if (validacao.data.cliente_id) {
    revalidatePath(`/clientes/${validacao.data.cliente_id}`);
  }

  revalidarCaixa(id);
  redirect(`/caixa?mes=${validacao.data.mes_competencia}`);
}

/**
 * Só sai o que nasceu no app. O histórico da planilha é registro fechado:
 * o `eq('origem_registro','app')` faz o próprio banco recusar o resto,
 * mesmo que a chamada venha de fora da UI.
 */
export async function excluirLancamento(id: string) {
  const { supabase } = await exigirSessao();

  const { data, error } = await supabase
    .from("lancamentos")
    .delete()
    .eq("id", id)
    .eq("origem_registro", "app")
    .select("id");

  if (error) {
    throw new Error(`Não foi possível excluir: ${error.message}`);
  }

  if ((data ?? []).length === 0) {
    throw new Error(
      "Este lançamento veio da planilha e não pode ser excluído aqui.",
    );
  }

  revalidarCaixa(id);
}

/**
 * Ação rápida da tela de pendentes: recebeu hoje, está pago hoje.
 * A data de caixa é obrigatória para o status Pago (chk_lancamento_caixa).
 */
export async function marcarComoPago(id: string) {
  const { supabase } = await exigirSessao();

  const { error } = await supabase
    .from("lancamentos")
    .update({ status: "Pago", data_caixa: hoje() })
    .eq("id", id);

  if (error) {
    throw new Error(`Não foi possível marcar como pago: ${error.message}`);
  }

  revalidarCaixa(id);
}

/** Busca de clientes do formulário de entrada — a mesma do módulo de clientes. */
export async function buscarClientes(termo: string) {
  if (termo.trim().length < 2) return [];

  const { clientes } = await listarClientes({ termo });

  return clientes.map(({ id, nome }) => ({ id, nome }));
}
