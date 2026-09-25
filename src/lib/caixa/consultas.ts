import { exigirSessao } from "@/lib/auth";
import { primeiroDia, ultimoDia } from "@/lib/caixa/mes";
import type { StatusLancamento, TipoLancamento } from "@/lib/caixa/schema";

/**
 * Teto da varredura usada para sugerir instituições já digitadas.
 *
 * PostgREST não faz DISTINCT, e a base tem 413 lançamentos: sai mais
 * barato trazer a coluna e deduplicar aqui do que criar view para isso.
 * Passando de alguns milhares, virar uma view `vw_instituicoes`.
 */
const LIMITE_INSTITUICOES = 2000;

export type LancamentoLista = {
  id: string;
  data_competencia: string;
  data_caixa: string | null;
  tipo: TipoLancamento;
  categoria: string;
  descricao: string;
  // numeric no banco chega como número JSON, não string.
  valor: number;
  status: StatusLancamento;
  forma_pagamento: string | null;
  fornecedor: string | null;
  cliente: { id: string; nome: string } | null;
};

export type Lancamento = {
  id: string;
  data_competencia: string;
  data_caixa: string | null;
  tipo: TipoLancamento;
  categoria: string;
  descricao: string;
  cliente_id: string | null;
  /** Preenchido nas parcelas vindas do fechamento de conta. */
  atendimento_id: string | null;
  fornecedor: string | null;
  forma_pagamento: string | null;
  instituicao: string | null;
  titularidade: string | null;
  parcelamento: string | null;
  // numeric no banco chega como número JSON, não string.
  valor: number;
  status: StatusLancamento;
  observacoes: string | null;
  origem_registro: string;
  cliente: { id: string; nome: string } | null;
};

export type ResumoMes = {
  entradas: number;
  saidas: number;
  resultado: number;
};

export type Pendente = {
  id: string;
  data_competencia: string;
  descricao: string;
  // numeric no banco chega como número JSON, não string.
  valor: number;
  cliente: string | null;
  /** "1/3", "2/3" — texto, como na planilha. Null fora de parcelamento. */
  parcelamento: string | null;
};

export type Categoria = {
  id: string;
  tipo: TipoLancamento;
  nome: string;
};

export type FiltroCaixa = {
  mes: string;
  tipo?: TipoLancamento | "Todos";
  status?: StatusLancamento | "Todos";
};

const COLUNAS_LISTA =
  "id, data_competencia, data_caixa, tipo, categoria, descricao, valor, status, forma_pagamento, fornecedor, cliente:clientes(id, nome)";

/**
 * Lançamentos de um mês de competência, do mais recente para o mais
 * antigo. Dentro do mesmo dia, o que foi lançado por último aparece em
 * cima — é o que ela acabou de digitar.
 */
export async function listarLancamentos({
  mes,
  tipo = "Todos",
  status = "Todos",
}: FiltroCaixa): Promise<LancamentoLista[]> {
  const { supabase } = await exigirSessao();

  let consulta = supabase
    .from("lancamentos")
    .select(COLUNAS_LISTA)
    .gte("data_competencia", primeiroDia(mes))
    .lte("data_competencia", ultimoDia(mes))
    .order("data_competencia", { ascending: false })
    .order("criado_em", { ascending: false });

  if (tipo !== "Todos") consulta = consulta.eq("tipo", tipo);
  if (status !== "Todos") consulta = consulta.eq("status", status);

  const { data, error } = await consulta;

  if (error) {
    throw new Error(`Não foi possível carregar o caixa: ${error.message}`);
  }

  return (data ?? []) as unknown as LancamentoLista[];
}

/**
 * Resumo do mês em regime de competência, direto da view de fechamento.
 * Mês sem lançamento não tem linha na view: vira zero, não erro.
 */
export async function obterResumoMes(mes: string): Promise<ResumoMes> {
  const { supabase } = await exigirSessao();

  const { data, error } = await supabase
    .from("vw_resumo_competencia")
    .select("entradas, saidas, resultado")
    .eq("mes", mes)
    .maybeSingle();

  if (error) {
    throw new Error(`Não foi possível carregar o resumo: ${error.message}`);
  }

  const linha = data as {
    entradas: string | null;
    saidas: string | null;
    resultado: string | null;
  } | null;

  return {
    entradas: Number(linha?.entradas ?? 0),
    saidas: Number(linha?.saidas ?? 0),
    resultado: Number(linha?.resultado ?? 0),
  };
}

/**
 * Quantas entradas seguem pendentes — em qualquer mês, não só no que
 * está na tela. É dinheiro a receber que ela não pode perder de vista.
 */
export async function contarPendentes(): Promise<number> {
  const { supabase } = await exigirSessao();

  const { count, error } = await supabase
    .from("lancamentos")
    .select("id", { count: "exact", head: true })
    .eq("tipo", "Entrada")
    .eq("status", "Pendente");

  if (error) {
    throw new Error(`Não foi possível contar as pendências: ${error.message}`);
  }

  return count ?? 0;
}

/**
 * A receber, da mais antiga para a mais nova — a ordem em que as
 * parcelas vão cair.
 *
 * `parcelamento` vem da migration 014: sem ele, as três parcelas da
 * mesma venda são linhas idênticas na tela.
 */
export async function listarPendentes(): Promise<Pendente[]> {
  const { supabase } = await exigirSessao();

  const { data, error } = await supabase
    .from("vw_a_receber")
    .select("id, data_competencia, descricao, valor, cliente, parcelamento")
    // A view já ordena, mas ordenar aqui não depende disso.
    .order("data_competencia", { ascending: true });

  if (error) {
    throw new Error(`Não foi possível carregar as pendências: ${error.message}`);
  }

  return (data ?? []) as unknown as Pendente[];
}

/** Lançamento completo, para a tela de edição. Null quando o id não existe. */
export async function obterLancamento(id: string): Promise<Lancamento | null> {
  const { supabase } = await exigirSessao();

  const { data, error } = await supabase
    .from("lancamentos")
    .select(
      "id, data_competencia, data_caixa, tipo, categoria, descricao, cliente_id, atendimento_id, fornecedor, forma_pagamento, instituicao, titularidade, parcelamento, valor, status, observacoes, origem_registro, cliente:clientes(id, nome)",
    )
    .eq("id", id)
    .maybeSingle();

  if (error) {
    throw new Error(`Não foi possível carregar o lançamento: ${error.message}`);
  }

  return (data as unknown as Lancamento | null) ?? null;
}

/** Categorias ativas dos dois tipos: o formulário troca a lista ao vivo. */
export async function listarCategorias(): Promise<Categoria[]> {
  const { supabase } = await exigirSessao();

  const { data, error } = await supabase
    .from("categorias_lancamento")
    .select("id, tipo, nome")
    .eq("ativo", true)
    .order("tipo", { ascending: true })
    .order("ordem", { ascending: true });

  if (error) {
    throw new Error(`Não foi possível carregar as categorias: ${error.message}`);
  }

  return (data ?? []) as unknown as Categoria[];
}

/** Instituições já usadas, para sugerir em vez de obrigar a digitar. */
export async function listarInstituicoes(): Promise<string[]> {
  const { supabase } = await exigirSessao();

  const { data, error } = await supabase
    .from("lancamentos")
    .select("instituicao")
    .not("instituicao", "is", null)
    .limit(LIMITE_INSTITUICOES);

  if (error) {
    throw new Error(`Não foi possível carregar as instituições: ${error.message}`);
  }

  const linhas = (data ?? []) as { instituicao: string | null }[];
  const nomes = new Set<string>();

  for (const linha of linhas) {
    const nome = linha.instituicao?.trim();

    if (nome) nomes.add(nome);
  }

  return [...nomes].sort((a, b) => a.localeCompare(b, "pt-BR"));
}
