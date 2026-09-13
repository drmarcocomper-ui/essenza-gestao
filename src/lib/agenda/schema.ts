/**
 * Lista espelhada do `check` de `agendamentos.status` na migration 001.
 * Mudou lá, muda aqui — o banco é quem manda, isto existe para a UI
 * errar antes do INSERT.
 *
 * Os valores são os do banco, em minúsculas. Os rótulos são o que a
 * Kamylle lê na tela; nada exibe o valor cru.
 */
export const STATUS = [
  "agendado",
  "confirmado",
  "atendido",
  "faltou",
  "cancelado",
] as const;

export type StatusAgendamento = (typeof STATUS)[number];

export const ROTULOS_STATUS: Record<StatusAgendamento, string> = {
  agendado: "Agendado",
  confirmado: "Confirmado",
  atendido: "Atendido",
  faltou: "Faltou",
  cancelado: "Cancelado",
};
