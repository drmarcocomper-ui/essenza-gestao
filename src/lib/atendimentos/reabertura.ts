import { FORMA_POR_MODALIDADE } from "@/lib/atendimentos/conta";

/**
 * Reabrir a conta: apagar os lançamentos dela para fechar de novo.
 *
 * Conta fechada é "existe lançamento com este atendimento_id", então
 * reabrir é apagar esses lançamentos — só eles. Os itens e o atendimento
 * ficam, e o fechamento existente volta a funcionar sem mudança.
 *
 * O que se perde e ela precisa saber antes de confirmar: as parcelas de
 * crédito já confirmadas como recebidas. O fechamento grava crédito
 * sempre Pendente, então a confirmação dessas parcelas terá de ser feita
 * de novo em "A receber". Débito, Pix e dinheiro nascem Pagos no
 * fechamento e não pedem nada.
 */

export type LinhaReabertura = {
  status: "Pago" | "Pendente";
  formaPagamento: string | null;
};

export type ResumoReabertura = {
  /** Quantos lançamentos o delete vai apagar. */
  lancamentos: number;
  /** Parcelas de crédito já confirmadas, que voltam a Pendente ao fechar. */
  confirmadas: number;
};

export function resumoReabertura(
  linhas: readonly LinhaReabertura[],
): ResumoReabertura {
  return {
    lancamentos: linhas.length,
    confirmadas: linhas.filter(
      (linha) =>
        linha.status === "Pago" &&
        linha.formaPagamento === FORMA_POR_MODALIDADE.credito,
    ).length,
  };
}

function plural(n: number, um: string, varios: string) {
  return n === 1 ? um : varios;
}

/** O texto da confirmação, em frases separadas. */
export function textoReabertura({ lancamentos, confirmadas }: ResumoReabertura) {
  const frases = [
    `Reabrir a conta apaga ${lancamentos} ${plural(
      lancamentos,
      "lançamento",
      "lançamentos",
    )} do Caixa. Os itens ficam, e a conta pode ser fechada de novo.`,
  ];

  if (confirmadas > 0) {
    frases.push(
      `${confirmadas} ${plural(
        confirmadas,
        "parcela já confirmada como recebida terá",
        "parcelas já confirmadas como recebidas terão",
      )} de ser ${plural(confirmadas, "confirmada", "confirmadas")} de novo em A receber.`,
    );
  }

  return frases;
}
