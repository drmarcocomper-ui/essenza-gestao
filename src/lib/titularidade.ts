import type { Instituicao } from "@/lib/atendimentos/conta";

/**
 * De qual conta é o dinheiro: PF (dela) ou PJ (do CNPJ).
 *
 * Regra única para o fechamento da conta e para o Caixa. Mora fora de
 * `atendimentos/conta.ts` porque o schema do Caixa também a usa, e
 * `conta.ts` já importa do Caixa — o import de tipo acima some na
 * compilação e não fecha ciclo.
 */

/**
 * As duas que ela escolhe na tela. A coluna `titularidade` aceita um
 * terceiro valor, "Terceiro" (002), que não é opção aqui: aquilo é o
 * titular da conta no histórico da planilha, não quem pagou.
 */
export const TITULARIDADES_CONTA = ["PF", "PJ"] as const;

export type TitularidadeConta = (typeof TITULARIDADES_CONTA)[number];

/**
 * Instituições onde a mesma marca tem as duas contas, a dela e a do
 * CNPJ. Sem a resposta, o lançamento não diz de qual conta é o dinheiro.
 */
const COM_DUAS_CONTAS: readonly string[] = ["Nubank"];

/**
 * Titularidade conhecida, não perguntada.
 *
 * - SumUp é a maquininha do CNPJ;
 * - PicPay é sempre a conta dela (decisão de 28/09/2026).
 */
const TITULARIDADE_FIXA: Partial<Record<Instituicao, TitularidadeConta>> = {
  SumUp: "PJ",
  PicPay: "PF",
};

/** A titularidade que a instituição já determina, ou null. */
export function titularidadeFixa(instituicao: string): TitularidadeConta | null {
  return TITULARIDADE_FIXA[instituicao as Instituicao] ?? null;
}

/** Se a tela precisa perguntar PF ou PJ. */
export function exigeTitularidade(instituicao: string) {
  return COM_DUAS_CONTAS.includes(instituicao);
}

/**
 * A titularidade que vai para o banco no fechamento da conta.
 *
 * Onde a tela não pergunta, grava null em vez de chutar: Dinheiro,
 * Terceiro e Cortesia não passam por conta bancária nenhuma.
 */
export function titularidadeDe(
  instituicao: string,
  escolhida: string | null,
): TitularidadeConta | null {
  const fixa = titularidadeFixa(instituicao);

  if (fixa) return fixa;

  if (!exigeTitularidade(instituicao)) return null;

  return escolhida === "PF" || escolhida === "PJ" ? escolhida : null;
}

/**
 * No Caixa, só o PicPay tem titularidade fixa.
 *
 * A SumUp fica de fora de propósito: no Caixa ela sempre aceitou
 * qualquer titularidade, e isso não mudou em 28/09/2026.
 */
const FIXA_NO_CAIXA: readonly Instituicao[] = ["PicPay"];

/**
 * A titularidade fixa no Caixa, onde a instituição é texto livre:
 * "picpay" e " PicPay " são o PicPay. Fora da lista, null — e a
 * titularidade segue a escolhida, como sempre.
 */
export function titularidadeFixaNoCaixa(
  instituicao: string | null,
): TitularidadeConta | null {
  const digitada = (instituicao ?? "").trim().toLowerCase();
  const achada = FIXA_NO_CAIXA.find(
    (nome) => nome.toLowerCase() === digitada,
  );

  return achada ? titularidadeFixa(achada) : null;
}
