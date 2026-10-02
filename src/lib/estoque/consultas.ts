import { exigirSessao } from "@/lib/auth";
import {
  registradoDepois,
  type Contagem,
  type Entrada,
  type Saida,
} from "@/lib/estoque/saldo";

/**
 * Os fatos de que o saldo é feito (021): contagens, linhas de compra e
 * itens de produto nas contas. Nenhuma conta aqui — quem soma é
 * `calcularSaldo`. Nenhuma view: as três leituras são diretas.
 */

/** Produto de revenda ativo, como o estoque o lista. */
export type ProdutoDeEstoque = {
  id: string;
  nome: string;
  marca: string | null;
};

export type ContagemRegistrada = Contagem & {
  id: string;
  observacao: string | null;
};

export type EntradaRegistrada = Entrada & {
  compraId: string;
  fornecedor: string;
  custoUnitario: number;
};

export type SaidaRegistrada = Saida & {
  atendimentoId: string;
  clienteId: string;
  clienteNome: string;
};

export type Movimentos = {
  contagens: ContagemRegistrada[];
  entradas: EntradaRegistrada[];
  saidas: SaidaRegistrada[];
};

type NumericBanco = string | number;

/**
 * O PostgREST corta a resposta em 1000 linhas, sem erro. Os itens de
 * venda de anos somados passam disso: a leitura vem em páginas, como o
 * CSV anual.
 */
const PAGINA = 1000;

async function lerEmPaginas<T>(
  pagina: (
    inicio: number,
    fim: number,
  ) => PromiseLike<{ data: unknown; error: { message: string } | null }>,
  oQue: string,
): Promise<T[]> {
  const todas: T[] = [];

  for (let inicio = 0; ; inicio += PAGINA) {
    const { data, error } = await pagina(inicio, inicio + PAGINA - 1);

    if (error) {
      throw new Error(`Não foi possível carregar ${oQue}: ${error.message}`);
    }

    const linhas = (data ?? []) as T[];

    todas.push(...linhas);

    if (linhas.length < PAGINA) return todas;
  }
}

/**
 * Revenda ativa, em ordem alfabética do português — a mesma dos blocos
 * do catálogo na conta. Insumo de coloração não tem estoque de frasco.
 */
export async function listarProdutosDeEstoque(): Promise<ProdutoDeEstoque[]> {
  const { supabase } = await exigirSessao();

  const { data, error } = await supabase
    .from("produtos")
    .select("id, nome, marca")
    .eq("tipo", "revenda")
    .eq("ativo", true);

  if (error) {
    throw new Error(`Não foi possível carregar os produtos: ${error.message}`);
  }

  return ((data ?? []) as ProdutoDeEstoque[]).sort((a, b) =>
    a.nome.localeCompare(b.nome, "pt-BR", { sensitivity: "base" }),
  );
}

type LinhaContagem = {
  id: string;
  produto_id: string;
  data: string;
  quantidade: NumericBanco;
  observacao: string | null;
  criado_em: string;
};

type LinhaCompraItem = {
  id: string;
  produto_id: string;
  quantidade: NumericBanco;
  custo_unitario: NumericBanco;
  compras: {
    id: string;
    data: string;
    fornecedor: string;
    criado_em: string;
  } | null;
};

type LinhaVenda = {
  id: string;
  produto_id: string;
  quantidade: NumericBanco;
  atendimento_id: string;
  atendimentos: {
    data: string;
    cliente_id: string;
    clientes: { nome: string } | null;
    lancamentos: { criado_em: string }[];
  } | null;
};

/** O primeiro lançamento da conta é o fechamento; nenhum = conta aberta. */
function horaDoFechamento(lancamentos: { criado_em: string }[]) {
  let primeiro: string | null = null;

  for (const { criado_em } of lancamentos) {
    if (primeiro === null || registradoDepois(primeiro, criado_em)) {
      primeiro = criado_em;
    }
  }

  return primeiro;
}

function vazio(): Movimentos {
  return { contagens: [], entradas: [], saidas: [] };
}

/**
 * Contagens, entradas e saídas de cada produto pedido, por id.
 *
 * Venda é item `tipo = 'produto'` com o `produto_id`. Venda feita só
 * pelo Caixa não tem produto e não aparece — a contagem corrige; não se
 * adivinha produto pela descrição do lançamento.
 */
export async function lerMovimentos(
  produtoIds: readonly string[],
): Promise<Map<string, Movimentos>> {
  const porProduto = new Map<string, Movimentos>(
    produtoIds.map((id) => [id, vazio()]),
  );

  if (produtoIds.length === 0) return porProduto;

  const { supabase } = await exigirSessao();
  const ids = [...produtoIds];

  const [contagens, compras, vendas] = await Promise.all([
    lerEmPaginas<LinhaContagem>(
      (inicio, fim) =>
        supabase
          .from("estoque_contagens")
          .select("id, produto_id, data, quantidade, observacao, criado_em")
          .in("produto_id", ids)
          .order("id")
          .range(inicio, fim),
      "as contagens",
    ),
    lerEmPaginas<LinhaCompraItem>(
      (inicio, fim) =>
        supabase
          .from("compra_itens")
          .select(
            "id, produto_id, quantidade, custo_unitario, compras(id, data, fornecedor, criado_em)",
          )
          .in("produto_id", ids)
          .order("id")
          .range(inicio, fim),
      "as compras",
    ),
    lerEmPaginas<LinhaVenda>(
      (inicio, fim) =>
        supabase
          .from("atendimento_itens")
          .select(
            "id, produto_id, quantidade, atendimento_id, atendimentos(data, cliente_id, clientes(nome), lancamentos(criado_em))",
          )
          .eq("tipo", "produto")
          .in("produto_id", ids)
          .order("id")
          .range(inicio, fim),
      "as vendas",
    ),
  ]);

  for (const linha of contagens) {
    porProduto.get(linha.produto_id)?.contagens.push({
      id: linha.id,
      data: linha.data,
      registradoEm: linha.criado_em,
      quantidade: Number(linha.quantidade),
      observacao: linha.observacao,
    });
  }

  for (const linha of compras) {
    if (!linha.compras) continue;

    porProduto.get(linha.produto_id)?.entradas.push({
      compraId: linha.compras.id,
      fornecedor: linha.compras.fornecedor,
      data: linha.compras.data,
      registradoEm: linha.compras.criado_em,
      quantidade: Number(linha.quantidade),
      custoUnitario: Number(linha.custo_unitario),
    });
  }

  for (const linha of vendas) {
    const atendimento = linha.atendimentos;

    if (!atendimento) continue;

    porProduto.get(linha.produto_id)?.saidas.push({
      atendimentoId: linha.atendimento_id,
      clienteId: atendimento.cliente_id,
      clienteNome: atendimento.clientes?.nome ?? "cliente",
      data: atendimento.data,
      fechadaEm: horaDoFechamento(atendimento.lancamentos),
      quantidade: Number(linha.quantidade),
    });
  }

  return porProduto;
}

/** Os movimentos de um produto só. */
export async function lerMovimentosDoProduto(id: string): Promise<Movimentos> {
  return (await lerMovimentos([id])).get(id) ?? vazio();
}
