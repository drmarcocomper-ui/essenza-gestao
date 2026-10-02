/**
 * Regras das compras de frascos (021) que não dependem do banco.
 */

export const MENSAGEM_PRODUTO_REPETIDO =
  "Este produto já está nesta compra, ajuste a quantidade.";

/**
 * Índices das linhas que repetem um produto de uma linha anterior. A
 * primeira ocorrência fica limpa: é nela que ela ajusta a quantidade.
 * Linha sem produto escolhido não repete nada.
 *
 * O banco recusa o mesmo (uq_compra_itens_compra_produto); isto é o que
 * deixa a tela avisar antes.
 */
export function indicesProdutoRepetido(
  produtoIds: readonly string[],
): Set<number> {
  const vistos = new Set<string>();
  const repetidos = new Set<number>();

  produtoIds.forEach((id, indice) => {
    if (!id) return;

    if (vistos.has(id)) repetidos.add(indice);
    vistos.add(id);
  });

  return repetidos;
}

/**
 * Total da compra = soma de quantidade × custo, em centavos inteiros —
 * somar reais em ponto flutuante deixaria R$ 0,01 pelo caminho.
 */
export function totalDaCompra(
  itens: readonly { quantidade: number; custoUnitario: number }[],
) {
  const centavos = itens.reduce(
    (soma, item) => soma + Math.round(item.quantidade * item.custoUnitario * 100),
    0,
  );

  return centavos / 100;
}
