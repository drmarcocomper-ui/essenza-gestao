/** A tela do relatório, no mês pedido. Mesmo `?mes=AAAA-MM` do Caixa. */
export function linkRelatorio(mes: string) {
  return `/caixa/relatorio?mes=${mes}`;
}

/** O CSV do mesmo mês, para baixar. */
export function linkCsvRelatorio(mes: string) {
  return `/caixa/relatorio/csv?mes=${mes}`;
}
