import { mesAtual, mesValido } from "@/lib/caixa/mes";
import type { StatusLancamento, TipoLancamento } from "@/lib/caixa/schema";
import type { VisaoCaixa } from "@/lib/caixa/visao";

/**
 * O estado da lista do caixa mora na URL: mês, tipo, status e visão. Assim o
 * voltar do navegador funciona, e a tela recarregada volta igual.
 *
 * Na URL os valores são slugs sem acento ('saida'); no banco são os
 * rótulos com acento ('Saída'). A conversão acontece só aqui.
 */

export type SlugTipo = "todos" | "entrada" | "saida";
export type SlugStatus = "todos" | "pago" | "pendente";

export type FiltrosCaixa = {
  mes: string;
  tipo: SlugTipo;
  status: SlugStatus;
  visao: VisaoCaixa;
};

const TIPO_POR_SLUG: Record<SlugTipo, TipoLancamento | "Todos"> = {
  todos: "Todos",
  entrada: "Entrada",
  saida: "Saída",
};

const STATUS_POR_SLUG: Record<SlugStatus, StatusLancamento | "Todos"> = {
  todos: "Todos",
  pago: "Pago",
  pendente: "Pendente",
};

export function tipoDoSlug(slug: SlugTipo) {
  return TIPO_POR_SLUG[slug];
}

export function statusDoSlug(slug: SlugStatus) {
  return STATUS_POR_SLUG[slug];
}

type Bruto = Record<string, string | string[] | undefined>;

function slug<T extends string>(
  valor: string | string[] | undefined,
  aceitos: readonly T[],
  padrao: T,
): T {
  return typeof valor === "string" && (aceitos as readonly string[]).includes(valor)
    ? (valor as T)
    : padrao;
}

/** searchParams → filtros. O que vier torto cai no padrão, sem erro. */
export function lerFiltros(params: Bruto): FiltrosCaixa {
  return {
    mes: mesValido(params.mes) ? params.mes : mesAtual(),
    tipo: slug(params.tipo, ["todos", "entrada", "saida"] as const, "todos"),
    status: slug(
      params.status,
      ["todos", "pago", "pendente"] as const,
      "todos",
    ),
    visao: slug(params.visao, ["caixa", "competencia"] as const, "caixa"),
  };
}

/** Link para a lista com estes filtros. Filtro no padrão não vai na URL. */
export function linkCaixa({ mes, tipo, status, visao }: FiltrosCaixa) {
  const busca = new URLSearchParams({ mes });

  if (tipo !== "todos") busca.set("tipo", tipo);
  if (status !== "todos") busca.set("status", status);
  if (visao !== "caixa") busca.set("visao", visao);

  return `/caixa?${busca.toString()}`;
}
