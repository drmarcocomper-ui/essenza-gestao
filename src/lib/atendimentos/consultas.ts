import { exigirSessao } from "@/lib/auth";

export type ServicoCatalogo = {
  id: string;
  nome: string;
  /**
   * Nasceu no ato de um atendimento e continua sem preço. É a marca que
   * a leva de volta a ele para precificar (migration 008).
   */
  semPreco: boolean;
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
    .select("id, nome, preco_padrao, origem_registro")
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
    origem_registro: string;
  }[];

  return linhas.map((linha) => ({
    id: linha.id,
    nome: linha.nome,
    semPreco:
      linha.origem_registro === "atendimento" &&
      Number(linha.preco_padrao) === 0,
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
