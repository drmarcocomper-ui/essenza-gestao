import type { TipoItem } from "@/lib/atendimentos/conta";
import type { ProdutoConferivel } from "@/lib/atendimentos/produtos";
import { exigirSessao } from "@/lib/auth";
import { compararPorParcela } from "@/lib/caixa/parcela";

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
  /**
   * Conta fechada é "existe lançamento com este atendimento_id". Não há
   * coluna de status: o lançamento é o próprio fato.
   */
  fechada: boolean;
  /** Soma dos lançamentos da conta. Zero enquanto ela está aberta. */
  total: number;
};

/** A peça de extensão de um item, como a conta a mostra. */
export type PecaDoItem = {
  id: string;
  codigo: string;
  cor: string | null;
  gramas: number | null;
  comprimentoCm: number | null;
};

/** numeric do PostgREST (string) → número; null continua null. */
function numeroOuNulo(valor: number | string | null) {
  return valor === null ? null : Number(valor);
}

export type ItemDoAtendimento = {
  id: string;
  tipo: TipoItem;
  servicoId: string | null;
  produtoId: string | null;
  /** Só no item de peça de extensão (020). */
  pecaExtensaoId: string | null;
  /** A peça do item, para a conta mostrar e linkar; null fora dela. */
  peca: PecaDoItem | null;
  /** Snapshot do nome no momento da venda. */
  descricao: string;
  quantidade: number;
  valorUnitario: number;
};

export type FormaDaConta = {
  id: string;
  instituicao: string | null;
  titularidade: string | null;
  valor: number;
  dataCaixa: string | null;
  /** Pendente é crédito que ainda não caiu; Pago já entrou no caixa. */
  status: "Pago" | "Pendente";
  /** "1/3" em crédito parcelado. Texto cru: ver `lerParcela`. */
  parcelamento: string | null;
  /** "Cartão de crédito", "Pix"… Null quando não informada. */
  formaPagamento: string | null;
};

export type AtendimentoDetalhe = {
  id: string;
  clienteId: string;
  data: string;
  observacao: string | null;
  itens: ItemDoAtendimento[];
  formas: FormaDaConta[];
  formulaId: string | null;
  fechada: boolean;
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
 * A tabela `produtos` inteira — inativos e insumos incluídos —, só com o
 * que a conferência de nome precisa (`decidirProdutoPorNome`).
 *
 * Produto se reativa, nunca se recadastra: antes de cadastrar o nome
 * que ela digitou na conta, a busca tem que enxergar também o que está
 * desativado ou cadastrado como material de uso.
 */
export async function listarProdutosParaConferencia(): Promise<
  ProdutoConferivel[]
> {
  const { supabase } = await exigirSessao();

  const { data, error } = await supabase
    .from("produtos")
    .select("id, nome, tipo, ativo")
    .order("nome", { ascending: true });

  if (error) {
    throw new Error(`Não foi possível carregar os produtos: ${error.message}`);
  }

  return (data ?? []) as ProdutoConferivel[];
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
    .select(
      "id, data, observacao, atendimento_itens(descricao), formulas(id), lancamentos(valor)",
    )
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
    lancamentos: { valor: number | string }[];
  }[];

  return linhas.map((linha) => ({
    id: linha.id,
    data: linha.data,
    observacao: linha.observacao,
    servicos: linha.atendimento_itens.map((item) => item.descricao),
    formulaId: linha.formulas[0]?.id ?? null,
    fechada: linha.lancamentos.length > 0,
    total: linha.lancamentos.reduce(
      (soma, lancamento) => soma + Number(lancamento.valor),
      0,
    ),
  }));
}

/**
 * Um atendimento com tudo que a tela dele mostra: itens, formas de
 * pagamento e a fórmula, se houve.
 *
 * O `cliente_id` entra no filtro, e não só o id do atendimento: a URL
 * traz os dois, e um atendimento de outra cliente aberto por uma URL
 * montada à mão tem que dar 404, não mostrar a conta de quem não é.
 *
 * Conta fechada é a existência de lançamento com este `atendimento_id`.
 * É o que a ordem de gravação garante — os lançamentos entram por
 * último, então o que tem lançamento tem item, e nunca o contrário.
 */
export async function obterAtendimento(
  clienteId: string,
  atendimentoId: string,
): Promise<AtendimentoDetalhe | null> {
  const { supabase } = await exigirSessao();

  const { data, error } = await supabase
    .from("atendimentos")
    .select(
      "id, cliente_id, data, observacao, atendimento_itens(id, tipo, servico_id, produto_id, peca_extensao_id, descricao, quantidade, valor_unitario, pecas_extensao(codigo, cor, gramas, comprimento_cm)), lancamentos(id, instituicao, titularidade, valor, data_caixa, status, parcelamento, forma_pagamento), formulas(id)",
    )
    .eq("id", atendimentoId)
    .eq("cliente_id", clienteId)
    .maybeSingle();

  if (error) {
    throw new Error(
      `Não foi possível carregar o atendimento: ${error.message}`,
    );
  }

  if (!data) return null;

  const linha = data as unknown as {
    id: string;
    cliente_id: string;
    data: string;
    observacao: string | null;
    atendimento_itens: {
      id: string;
      tipo: TipoItem;
      servico_id: string | null;
      produto_id: string | null;
      peca_extensao_id: string | null;
      pecas_extensao: {
        codigo: string;
        cor: string | null;
        gramas: number | string | null;
        comprimento_cm: number | string | null;
      } | null;
      descricao: string;
      quantidade: number | string;
      valor_unitario: number | string;
    }[];
    lancamentos: {
      id: string;
      instituicao: string | null;
      titularidade: string | null;
      valor: number | string;
      data_caixa: string | null;
      status: "Pago" | "Pendente";
      parcelamento: string | null;
      forma_pagamento: string | null;
    }[];
    formulas: { id: string }[];
  };

  return {
    id: linha.id,
    clienteId: linha.cliente_id,
    data: linha.data,
    observacao: linha.observacao,
    itens: linha.atendimento_itens.map((item) => ({
      id: item.id,
      tipo: item.tipo,
      servicoId: item.servico_id,
      produtoId: item.produto_id,
      pecaExtensaoId: item.peca_extensao_id,
      peca:
        item.peca_extensao_id && item.pecas_extensao
          ? {
              id: item.peca_extensao_id,
              codigo: item.pecas_extensao.codigo,
              cor: item.pecas_extensao.cor,
              gramas: numeroOuNulo(item.pecas_extensao.gramas),
              comprimentoCm: numeroOuNulo(item.pecas_extensao.comprimento_cm),
            }
          : null,
      descricao: item.descricao,
      quantidade: Number(item.quantidade),
      valorUnitario: Number(item.valor_unitario),
    })),
    // Ordenado aqui, não no banco: a ordem do embed não é garantida, e
    // "10/12" ordenado como texto viria antes de "2/12".
    formas: [...linha.lancamentos].sort(compararPorParcela).map((lancamento) => ({
      id: lancamento.id,
      instituicao: lancamento.instituicao,
      titularidade: lancamento.titularidade,
      valor: Number(lancamento.valor),
      dataCaixa: lancamento.data_caixa,
      status: lancamento.status,
      parcelamento: lancamento.parcelamento,
      formaPagamento: lancamento.forma_pagamento,
    })),
    formulaId: linha.formulas[0]?.id ?? null,
    fechada: linha.lancamentos.length > 0,
  };
}
