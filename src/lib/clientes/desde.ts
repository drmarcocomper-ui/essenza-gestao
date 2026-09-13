/**
 * Desde quando a pessoa é cliente.
 *
 * Vale a data de cadastro: é a resposta certa para quem foi cadastrada e
 * ainda não tem lançamento, e para quem veio da planilha com cadastro
 * anterior ao primeiro atendimento registrado.
 *
 * O primeiro atendimento é só o plano B, para os cadastros antigos que
 * chegaram sem `data_cadastro`. Sem nenhum dos dois devolve null — a ficha
 * omite a linha em vez de mostrar data vazia.
 */
export function resolveClienteDesde(
  dataCadastro: string | null | undefined,
  primeiroAtendimento: string | null | undefined,
): string | null {
  return dataCadastro || primeiroAtendimento || null;
}
