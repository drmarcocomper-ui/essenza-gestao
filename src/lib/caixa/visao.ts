import { primeiroDia, ultimoDia } from "@/lib/caixa/mes";
import type { StatusLancamento, TipoLancamento } from "@/lib/caixa/schema";

/**
 * As duas formas de olhar o mês no caixa.
 *
 * - `caixa` (padrão): cada lançamento cai no mês em que o dinheiro entra
 *   ou sai. Venda de 23/09 em 3x no crédito aparece em outubro, novembro
 *   e dezembro — uma parcela em cada.
 * - `competencia`: o mês da venda, pela `data_competencia`. É o
 *   faturamento, como a tela sempre mostrou.
 */
export type VisaoCaixa = "caixa" | "competencia";

/** Por que a data de referência é aquela. Null quando o dinheiro já andou. */
export type MarcaCaixa = "Previsto" | "Pendente" | null;

type Datas = {
  status: StatusLancamento;
  data_competencia: string;
  data_caixa: string | null;
  data_prevista: string | null;
};

/**
 * O dia em que o dinheiro entra ou sai:
 *   Pago                     → `data_caixa` (o banco garante que existe,
 *                              `chk_lancamento_caixa` da 002);
 *   Pendente com previsão    → `data_prevista`;
 *   Pendente sem previsão    → `data_competencia`, na falta de coisa melhor.
 *
 * `filtroMesCaixa` é esta mesma regra escrita para o PostgREST. Mudou
 * aqui, muda lá.
 */
export function dataReferenciaCaixa(lancamento: Datas): string {
  if (lancamento.status === "Pago") {
    return lancamento.data_caixa ?? lancamento.data_competencia;
  }

  return lancamento.data_prevista ?? lancamento.data_competencia;
}

/** O selo da linha na visão Caixa: a data mostrada ainda não é dinheiro. */
export function marcaCaixa(lancamento: Datas): MarcaCaixa {
  if (lancamento.status === "Pago") return null;

  return lancamento.data_prevista ? "Previsto" : "Pendente";
}

/**
 * Filtro `or` do PostgREST que seleciona o mês pela data de referência:
 * Pago por `data_caixa`; Pendente por coalesce(data_prevista,
 * data_competencia). O coalesce vira dois ramos porque o PostgREST não
 * filtra por expressão.
 */
export function filtroMesCaixa(mes: string) {
  const entre = (coluna: string) =>
    `${coluna}.gte.${primeiroDia(mes)},${coluna}.lte.${ultimoDia(mes)}`;

  return [
    `and(status.eq.Pago,${entre("data_caixa")})`,
    `and(status.eq.Pendente,${entre("data_prevista")})`,
    `and(status.eq.Pendente,data_prevista.is.null,${entre("data_competencia")})`,
  ].join(",");
}

export type ResumoCaixa = {
  /** Status Pago: dinheiro que já entrou ou saiu. */
  recebido: number;
  pago: number;
  saldo: number;
  /** Status Pendente: o que ainda vai entrar ou sair neste mês. */
  aReceber: number;
  aPagar: number;
  saldoPrevisto: number;
};

type LinhaResumo = {
  tipo: TipoLancamento;
  status: StatusLancamento;
  valor: number;
};

/**
 * Totais da visão Caixa, sem misturar o que já andou com o que ainda vai
 * andar. Soma em centavos: 0,1 + 0,2 em ponto flutuante não dá 0,3.
 */
export function somarResumoCaixa(linhas: LinhaResumo[]): ResumoCaixa {
  const centavos = { recebido: 0, pago: 0, aReceber: 0, aPagar: 0 };

  for (const { tipo, status, valor } of linhas) {
    const valorCentavos = Math.round(Number(valor) * 100);
    const entrada = tipo === "Entrada";

    if (status === "Pago") {
      centavos[entrada ? "recebido" : "pago"] += valorCentavos;
    } else {
      centavos[entrada ? "aReceber" : "aPagar"] += valorCentavos;
    }
  }

  return {
    recebido: centavos.recebido / 100,
    pago: centavos.pago / 100,
    saldo: (centavos.recebido - centavos.pago) / 100,
    aReceber: centavos.aReceber / 100,
    aPagar: centavos.aPagar / 100,
    saldoPrevisto: (centavos.aReceber - centavos.aPagar) / 100,
  };
}
