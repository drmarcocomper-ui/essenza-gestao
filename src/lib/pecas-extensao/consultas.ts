import { exigirSessao } from "@/lib/auth";
import type {
  ContaDaPeca,
  PecaIdentificavel,
} from "@/lib/pecas-extensao/regras";
import {
  compararCodigos,
  idsDesmembradas,
  pecaVendavelNaConta,
  valoresDistintos,
} from "@/lib/pecas-extensao/regras";

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

// ---------------------------------------------------------------------
// A peça na conta (020)
// ---------------------------------------------------------------------

type LinhaItemDaPeca = {
  peca_extensao_id: string;
  atendimento_id: string;
  atendimentos: {
    data: string;
    cliente_id: string;
    clientes: { nome: string } | null;
    lancamentos: { id: string }[];
  } | null;
};

const COLUNAS_CONTA =
  "peca_extensao_id, atendimento_id, atendimentos(data, cliente_id, clientes(nome), lancamentos(id))";

/**
 * A conta de cada peça que já é item de algum atendimento, por id da
 * peça. `ids` limita às peças pedidas; sem ele, vêm todas.
 *
 * Conta fechada é "existe lançamento com este atendimento_id", como no
 * resto do app. Uma peça, um item (índice único da 020): cada peça
 * aparece no máximo uma vez.
 */
export async function listarContasDasPecas(
  ids?: readonly string[],
): Promise<Record<string, ContaDaPeca>> {
  if (ids && ids.length === 0) return {};

  const { supabase } = await exigirSessao();

  let consulta = supabase
    .from("atendimento_itens")
    .select(COLUNAS_CONTA)
    .not("peca_extensao_id", "is", null);

  if (ids) consulta = consulta.in("peca_extensao_id", [...ids]);

  const { data, error } = await consulta;

  if (error) {
    throw new Error(`Não foi possível conferir as contas das peças: ${error.message}`);
  }

  const contas: Record<string, ContaDaPeca> = {};

  for (const linha of (data ?? []) as unknown as LinhaItemDaPeca[]) {
    const atendimento = linha.atendimentos;

    contas[linha.peca_extensao_id] = {
      atendimentoId: linha.atendimento_id,
      clienteId: atendimento?.cliente_id ?? "",
      clienteNome: atendimento?.clientes?.nome ?? "cliente",
      data: atendimento?.data ?? "",
      fechada: (atendimento?.lancamentos.length ?? 0) > 0,
    };
  }

  return contas;
}

/** A conta em que a peça entrou, ou null. */
export async function obterContaDaPeca(id: string): Promise<ContaDaPeca | null> {
  const contas = await listarContasDasPecas([id]);

  return contas[id] ?? null;
}

/** Peça como a conta a oferece: o que ela precisa para reconhecer a peça. */
export type PecaVendavel = {
  id: string;
  codigo: string;
  cor: string | null;
  textura: string | null;
  gramas: number | null;
  comprimentoCm: number | null;
  /** null = sem preço de venda: ela digita o valor na conta. */
  precoVenda: number | null;
};

/**
 * As peças que podem entrar na conta deste atendimento
 * (`pecaVendavelNaConta`): inteiras e livres, ou já nesta conta. Em
 * ordem natural de código.
 *
 * Lê as duas tabelas inteiras: "tem partes" e "tem item" são consultas
 * sobre todas as peças, e são poucas.
 */
export async function listarPecasVendaveis(
  atendimentoId: string,
): Promise<PecaVendavel[]> {
  const { supabase } = await exigirSessao();

  const [pecas, itens] = await Promise.all([
    supabase
      .from("pecas_extensao")
      .select("id, codigo, peca_mae_id, cor, textura, gramas, comprimento_cm, preco_venda"),
    supabase
      .from("atendimento_itens")
      .select("peca_extensao_id, atendimento_id")
      .not("peca_extensao_id", "is", null),
  ]);

  const erro = pecas.error ?? itens.error;

  if (erro) {
    throw new Error(`Não foi possível carregar as peças: ${erro.message}`);
  }

  const linhas = (pecas.data ?? []) as (Pick<
    LinhaPeca,
    "id" | "codigo" | "peca_mae_id" | "cor" | "textura" | "gramas" | "comprimento_cm" | "preco_venda"
  >)[];

  const desmembradas = idsDesmembradas(
    linhas.map((linha) => ({ pecaMaeId: linha.peca_mae_id })),
  );

  const atendimentoDoItem = new Map(
    ((itens.data ?? []) as { peca_extensao_id: string; atendimento_id: string }[]).map(
      (item) => [item.peca_extensao_id, item.atendimento_id],
    ),
  );

  return linhas
    .filter((linha) =>
      pecaVendavelNaConta(
        {
          temFilhas: desmembradas.has(linha.id),
          atendimentoDoItem: atendimentoDoItem.get(linha.id) ?? null,
        },
        atendimentoId,
      ),
    )
    .map((linha) => ({
      id: linha.id,
      codigo: linha.codigo,
      cor: linha.cor,
      textura: linha.textura,
      gramas: numero(linha.gramas),
      comprimentoCm: numero(linha.comprimento_cm),
      precoVenda: numero(linha.preco_venda),
    }))
    .sort((a, b) => compararCodigos(a.codigo, b.codigo));
}

/** O que o fechamento da conta relê de cada peça escolhida. */
export type PecaParaConta = {
  id: string;
  codigo: string;
  temFilhas: boolean;
  /** Atendimento do item que já aponta para a peça; null se nenhum. */
  atendimentoDoItem: string | null;
};

/**
 * Relê, no servidor, as peças que a tela mandou na conta. Peça que não
 * existe (ou id que não é uuid) simplesmente não volta.
 */
export async function lerPecasParaConta(
  ids: readonly string[],
): Promise<PecaParaConta[]> {
  if (ids.length === 0) return [];

  const { supabase } = await exigirSessao();
  const lista = [...ids];

  const [pecas, filhas, itens] = await Promise.all([
    supabase.from("pecas_extensao").select("id, codigo").in("id", lista),
    supabase.from("pecas_extensao").select("peca_mae_id").in("peca_mae_id", lista),
    supabase
      .from("atendimento_itens")
      .select("peca_extensao_id, atendimento_id")
      .in("peca_extensao_id", lista),
  ]);

  const erro = pecas.error ?? filhas.error ?? itens.error;

  if (erro) {
    throw new Error(`Não foi possível conferir as peças: ${erro.message}`);
  }

  const maes = new Set(
    ((filhas.data ?? []) as { peca_mae_id: string }[]).map((f) => f.peca_mae_id),
  );

  const atendimentoDoItem = new Map(
    ((itens.data ?? []) as { peca_extensao_id: string; atendimento_id: string }[]).map(
      (item) => [item.peca_extensao_id, item.atendimento_id],
    ),
  );

  return ((pecas.data ?? []) as { id: string; codigo: string }[]).map((peca) => ({
    id: peca.id,
    codigo: peca.codigo,
    temFilhas: maes.has(peca.id),
    atendimentoDoItem: atendimentoDoItem.get(peca.id) ?? null,
  }));
}
