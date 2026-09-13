import { exigirSessao } from "@/lib/auth";

export type ServicoCatalogo = {
  id: string;
  nome: string;
};

export type AtendimentoNaLista = {
  id: string;
  data: string;
  observacao: string | null;
  servicos: string[];
  /** Fórmula registrada neste atendimento, quando houve coloração. */
  formulaId: string | null;
};

/** Quantos atendimentos a ficha da cliente mostra. */
const LIMITE_LISTA = 20;

/** Catálogo de serviços, para os chips do formulário de atendimento. */
export async function listarServicos(): Promise<ServicoCatalogo[]> {
  const { supabase } = await exigirSessao();

  const { data, error } = await supabase
    .from("servicos")
    .select("id, nome")
    .eq("ativo", true)
    .order("nome", { ascending: true });

  if (error) {
    throw new Error(`Não foi possível carregar os serviços: ${error.message}`);
  }

  return (data ?? []) as ServicoCatalogo[];
}

/**
 * Atendimentos da cliente, do mais recente para o mais antigo.
 *
 * Sem valores: atendimento aqui é o registro do que foi feito. O
 * financeiro vive em `lancamentos`, no módulo Caixa, e as duas coisas
 * não se cruzam nesta fase.
 */
export async function listarAtendimentos(
  clienteId: string,
): Promise<AtendimentoNaLista[]> {
  const { supabase } = await exigirSessao();

  const { data, error } = await supabase
    .from("atendimentos")
    .select("id, data, observacao, atendimento_itens(descricao), formulas(id)")
    .eq("cliente_id", clienteId)
    .order("data", { ascending: false })
    .order("criado_em", { ascending: false })
    .limit(LIMITE_LISTA);

  if (error) {
    throw new Error(
      `Não foi possível carregar os atendimentos: ${error.message}`,
    );
  }

  const linhas = (data ?? []) as unknown as {
    id: string;
    data: string;
    observacao: string | null;
    atendimento_itens: { descricao: string }[];
    formulas: { id: string }[];
  }[];

  return linhas.map((linha) => ({
    id: linha.id,
    data: linha.data,
    observacao: linha.observacao,
    servicos: linha.atendimento_itens.map((item) => item.descricao),
    formulaId: linha.formulas[0]?.id ?? null,
  }));
}
