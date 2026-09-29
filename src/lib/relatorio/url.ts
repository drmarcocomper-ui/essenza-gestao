/** A tela do relatório, no mês pedido. Mesmo `?mes=AAAA-MM` do Caixa. */
export function linkRelatorio(mes: string) {
  return `/caixa/relatorio?mes=${mes}`;
}
