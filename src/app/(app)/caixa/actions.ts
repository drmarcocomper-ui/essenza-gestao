"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import { exigirSessao } from "@/lib/auth";
import { obterLancamento } from "@/lib/caixa/consultas";
import {
  confirmacaoRecebimentoSchema,
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
 * Resultado da confirmação. A mensagem volta como valor, não como
 * exceção: em produção o Next troca a mensagem de um erro lançado no
 * servidor por um texto genérico em inglês, e ela precisa ler em
 * português por que a confirmação não passou.
 */
export type ResultadoConfirmacao =
  | { ok: true }
  | { ok: false; mensagem: string };

/**
 * A parcela caiu: ela informa o dia, e o lançamento vira Pago.
 *
 * `status` e `data_caixa` vão no MESMO update — `chk_lancamento_caixa`
 * recusa Pago sem data, então gravar em dois passos quebraria no meio.
 *
 * A data vem dela e só dela. O app não prevê compensação: não calcula a
 * partir da venda, não sugere prazo de cartão, não preenche sozinho.
 */
export async function confirmarRecebimento(
  id: string,
  dataCaixa: string,
): Promise<ResultadoConfirmacao> {
  const { supabase } = await exigirSessao();

  const validacao = confirmacaoRecebimentoSchema.safeParse({
    id,
    data_caixa: dataCaixa,
  });

  if (!validacao.success) {
    return {
      ok: false,
      mensagem: validacao.error.issues[0]?.message ?? "Dados inválidos.",
    };
  }

  // A tela pode estar velha — aberta antes de ela confirmar a mesma
  // parcela em outro lugar. O que vale é o que está no banco agora.
  const lancamento = await obterLancamento(validacao.data.id);

  if (!lancamento) {
    return { ok: false, mensagem: "Este lançamento não existe mais." };
  }

  if (lancamento.status !== "Pendente") {
    return { ok: false, mensagem: "Este recebimento já foi confirmado." };
  }

  const { data, error } = await supabase
    .from("lancamentos")
    .update({ status: "Pago", data_caixa: validacao.data.data_caixa })
    .eq("id", validacao.data.id)
    // Fecha a corrida entre a releitura acima e a escrita: se alguém
    // confirmou no meio, o update não pega linha nenhuma.
    .eq("status", "Pendente")
    .select("id");

  if (error) {
    return {
      ok: false,
      mensagem: `Não foi possível confirmar: ${error.message}`,
    };
  }

  if ((data ?? []).length === 0) {
    return { ok: false, mensagem: "Este recebimento já foi confirmado." };
  }

  // O histórico da cliente mostra o status do lançamento.
  if (lancamento.cliente_id) {
    revalidatePath(`/clientes/${lancamento.cliente_id}`);
  }

  revalidarCaixa(validacao.data.id);

  return { ok: true };
}

/** Busca de clientes do formulário de entrada — a mesma do módulo de clientes. */
export async function buscarClientes(termo: string) {
  if (termo.trim().length < 2) return [];

  const { clientes } = await listarClientes({ termo });

  return clientes.map(({ id, nome }) => ({ id, nome }));
}
