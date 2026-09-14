import { exigirSessao } from "@/lib/auth";

export type ServicoCatalogo = {
  id: string;
  nome: string;
  /**
   * O valor cru de `servicos.categoria` (012), não o rótulo. Null é
   * estado normal: serviço nascido no ato de um atendimento nasce sem
   * categoria, e quem exibe traduz por `ROTULOS_CATEGORIA`.
   *
   * É `string | null`, e não `CategoriaServico | null`, porque não há
   * `check` no banco: categoria fora da lista da aplicação é possível e
   * não pode virar erro de tipo.
   */
  categoria: string | null;
  /**
   * Preço sugerido do catálogo, ou null quando não há preço definido.
   *
   * `preco_padrao` é `not null default 0` (001), então zero ali quer
   * dizer "ainda não precificado", não "de graça". Vira null aqui para
   * nenhuma tela imprimir R$ 0,00 vindo de default — zero exibido parece
   * cortesia.
   */
  preco: number | null;
  /**
   * Nasceu no ato de um atendimento e continua sem preço. É a marca que
   * a leva de volta a ele para precificar (migration 008).
   *
   * Não é o mesmo que `preco === null`: as duas finalizações vieram do
   * catálogo com preço zero e também pedem valor digitado, mas não
   * carregam esta marca porque não nasceram de um atendimento.
   */
  semPreco: boolean;
};

export type ProdutoCatalogo = {
  id: string;
  nome: string;
  /**
   * `produtos.preco_venda` é nullable (001) e seis dos nove produtos de
   * revenda estão sem preço. Null é "sem preço definido"; zero, se algum
   * dia for gravado, é "de graça" — outra coisa, e por isso preservado.
   */
  preco: number | null;
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

/**
 * Catálogo de serviços, para os chips do formulário de atendimento.
 *
 * `incluirInativos` é para a conferência de nome antes de cadastrar um
 * serviço novo: reusar um serviço inativo é sempre melhor que criar uma
 * segunda linha com o mesmo nome.
 */
export async function listarServicos({
  incluirInativos = false,
}: { incluirInativos?: boolean } = {}): Promise<ServicoCatalogo[]> {
  const { supabase } = await exigirSessao();

  let consulta = supabase
    .from("servicos")
    .select("id, nome, preco_padrao, categoria, origem_registro")
    .order("nome", { ascending: true });

  if (!incluirInativos) {
    consulta = consulta.eq("ativo", true);
  }

  const { data, error } = await consulta;

  if (error) {
    throw new Error(`Não foi possível carregar os serviços: ${error.message}`);
  }

  const linhas = (data ?? []) as {
    id: string;
    nome: string;
    // numeric chega como string do PostgREST.
    preco_padrao: string | number;
    categoria: string | null;
    origem_registro: string;
  }[];

  return linhas.map((linha) => {
    const preco = Number(linha.preco_padrao);

    return {
      id: linha.id,
      nome: linha.nome,
      categoria: linha.categoria,
      preco: preco > 0 ? preco : null,
      semPreco: linha.origem_registro === "atendimento" && preco === 0,
    };
  });
}

/**
 * Produtos de revenda, para os chips da conta.
 *
 * Só `tipo = 'revenda'`: a mesma tabela guarda insumo de coloração —
 * tinta, oxidante, pó descolorante —, que entra na fórmula e nunca na
 * conta da cliente.
 */
export async function listarProdutosRevenda(): Promise<ProdutoCatalogo[]> {
  const { supabase } = await exigirSessao();

  const { data, error } = await supabase
    .from("produtos")
    .select("id, nome, preco_venda")
    .eq("tipo", "revenda")
    .eq("ativo", true)
    .order("nome", { ascending: true });

  if (error) {
    throw new Error(`Não foi possível carregar os produtos: ${error.message}`);
  }

  const linhas = (data ?? []) as {
    id: string;
    nome: string;
    preco_venda: string | number | null;
  }[];

  return linhas.map((linha) => ({
    id: linha.id,
    nome: linha.nome,
    preco: linha.preco_venda === null ? null : Number(linha.preco_venda),
  }));
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
