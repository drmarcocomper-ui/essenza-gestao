import { emCentavos, INSTITUICOES, type Instituicao } from "@/lib/atendimentos/conta";
import { normalizar } from "@/lib/busca";
import type { StatusLancamento, TipoLancamento } from "@/lib/caixa/schema";
import {
  exigeTitularidade,
  titularidadeFixa,
  type TitularidadeConta,
} from "@/lib/titularidade";

/**
 * O relatório do mês para a contadora (carnê-leão da PF): entradas
 * separadas por conta, saídas por grupo. Tudo aqui é puro — quem busca
 * no banco é `listarRelatorioMes`, em `@/lib/caixa/consultas`.
 */

/** Um lançamento do mês, com o que o relatório precisa ler. */
export type LancamentoRelatorio = {
  id: string;
  tipo: TipoLancamento;
  status: StatusLancamento;
  data_competencia: string;
  data_caixa: string | null;
  data_prevista: string | null;
  categoria: string;
  descricao: string;
  instituicao: string | null;
  titularidade: string | null;
  forma_pagamento: string | null;
  parcelamento: string | null;
  // numeric no banco chega como número JSON, não string.
  valor: number;
  cliente: { nome: string } | null;
};

// ---------------------------------------------------------------------
// Entradas
// ---------------------------------------------------------------------

export const CONTAS_ENTRADA = [
  "PJ SumUp",
  "PJ Nubank",
  "PF Nubank",
  "PF PicPay",
  "Dinheiro",
  "Sem PF/PJ",
] as const;

export type ContaEntrada = (typeof CONTAS_ENTRADA)[number];

/**
 * Para onde vai uma entrada:
 * - uma das contas, quando já caiu (Pago);
 * - "Previsto a receber", quando ainda não caiu — não soma em nada;
 * - "Ignorada", a cortesia de valor zero, que não é dinheiro.
 */
export type DestinoEntrada = ContaEntrada | "Previsto a receber" | "Ignorada";

/**
 * A instituição digitada, na grafia da lista fechada. No Caixa ela é
 * texto livre: " sumup " e "SumUp" são a mesma maquininha. Fora da
 * lista, null.
 */
export function instituicaoConhecida(
  instituicao: string | null,
): Instituicao | null {
  const alvo = normalizar(instituicao);

  if (!alvo) return null;

  return INSTITUICOES.find((nome) => normalizar(nome) === alvo) ?? null;
}

/**
 * PF ou PJ pela regra central de `@/lib/titularidade`: a instituição
 * que já determina (SumUp → PJ, PicPay → PF) ganha do que está gravado;
 * no Nubank vale o que foi gravado; no resto, null.
 */
function titularidadeDaEntrada(
  instituicao: Instituicao,
  gravada: string | null,
): TitularidadeConta | null {
  const fixa = titularidadeFixa(instituicao);

  if (fixa) return fixa;

  if (!exigeTitularidade(instituicao)) return null;

  return gravada === "PF" || gravada === "PJ" ? gravada : null;
}

function ehCortesia(lancamento: LancamentoRelatorio) {
  return (
    lancamento.forma_pagamento === "Cortesia" ||
    instituicaoConhecida(lancamento.instituicao) === "Cortesia"
  );
}

export function classificarEntrada(
  lancamento: LancamentoRelatorio,
): DestinoEntrada {
  if (lancamento.status === "Pendente") return "Previsto a receber";

  if (ehCortesia(lancamento)) {
    return emCentavos(Number(lancamento.valor)) === 0 ? "Ignorada" : "Sem PF/PJ";
  }

  const instituicao = instituicaoConhecida(lancamento.instituicao);

  if (instituicao === "Dinheiro") return "Dinheiro";

  // Instituição nula, desconhecida ou Terceiro: não dá para dizer de
  // qual conta é o dinheiro.
  if (!instituicao || instituicao === "Terceiro") return "Sem PF/PJ";

  const titularidade = titularidadeDaEntrada(
    instituicao,
    lancamento.titularidade,
  );

  if (!titularidade) return "Sem PF/PJ";

  const conta = `${titularidade} ${instituicao}`;

  return (CONTAS_ENTRADA as readonly string[]).includes(conta)
    ? (conta as ContaEntrada)
    : "Sem PF/PJ";
}

// ---------------------------------------------------------------------
// Saídas
// ---------------------------------------------------------------------

/** Os grupos que somam no total de despesas, na ordem da tela. */
export const GRUPOS_DESPESA = [
  "Aluguel",
  "Luz",
  "Condomínio",
  "Boletos de produtos",
  "DAS MEI",
  "INSS",
  "Outras",
] as const;

export type GrupoDespesa = (typeof GRUPOS_DESPESA)[number];

/** Participação nos lucros: dinheiro dela, não despesa do salão. */
export const RETIRADA = "Retirada";

export type GrupoSaida = GrupoDespesa | typeof RETIRADA;

/** Os fixos do mês: faltar um deles vira pendência. */
export const GRUPOS_FIXOS: readonly GrupoDespesa[] = [
  "Aluguel",
  "Condomínio",
  "Luz",
  "DAS MEI",
  "INSS",
];

/** A palavra inteira, não pedaço de outra: "luz" não casa "Luzia". */
function temPalavra(texto: string, palavra: string) {
  return new RegExp(`(^|[^a-z0-9])${palavra}([^a-z0-9]|$)`).test(texto);
}

const PRODUTOS = ["boleto", "loreal", "l'oreal", "wella", "kerastase", "produtos"];

/**
 * O grupo da saída. A categoria só decide a retirada; o resto sai da
 * descrição normalizada, na ordem de prioridade abaixo — a primeira que
 * casar ganha.
 */
export function classificarSaida(
  lancamento: Pick<LancamentoRelatorio, "categoria" | "descricao">,
): GrupoSaida {
  if (normalizar(lancamento.categoria) === normalizar("Participação Lucros")) {
    return RETIRADA;
  }

  const texto = normalizar(lancamento.descricao);

  if (texto.includes("aluguel")) return "Aluguel";
  if (texto.includes("condom")) return "Condomínio";
  if (
    texto.includes("edp") ||
    texto.includes("energia") ||
    temPalavra(texto, "luz")
  ) {
    return "Luz";
  }
  // "das" solto é preposição ("boleto das tintas"): só conta sozinho.
  if (
    texto.includes("das mei") ||
    texto.includes("simples nacional") ||
    texto === "das" ||
    texto === "imposto"
  ) {
    return "DAS MEI";
  }
  if (texto.includes("inss")) return "INSS";
  if (PRODUTOS.some((palavra) => texto.includes(palavra))) {
    return "Boletos de produtos";
  }

  return "Outras";
}
