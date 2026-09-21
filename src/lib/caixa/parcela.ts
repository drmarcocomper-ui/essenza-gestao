/**
 * O rótulo de parcela de `lancamentos.parcelamento` ("1/3").
 *
 * A coluna é text livre, e o histórico importado da planilha tem linhas
 * com DATA ISO ali dentro ("2026-03-15"). Mostrar isso como "Parcela
 * 2026-03-15" seria a tela afirmando um parcelamento que não existe —
 * então só vale o que casa com `n/N`. O resto é tratado como sem parcela.
 */
const PADRAO_PARCELA = /^(\d+)\/(\d+)$/;

export type Parcela = { rotulo: string; numero: number; total: number };

/** A parcela do rótulo, ou null quando não é rótulo de parcela. */
export function lerParcela(valor: string | null | undefined): Parcela | null {
  const casamento = valor ? PADRAO_PARCELA.exec(valor) : null;

  if (!casamento) return null;

  return {
    rotulo: casamento[0],
    numero: Number(casamento[1]),
    total: Number(casamento[2]),
  };
}

/**
 * Ordem das linhas de uma conta: primeiro o que não é parcela, depois as
 * parcelas pelo número ("2/12" antes de "10/12", que em texto viria
 * depois), e o `id` desempata. A ordem que o banco devolve o embed não é
 * garantida, e a mesma conta não pode mudar de ordem entre dois acessos.
 */
export function compararPorParcela(
  a: { parcelamento: string | null; id: string },
  b: { parcelamento: string | null; id: string },
) {
  const pa = lerParcela(a.parcelamento);
  const pb = lerParcela(b.parcelamento);

  if (!pa !== !pb) return pa ? 1 : -1;

  if (pa && pb) {
    if (pa.numero !== pb.numero) return pa.numero - pb.numero;
    if (pa.total !== pb.total) return pa.total - pb.total;
  }

  return a.id < b.id ? -1 : a.id > b.id ? 1 : 0;
}
