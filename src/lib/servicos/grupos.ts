import { CATEGORIAS, ROTULOS_CATEGORIA, type CategoriaServico } from "./schema";

/**
 * O catálogo de serviços repartido em blocos por categoria, para as
 * telas que mostram os 24 serviços como chips.
 *
 * Vive aqui, e não dentro de uma tela, porque são duas: o registro do
 * atendimento (4A) e o fechamento da conta (4B) mostram o mesmo catálogo
 * e têm que reparti-lo do mesmo jeito. Dois agrupamentos diferentes
 * seriam a Kamylle procurando "Gloss" em lugares diferentes na mesma
 * cliente.
 *
 * É cálculo puro sobre a lista já carregada — sem Supabase e sem JSX —,
 * então a regra é testável sem banco e sem render.
 */

/**
 * Grupo dos serviços sem categoria. Chave vazia porque não existe valor
 * correspondente no banco: é a ausência dela.
 */
export const SEM_CATEGORIA = "";

/** O mínimo que o agrupamento precisa saber sobre um serviço. */
export type ServicoAgrupavel = {
  /** `servicos.categoria` cru: null e valor fora da lista são previstos. */
  categoria: string | null;
};

export type GrupoDeServicos<T> = {
  /** A categoria crua, ou `SEM_CATEGORIA`. */
  chave: string;
  /** O que ela lê no bloco. */
  rotulo: string;
  servicos: T[];
};

/**
 * Em qual bloco este serviço cai.
 *
 * Categoria fora da lista da aplicação — possível, porque a coluna não
 * tem `check` (012) — cai no grupo sem categoria em vez de sumir da
 * tela. Serviço invisível é serviço que ela não consegue cobrar.
 */
function chaveDeGrupo(categoria: string | null) {
  return categoria && CATEGORIAS.includes(categoria as CategoriaServico)
    ? categoria
    : SEM_CATEGORIA;
}

/**
 * Os serviços em até seis blocos: as cinco categorias da aplicação, na
 * ordem de `CATEGORIAS`, mais um para os sem categoria no fim.
 *
 * A ordem dos blocos é fixa, não alfabética nem por tamanho: ela decora
 * onde cada coisa está e toca sem ler. Bloco vazio não aparece — um
 * acordeão que abre para nada é toque perdido.
 *
 * Dentro de cada bloco a ordem é a que veio, que é o `order by nome` da
 * consulta.
 */
export function agruparPorCategoria<T extends ServicoAgrupavel>(
  servicos: readonly T[],
): GrupoDeServicos<T>[] {
  const grupos = [
    ...CATEGORIAS.map((categoria) => ({
      chave: categoria as string,
      rotulo: ROTULOS_CATEGORIA[categoria],
    })),
    { chave: SEM_CATEGORIA, rotulo: "Sem categoria" },
  ];

  return grupos
    .map((grupo) => ({
      ...grupo,
      servicos: servicos.filter(
        (servico) => chaveDeGrupo(servico.categoria) === grupo.chave,
      ),
    }))
    .filter((grupo) => grupo.servicos.length > 0);
}
