import { emCentavos } from "@/lib/atendimentos/conta";
import { dataReferenciaCaixa } from "@/lib/caixa/visao";

import {
  classificarEntrada,
  classificarSaida,
  CONTAS_ENTRADA,
  GRUPOS_DESPESA,
  type ContaEntrada,
  type GrupoDespesa,
  type LancamentoRelatorio,
} from "./classificar";

/**
 * O resumo do mês, somado em CENTAVOS inteiros — a mesma convenção de
 * `atendimentos/conta.ts`. Reais só na hora de formatar, na tela.
 *
 * O mês é o da visão Caixa: os lançamentos já chegam filtrados por
 * `filtroMesCaixa`. Nas saídas, entra no total só o que foi pago; saída
 * Pendente ainda não saiu do bolso e aparece nas pendências.
 */

/** Um total e as linhas que o compõem, para a tela poder abrir. */
export type Grupo = {
  centavos: number;
  linhas: LancamentoRelatorio[];
};

export type ResumoRelatorio = {
  entradas: Record<ContaEntrada, Grupo>;
  totalPJ: Grupo;
  totalPF: Grupo;
  /** PJ + PF + Dinheiro + Sem PF/PJ: tudo o que caiu no mês. */
  totalEntradas: Grupo;
  despesas: Record<GrupoDespesa, Grupo>;
  totalDespesas: Grupo;
  /** Participação nos lucros: fora do total de despesas. */
  retirada: Grupo;
  /**
   * Total de entradas − total de despesas, em centavos. A retirada fica
   * de fora: é dinheiro dela saindo do lucro, não custo do salão.
   */
  resultado: number;
  /** Entradas Pendentes: listadas, nunca somadas nos totais acima. */
  previsto: Grupo;
};

export function centavosDe(lancamento: Pick<LancamentoRelatorio, "valor">) {
  return emCentavos(Number(lancamento.valor));
}

function vazio(): Grupo {
  return { centavos: 0, linhas: [] };
}

function incluir(grupo: Grupo, lancamento: LancamentoRelatorio) {
  grupo.centavos += centavosDe(lancamento);
  grupo.linhas.push(lancamento);
}

function juntar(...grupos: Grupo[]): Grupo {
  return {
    centavos: grupos.reduce((soma, grupo) => soma + grupo.centavos, 0),
    linhas: ordenar(grupos.flatMap((grupo) => grupo.linhas)),
  };
}

/** Do dia 1 ao fim do mês, pela data em que o dinheiro andou. */
export function ordenar(lancamentos: LancamentoRelatorio[]) {
  return [...lancamentos].sort((a, b) =>
    dataReferenciaCaixa(a).localeCompare(dataReferenciaCaixa(b)),
  );
}

/**
 * O ano mês a mês: cada lançamento vai para o mês da sua data de
 * referência (a mesma do filtro do mês) e cada mês passa por
 * `montarResumo` — nenhuma regra própria. Sempre 12 meses, de janeiro a
 * dezembro; mês sem lançamento sai zerado. Fora do ano, ignorado.
 *
 * @param ano 'AAAA'.
 */
export function resumirAno(
  lancamentos: LancamentoRelatorio[],
  ano: string,
): { mes: string; resumo: ResumoRelatorio }[] {
  const meses = Array.from(
    { length: 12 },
    (_, indice) => `${ano}-${String(indice + 1).padStart(2, "0")}`,
  );
  const porMes = new Map<string, LancamentoRelatorio[]>(
    meses.map((mes) => [mes, []]),
  );

  for (const lancamento of lancamentos) {
    porMes.get(dataReferenciaCaixa(lancamento).slice(0, 7))?.push(lancamento);
  }

  return meses.map((mes) => ({
    mes,
    resumo: montarResumo(porMes.get(mes) ?? []),
  }));
}

export function montarResumo(
  lancamentos: LancamentoRelatorio[],
): ResumoRelatorio {
  const entradas = Object.fromEntries(
    CONTAS_ENTRADA.map((conta) => [conta, vazio()]),
  ) as Record<ContaEntrada, Grupo>;
  const despesas = Object.fromEntries(
    GRUPOS_DESPESA.map((grupo) => [grupo, vazio()]),
  ) as Record<GrupoDespesa, Grupo>;
  const retirada = vazio();
  const previsto = vazio();

  for (const lancamento of ordenar(lancamentos)) {
    if (lancamento.tipo === "Entrada") {
      const destino = classificarEntrada(lancamento);

      if (destino === "Ignorada") continue;

      incluir(
        destino === "Previsto a receber" ? previsto : entradas[destino],
        lancamento,
      );
      continue;
    }

    if (lancamento.status !== "Pago") continue;

    const grupo = classificarSaida(lancamento);

    incluir(grupo === "Retirada" ? retirada : despesas[grupo], lancamento);
  }

  const totalEntradas = juntar(
    ...CONTAS_ENTRADA.map((conta) => entradas[conta]),
  );
  const totalDespesas = juntar(
    ...GRUPOS_DESPESA.map((grupo) => despesas[grupo]),
  );

  return {
    entradas,
    totalPJ: juntar(entradas["PJ SumUp"], entradas["PJ Nubank"]),
    totalPF: juntar(entradas["PF Nubank"], entradas["PF PicPay"]),
    totalEntradas,
    despesas,
    totalDespesas,
    retirada,
    resultado: totalEntradas.centavos - totalDespesas.centavos,
    previsto,
  };
}
