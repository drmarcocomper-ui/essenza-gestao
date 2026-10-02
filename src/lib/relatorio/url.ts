/** A tela do relatório, no mês pedido. Mesmo `?mes=AAAA-MM` do Caixa. */
export function linkRelatorio(mes: string) {
  return `/caixa/relatorio?mes=${mes}`;
}

/** O CSV do mesmo mês, para baixar. */
export function linkCsvRelatorio(mes: string) {
  return `/caixa/relatorio/csv?mes=${mes}`;
}

/** O CSV do ano do mês exibido: '2026-09' → ano 2026. */
export function linkCsvAnual(mes: string) {
  const ano = mes.slice(0, 4);

  return `/caixa/relatorio/csv-anual?ano=${ano}`;
}
