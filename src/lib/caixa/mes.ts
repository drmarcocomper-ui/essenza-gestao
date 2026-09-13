/**
 * Mês de competência no formato 'AAAA-MM' — o mesmo texto que ela já usa
 * na planilha e que está gravado em `lancamentos.mes_competencia`.
 *
 * Tudo aqui é aritmética de string. `new Date('2026-09-01')` é lido como
 * UTC e volta um dia atrás em fuso negativo, o que erraria o mês inteiro
 * na virada. Só `hoje()` olha o relógio, e sempre no fuso do salão.
 */

const FUSO = "America/Sao_Paulo";

const NOMES_MES = [
  "Janeiro",
  "Fevereiro",
  "Março",
  "Abril",
  "Maio",
  "Junho",
  "Julho",
  "Agosto",
  "Setembro",
  "Outubro",
  "Novembro",
  "Dezembro",
];

/** Data de hoje no fuso do salão, no formato que a coluna `date` espera. */
export function hoje() {
  return new Date().toLocaleDateString("en-CA", { timeZone: FUSO });
}

/** Mês corrente, o que a lista do caixa abre por padrão. */
export function mesAtual() {
  return hoje().slice(0, 7);
}

/** O mês veio da URL: só é aceito se for 'AAAA-MM' de verdade. */
export function mesValido(valor: unknown): valor is string {
  if (typeof valor !== "string" || !/^\d{4}-\d{2}$/.test(valor)) {
    return false;
  }

  const mes = Number(valor.slice(5, 7));

  return mes >= 1 && mes <= 12;
}

/** Navegação entre meses. `deslocarMes('2026-01', -1)` → '2025-12'. */
export function deslocarMes(mes: string, passos: number) {
  const ano = Number(mes.slice(0, 4));
  const indice = Number(mes.slice(5, 7)) - 1 + passos;

  // Divisão que arredonda para baixo também no negativo: janeiro menos um
  // mês tem de cair em dezembro do ano anterior.
  const anoFinal = ano + Math.floor(indice / 12);
  const mesFinal = (((indice % 12) + 12) % 12) + 1;

  return `${anoFinal}-${String(mesFinal).padStart(2, "0")}`;
}

/** '2026-09' → 'Setembro de 2026'. */
export function rotuloMes(mes: string) {
  const nome = NOMES_MES[Number(mes.slice(5, 7)) - 1] ?? "";

  return `${nome} de ${mes.slice(0, 4)}`;
}

export function primeiroDia(mes: string) {
  return `${mes}-01`;
}

/** Dia 0 do mês seguinte é o último dia deste. Em UTC, longe do fuso. */
export function ultimoDia(mes: string) {
  const ano = Number(mes.slice(0, 4));
  const numero = Number(mes.slice(5, 7));
  const dia = new Date(Date.UTC(ano, numero, 0)).getUTCDate();

  return `${mes}-${String(dia).padStart(2, "0")}`;
}
