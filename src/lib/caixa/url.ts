import { mesAtual, mesValido } from "@/lib/caixa/mes";
import type { StatusLancamento, TipoLancamento } from "@/lib/caixa/schema";
import type { VisaoCaixa } from "@/lib/caixa/visao";
import { linkRelatorio } from "@/lib/relatorio/url";

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

/** Os filtros na forma de query. Filtro no padrão não vai na URL. */
function consulta({ mes, tipo, status, visao }: FiltrosCaixa) {
  const busca = new URLSearchParams({ mes });

  if (tipo !== "todos") busca.set("tipo", tipo);
  if (status !== "todos") busca.set("status", status);
  if (visao !== "caixa") busca.set("visao", visao);

  return busca.toString();
}

/** Link para a lista com estes filtros. */
export function linkCaixa(filtros: FiltrosCaixa) {
  return `/caixa?${consulta(filtros)}`;
}

/**
 * Os filtros do Caixa que vieram na busca de outra tela (A receber), ou
 * null se não veio nenhum — aberta direto, sem saber de onde.
 */
export function filtrosNaBusca(params: Bruto): FiltrosCaixa | null {
  const algum = ["mes", "tipo", "status", "visao"].some(
    (chave) => typeof params[chave] === "string",
  );

  return algum ? lerFiltros(params) : null;
}

/** O Caixa como estava quando ela saiu dele; sem filtros, o padrão. */
export function voltaCaixa(params: Bruto) {
  const filtros = filtrosNaBusca(params);

  return filtros ? linkCaixa(filtros) : "/caixa";
}

/**
 * A receber, levando os filtros do Caixa de onde foi aberto: é com eles
 * que o Voltar de lá devolve a visão e o mês.
 */
export function linkPendentes(filtros: FiltrosCaixa | null) {
  return filtros ? `/caixa/pendentes?${consulta(filtros)}` : "/caixa/pendentes";
}

/**
 * Novo lançamento. `origem` é o link da tela de onde ela saiu — vai num
 * parâmetro só porque `tipo` já é do formulário e colidiria com o filtro.
 */
export function linkNovoLancamento(tipo: "entrada" | "saida", origem: string) {
  return `/caixa/novo?${new URLSearchParams({ tipo, origem })}`;
}

/** Edição do lançamento, lembrando de onde foi aberta. */
export function linkEditarLancamento(id: string, origem?: string) {
  return origem
    ? `/caixa/${id}/editar?${new URLSearchParams({ origem })}`
    : `/caixa/${id}/editar`;
}

export type Volta = { href: string; rotulo: string };

/**
 * O Voltar de novo e editar lançamento. A `origem` vem da URL e nunca é
 * usada como href: ela só escolhe entre as telas do Caixa que abrem o
 * lançamento, e o link é remontado aqui, com os filtros relidos. Sem
 * origem, ou com qualquer outra coisa, cai em `semOrigem` — o /caixa
 * padrão, a não ser que a tela tenha um destino melhor (o Cancelar da
 * edição volta ao mês do lançamento).
 *
 * É a regra única de saída dessas telas: o Voltar e o Cancelar usam
 * esta função, para os dois botões levarem ao mesmo lugar.
 */
export function voltaDaOrigem(
  origem: string | string[] | undefined,
  semOrigem = "/caixa",
): Volta {
  if (typeof origem === "string" && /^\/(?!\/)/.test(origem)) {
    const url = new URL(origem, "http://essenza.invalid");
    const params = Object.fromEntries(url.searchParams);

    switch (url.pathname) {
      case "/caixa":
        return { href: voltaCaixa(params), rotulo: "Caixa" };
      case "/caixa/pendentes":
        return { href: linkPendentes(filtrosNaBusca(params)), rotulo: "A receber" };
      case "/caixa/relatorio":
        return { href: linkRelatorio(lerFiltros(params).mes), rotulo: "Relatório" };
    }
  }

  return { href: semOrigem, rotulo: "Caixa" };
}
