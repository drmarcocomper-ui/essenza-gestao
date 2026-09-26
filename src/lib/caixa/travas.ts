import type { CampoLancamento, DadosLancamento } from "@/lib/caixa/schema";

/**
 * Travas do lançamento que nasceu do fechamento de conta.
 *
 * Linha com `atendimento_id` preenchido é a conta do atendimento — "existe
 * lançamento com este atendimento_id" é a própria definição de conta
 * fechada. Apagar uma linha dessas pelo Caixa reabre a conta sem ninguém
 * pedir (se era a última) ou descola a soma dos lançamentos da soma dos
 * itens (se era uma de várias); mudar o valor faz o mesmo. O caminho para
 * mexer no dinheiro da conta é reabri-la na tela do atendimento.
 *
 * Lançamento manual (`atendimento_id` nulo) não tem trava nenhuma aqui.
 *
 * A tela usa estas regras para travar os campos e esconder o excluir; a
 * action, para recusar. As duas leem daqui.
 */

export type LancamentoTravavel = { atendimento_id: string | null };

/** Se o lançamento é de conta de atendimento. */
export function lancamentoDaConta(lancamento: LancamentoTravavel) {
  return lancamento.atendimento_id !== null;
}

/**
 * O que não muda pelo Caixa num lançamento de conta.
 *
 * - `valor`: a soma das linhas tem de fechar com a soma dos itens;
 * - `tipo`: conta é sempre Entrada;
 * - `data_competencia`: é a data do atendimento (trava de 25/09/2026);
 * - `parcelamento`: "2/3" diz qual parcela da conta a linha é;
 * - `cliente_id` e `fornecedor`: a contraparte. `fornecedor` é nulo em
 *   toda Entrada (`chk_lancamento_contraparte`, 002), então travar o
 *   `tipo` já o trava; está na lista para a regra não depender disso.
 *
 * `atendimento_id` também é travado, mas por construção: o formulário
 * não tem esse campo e ele nunca entra no update.
 */
export const CAMPOS_TRAVADOS_CONTA = [
  "valor",
  "tipo",
  "data_competencia",
  "parcelamento",
  "cliente_id",
  "fornecedor",
] as const satisfies readonly CampoLancamento[];

/**
 * O que continua editável num lançamento de conta. É também a lista
 * branca do update: nada fora dela é gravado nessas linhas.
 *
 * `status` e `data_caixa` são os da confirmação de recebimento, que segue
 * como sempre. `data_prevista` é previsão, informativa: não entra em soma
 * nenhuma, e ela pode ajustar quando a maquininha avisar outro dia.
 */
export const CAMPOS_EDITAVEIS_CONTA = [
  "instituicao",
  "titularidade",
  "forma_pagamento",
  "categoria",
  "descricao",
  "observacoes",
  "status",
  "data_caixa",
  "data_prevista",
] as const satisfies readonly CampoLancamento[];

export type CampoTravadoConta = (typeof CAMPOS_TRAVADOS_CONTA)[number];
export type CampoEditavelConta = (typeof CAMPOS_EDITAVEIS_CONTA)[number];

/**
 * Todas as parcelas da conta têm a competência do dia em que o serviço
 * foi prestado. Trocar a de uma só pelo Caixa separa a parcela da própria
 * venda — em 09/2026 duas linhas ficaram assim.
 */
export const MENSAGEM_COMPETENCIA_TRAVADA =
  "Parcela de atendimento: a competência segue a data do atendimento.";

export const MENSAGEM_CAMPO_TRAVADO_CONTA =
  "Entrada da conta de um atendimento: para mudar isto, reabra a conta.";

/** O topo do formulário quando a action recusa uma trava. */
export const MENSAGEM_REABRA_A_CONTA =
  "Valor, tipo, competência, parcela e cliente de uma entrada de conta não mudam pelo Caixa. Para isso, reabra a conta no atendimento.";

export const MENSAGEM_EXCLUSAO_CONTA =
  "Esta entrada é da conta de um atendimento e não pode ser excluída aqui. Para excluir, reabra a conta.";

export const MENSAGEM_CONTA_JA_ABERTA = "Esta conta já está aberta.";

/** A frase de cada campo travado, na tela e na recusa da action. */
export function mensagemCampoTravado(campo: CampoTravadoConta) {
  return campo === "data_competencia"
    ? MENSAGEM_COMPETENCIA_TRAVADA
    : MENSAGEM_CAMPO_TRAVADO_CONTA;
}

/** Se a exclusão está proibida. */
export function exclusaoTravada(lancamento: LancamentoTravavel) {
  return lancamentoDaConta(lancamento);
}

/** Se o campo é somente leitura neste lançamento. */
export function campoTravado(
  lancamento: LancamentoTravavel,
  campo: CampoLancamento,
) {
  return (
    lancamentoDaConta(lancamento) &&
    (CAMPOS_TRAVADOS_CONTA as readonly string[]).includes(campo)
  );
}

type Gravado = LancamentoTravavel &
  Pick<
    DadosLancamento,
    | "valor"
    | "tipo"
    | "data_competencia"
    | "parcelamento"
    | "cliente_id"
    | "fornecedor"
  >;

/**
 * Valor em centavos: `numeric` chega do banco como número JSON, e o que
 * a tela manda passa pela máscara. 180 e 180.00 são o mesmo dinheiro.
 */
function centavos(valor: number) {
  return Math.round(valor * 100);
}

function igual(campo: CampoTravadoConta, gravado: Gravado, novo: DadosLancamento) {
  if (campo === "valor") return centavos(gravado.valor) === centavos(novo.valor);

  // Texto vazio e nulo são a mesma ausência: o schema do Caixa já
  // converte "" em null, e a planilha deixou os dois no banco.
  return (gravado[campo] || null) === (novo[campo] || null);
}

/**
 * Os campos travados que o envio tenta mudar, na ordem da lista. Vazio
 * quando o lançamento é manual ou quando tudo que é travado veio igual
 * ao gravado — reenviar o mesmo valor não é mudança.
 */
export function camposTravadosAlterados(
  gravado: Gravado,
  novo: DadosLancamento,
): CampoTravadoConta[] {
  if (!lancamentoDaConta(gravado)) return [];

  return CAMPOS_TRAVADOS_CONTA.filter((campo) => !igual(campo, gravado, novo));
}

/**
 * O que vai para o update. Lançamento manual grava tudo, como sempre.
 * Lançamento de conta grava só o que é editável: o que é travado não
 * entra, nem igual — nem o que deriva dele (`mes_competencia`).
 */
export function dadosParaAtualizar(
  gravado: LancamentoTravavel,
  novo: DadosLancamento,
): Partial<DadosLancamento> {
  if (!lancamentoDaConta(gravado)) return novo;

  return Object.fromEntries(
    CAMPOS_EDITAVEIS_CONTA.map((campo) => [campo, novo[campo]]),
  ) as Pick<DadosLancamento, CampoEditavelConta>;
}
