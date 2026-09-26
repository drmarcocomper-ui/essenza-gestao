import { exigirSessao } from "@/lib/auth";
import type { PecaIdentificavel } from "@/lib/pecas-extensao/regras";
import { valoresDistintos } from "@/lib/pecas-extensao/regras";

/**
 * Peça de extensão (018), como a seção Extensão mostra e edita.
 *
 * Toda medida e todo preço null é "não informado" — nunca zero.
 */
export type PecaExtensao = {
  id: string;
  codigo: string;
  /** Só nas partes de um desmembramento. A tela nunca o altera. */
  pecaMaeId: string | null;
  cor: string | null;
  textura: string | null;
  gramas: number | null;
  comprimentoCm: number | null;
  precoCompra: number | null;
  precoVenda: number | null;
  /** Fornecedor, texto livre. */
  origem: string | null;
  /** Lacre / número individual do fornecedor. */
  numeroOrigem: string | null;
  /** 'AAAA-MM-DD', como a coluna `date` devolve. */
  dataEntrada: string | null;
  observacoes: string | null;
};

type NumericBanco = string | number | null;

type LinhaPeca = {
  id: string;
  codigo: string;
  peca_mae_id: string | null;
  cor: string | null;
  textura: string | null;
  gramas: NumericBanco;
  comprimento_cm: NumericBanco;
  preco_compra: NumericBanco;
  preco_venda: NumericBanco;
  origem: string | null;
  numero_origem: string | null;
  data_entrada: string | null;
  observacoes: string | null;
};

const COLUNAS =
  "id, codigo, peca_mae_id, cor, textura, gramas, comprimento_cm, preco_compra, preco_venda, origem, numero_origem, data_entrada, observacoes";

function numero(valor: NumericBanco) {
  return valor === null ? null : Number(valor);
}

function paraPeca(linha: LinhaPeca): PecaExtensao {
  return {
    id: linha.id,
    codigo: linha.codigo,
    pecaMaeId: linha.peca_mae_id,
    cor: linha.cor,
    textura: linha.textura,
    gramas: numero(linha.gramas),
    comprimentoCm: numero(linha.comprimento_cm),
    precoCompra: numero(linha.preco_compra),
    precoVenda: numero(linha.preco_venda),
    origem: linha.origem,
    numeroOrigem: linha.numero_origem,
    dataEntrada: linha.data_entrada,
    observacoes: linha.observacoes,
  };
}

/**
 * Todas as peças. A ordem (natural, com as partes debaixo da mãe) e a
 * busca são feitas na tela: `order by codigo` no banco poria 1254 antes
 * de 999.
 */
export async function listarPecas(): Promise<PecaExtensao[]> {
  const { supabase } = await exigirSessao();

  const { data, error } = await supabase
    .from("pecas_extensao")
    .select(COLUNAS);

  if (error) {
    throw new Error(`Não foi possível carregar as peças: ${error.message}`);
  }

  return ((data ?? []) as LinhaPeca[]).map(paraPeca);
}

/** Uma peça, ou null se não existe. */
export async function obterPeca(id: string): Promise<PecaExtensao | null> {
  const { supabase } = await exigirSessao();

  const { data, error } = await supabase
    .from("pecas_extensao")
    .select(COLUNAS)
    .eq("id", id)
    .maybeSingle();

  if (error) {
    // id que não é uuid chega como 22P02: é o mesmo que não existir.
    if (error.code === "22P02") return null;

    throw new Error(`Não foi possível carregar a peça: ${error.message}`);
  }

  return data ? paraPeca(data as LinhaPeca) : null;
}

/**
 * Se a peça foi desmembrada — existe parte apontando para ela. É
 * consulta, não coluna (ver 018).
 */
export async function pecaTemFilhas(id: string): Promise<boolean> {
  const { supabase } = await exigirSessao();

  const { data, error } = await supabase
    .from("pecas_extensao")
    .select("id")
    .eq("peca_mae_id", id)
    .limit(1);

  if (error) {
    throw new Error(`Não foi possível conferir as partes: ${error.message}`);
  }

  return (data ?? []).length > 0;
}

/**
 * Id e código de TODAS as peças, para `encontrarCodigoDuplicado`: o
 * índice da 018 é total, então nenhuma fica de fora.
 */
export async function listarCodigos(): Promise<PecaIdentificavel[]> {
  const { supabase } = await exigirSessao();

  const { data, error } = await supabase
    .from("pecas_extensao")
    .select("id, codigo");

  if (error) {
    throw new Error(`Não foi possível conferir os códigos: ${error.message}`);
  }

  return (data ?? []) as PecaIdentificavel[];
}

/** Cores, texturas e origens já gravadas, para os `<datalist>` do formulário. */
export async function listarSugestoes(): Promise<{
  cores: string[];
  texturas: string[];
  origens: string[];
}> {
  const { supabase } = await exigirSessao();

  const { data, error } = await supabase
    .from("pecas_extensao")
    .select("cor, textura, origem");

  if (error) {
    throw new Error(`Não foi possível carregar as sugestões: ${error.message}`);
  }

  const linhas = (data ?? []) as {
    cor: string | null;
    textura: string | null;
    origem: string | null;
  }[];

  return {
    cores: valoresDistintos(linhas.map((linha) => linha.cor)),
    texturas: valoresDistintos(linhas.map((linha) => linha.textura)),
    origens: valoresDistintos(linhas.map((linha) => linha.origem)),
  };
}

/** As partes de uma peça desmembrada — só o primeiro nível. */
export async function listarPartes(maeId: string): Promise<PecaExtensao[]> {
  const { supabase } = await exigirSessao();

  const { data, error } = await supabase
    .from("pecas_extensao")
    .select(COLUNAS)
    .eq("peca_mae_id", maeId);

  if (error) {
    throw new Error(`Não foi possível carregar as partes: ${error.message}`);
  }

  return ((data ?? []) as LinhaPeca[]).map(paraPeca);
}

/**
 * Se alguma destas peças também foi desmembrada. É o que impede o
 * Desfazer da mãe: apagar a parte deixaria as partes dela sem mãe, e o
 * `on delete restrict` da 018 recusaria de qualquer jeito.
 */
export async function algumaTemFilhas(ids: readonly string[]): Promise<boolean> {
  if (ids.length === 0) return false;

  const { supabase } = await exigirSessao();

  const { data, error } = await supabase
    .from("pecas_extensao")
    .select("id")
    .in("peca_mae_id", [...ids])
    .limit(1);

  if (error) {
    throw new Error(`Não foi possível conferir as partes: ${error.message}`);
  }

  return (data ?? []).length > 0;
}
