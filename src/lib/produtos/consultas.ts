import { exigirSessao } from "@/lib/auth";
import type { ProdutoIdentificavel } from "@/lib/produtos/regras";

/**
 * Produto de revenda, como a tela de Produtos mostra e edita.
 *
 * `preco` null é "sem preço definido" — o mesmo contrato de
 * `ProdutoCatalogo` na conta.
 */
export type ProdutoRevenda = {
  id: string;
  nome: string;
  marca: string | null;
  preco: number | null;
  ativo: boolean;
  /** 'atendimento' = criado no "Outro produto" do fechamento (019). */
  origem: "catalogo" | "atendimento";
};

type LinhaProduto = {
  id: string;
  nome: string;
  marca: string | null;
  preco_venda: string | number | null;
  ativo: boolean;
  origem_registro: "catalogo" | "atendimento";
};

const COLUNAS = "id, nome, marca, preco_venda, ativo, origem_registro";

function paraProduto(linha: LinhaProduto): ProdutoRevenda {
  return {
    id: linha.id,
    nome: linha.nome,
    marca: linha.marca,
    preco: linha.preco_venda === null ? null : Number(linha.preco_venda),
    ativo: linha.ativo,
    origem: linha.origem_registro,
  };
}

/**
 * Todos os produtos de revenda, ativos e inativos. O catálogo tem
 * dezenas de linhas: a ordem e a busca são feitas na tela.
 *
 * Só `tipo = 'revenda'`: insumo de coloração mora na mesma tabela e não
 * é assunto desta tela.
 */
export async function listarProdutos(): Promise<ProdutoRevenda[]> {
  const { supabase } = await exigirSessao();

  const { data, error } = await supabase
    .from("produtos")
    .select(COLUNAS)
    .eq("tipo", "revenda");

  if (error) {
    throw new Error(`Não foi possível carregar os produtos: ${error.message}`);
  }

  return ((data ?? []) as LinhaProduto[]).map(paraProduto);
}

/** Um produto de revenda, ou null se não existe ou é insumo. */
export async function obterProduto(
  id: string,
): Promise<ProdutoRevenda | null> {
  const { supabase } = await exigirSessao();

  const { data, error } = await supabase
    .from("produtos")
    .select(COLUNAS)
    .eq("id", id)
    .eq("tipo", "revenda")
    .maybeSingle();

  if (error) {
    // id que não é uuid chega como 22P02: é o mesmo que não existir.
    if (error.code === "22P02") return null;

    throw new Error(`Não foi possível carregar o produto: ${error.message}`);
  }

  return data ? paraProduto(data as LinhaProduto) : null;
}

/**
 * A tabela inteira — todos os tipos, ativos e inativos — para
 * `conferirCadastro` e `encontrarDuplicado`. O cadastro olha os
 * inativos (reativar, não recadastrar); a reativação filtra os ativos,
 * que é o universo do índice da 011.
 */
export async function listarParaConferencia(): Promise<
  ProdutoIdentificavel[]
> {
  const { supabase } = await exigirSessao();

  const { data, error } = await supabase
    .from("produtos")
    .select("id, nome, marca, tipo, ativo");

  if (error) {
    throw new Error(`Não foi possível conferir os produtos: ${error.message}`);
  }

  return (data ?? []) as ProdutoIdentificavel[];
}
