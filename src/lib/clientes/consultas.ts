import { clienteCasaComTermo } from "@/lib/busca";
import { exigirSessao } from "@/lib/auth";

export const POR_PAGINA = 20;

/**
 * Teto da varredura usada na busca por texto.
 *
 * A busca ignora acento, e o Postgres só faria isso com a extensão
 * `unaccent` e uma coluna normalizada — mudança de schema fora do escopo
 * desta fase. Enquanto a base é pequena (123 clientes hoje), sai mais
 * barato trazer nome e telefone e filtrar aqui do que migrar o banco.
 * Passando da casa dos milhares, trocar por coluna gerada + índice trgm:
 * só esta função muda.
 */
const LIMITE_BUSCA = 2000;

export type ClienteResumo = {
  id: string;
  nome: string;
  telefone: string | null;
  ativo: boolean;
  ultimoAtendimento: string | null;
};

export type Cliente = {
  id: string;
  nome: string;
  telefone: string | null;
  email: string | null;
  data_nascimento: string | null;
  municipio: string | null;
  bairro: string | null;
  profissao: string | null;
  preferencias: string | null;
  origem: string | null;
  observacoes: string | null;
  data_cadastro: string | null;
  ativo: boolean;
};

export type Lancamento = {
  id: string;
  data_competencia: string;
  descricao: string;
  categoria: string;
  valor: string;
  status: string;
  forma_pagamento: string | null;
};

export type PaginaClientes = {
  clientes: ClienteResumo[];
  total: number;
  temMais: boolean;
};

export type FiltroClientes = {
  termo?: string;
  incluirInativos?: boolean;
  pagina?: number;
};

/** Campos do cadastro que a lista precisa. Valores não entram aqui. */
const COLUNAS_RESUMO = "id, nome, telefone, ativo";

/**
 * Lista paginada, ordenada por nome.
 *
 * Sem termo, a paginação é feita no banco (range + count). Com termo, o
 * filtro acontece em memória — ver a nota do LIMITE_BUSCA.
 */
export async function listarClientes({
  termo = "",
  incluirInativos = false,
  pagina = 0,
}: FiltroClientes = {}): Promise<PaginaClientes> {
  const { supabase } = await exigirSessao();

  const buscando = termo.trim().length > 0;

  let consulta = supabase
    .from("clientes")
    .select(COLUNAS_RESUMO, { count: "exact" })
    .order("nome", { ascending: true });

  if (!incluirInativos) {
    consulta = consulta.eq("ativo", true);
  }

  consulta = buscando
    ? consulta.range(0, LIMITE_BUSCA - 1)
    : consulta.range(pagina * POR_PAGINA, (pagina + 1) * POR_PAGINA - 1);

  const { data, error, count } = await consulta;

  if (error) {
    throw new Error(`Não foi possível carregar as clientes: ${error.message}`);
  }

  const linhas = (data ?? []) as Omit<ClienteResumo, "ultimoAtendimento">[];

  let pagina_atual = linhas;
  let total = count ?? linhas.length;

  if (buscando) {
    const filtradas = linhas.filter((cliente) =>
      clienteCasaComTermo(cliente, termo),
    );

    total = filtradas.length;
    pagina_atual = filtradas.slice(
      pagina * POR_PAGINA,
      (pagina + 1) * POR_PAGINA,
    );
  }

  const ultimos = await ultimosAtendimentos(
    supabase,
    pagina_atual.map((cliente) => cliente.id),
  );

  return {
    clientes: pagina_atual.map((cliente) => ({
      ...cliente,
      ultimoAtendimento: ultimos.get(cliente.id) ?? null,
    })),
    total,
    temMais: (pagina + 1) * POR_PAGINA < total,
  };
}

type ClienteSupabase = Awaited<ReturnType<typeof exigirSessao>>["supabase"];

/**
 * Data do atendimento mais recente de cada cliente da página.
 *
 * Uma consulta só, restrita aos ids visíveis — evita o N+1 e não depende
 * de view de agregação no banco.
 */
async function ultimosAtendimentos(supabase: ClienteSupabase, ids: string[]) {
  const mapa = new Map<string, string>();

  if (ids.length === 0) return mapa;

  const { data, error } = await supabase
    .from("lancamentos")
    .select("cliente_id, data_competencia")
    .in("cliente_id", ids)
    .eq("tipo", "Entrada")
    .order("data_competencia", { ascending: false });

  if (error) {
    throw new Error(`Não foi possível carregar o histórico: ${error.message}`);
  }

  for (const linha of (data ?? []) as {
    cliente_id: string;
    data_competencia: string;
  }[]) {
    // Vem ordenado do mais recente para o mais antigo: o primeiro de cada
    // cliente já é o último atendimento.
    if (!mapa.has(linha.cliente_id)) {
      mapa.set(linha.cliente_id, linha.data_competencia);
    }
  }

  return mapa;
}

/** Cadastro completo. Devolve null quando o id não existe. */
export async function obterCliente(id: string): Promise<Cliente | null> {
  const { supabase } = await exigirSessao();

  const { data, error } = await supabase
    .from("clientes")
    .select(
      "id, nome, telefone, email, data_nascimento, municipio, bairro, profissao, preferencias, origem, observacoes, data_cadastro, ativo",
    )
    .eq("id", id)
    .maybeSingle();

  if (error) {
    throw new Error(`Não foi possível carregar a cliente: ${error.message}`);
  }

  return (data as Cliente | null) ?? null;
}

export type HistoricoCliente = {
  lancamentos: Lancamento[];
  total: number;
  primeiroAtendimento: string | null;
};

/**
 * Histórico financeiro da cliente, do mais recente para o mais antigo.
 * Somente leitura: esta sessão não mexe em lançamentos.
 */
export async function obterHistorico(
  clienteId: string,
): Promise<HistoricoCliente> {
  const { supabase } = await exigirSessao();

  const { data, error } = await supabase
    .from("lancamentos")
    .select(
      "id, data_competencia, descricao, categoria, valor, status, forma_pagamento",
    )
    .eq("cliente_id", clienteId)
    .eq("tipo", "Entrada")
    .order("data_competencia", { ascending: false });

  if (error) {
    throw new Error(`Não foi possível carregar o histórico: ${error.message}`);
  }

  const lancamentos = (data ?? []) as Lancamento[];

  return {
    lancamentos,
    total: lancamentos.reduce((soma, item) => soma + Number(item.valor), 0),
    // A lista vem em ordem decrescente, então o primeiro atendimento é o
    // último item.
    primeiroAtendimento:
      lancamentos.at(-1)?.data_competencia ?? null,
  };
}
