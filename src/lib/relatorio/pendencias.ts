import { dataReferenciaCaixa } from "@/lib/caixa/visao";

import {
  classificarEntrada,
  classificarSaida,
  GRUPOS_FIXOS,
  instituicaoConhecida,
  type LancamentoRelatorio,
} from "./classificar";
import { centavosDe, ordenar } from "./resumo";

/**
 * O que ela precisa conferir antes de mandar o mês para a contadora.
 *
 * "Sem lançamento de X" não tem linha por trás: data, descrição e valor
 * vêm null.
 */
export type Pendencia = {
  motivo: string;
  id: string | null;
  data: string | null;
  descricao: string | null;
  centavos: number | null;
};

function daLinha(motivo: string, lancamento: LancamentoRelatorio): Pendencia {
  return {
    motivo,
    id: lancamento.id,
    data: dataReferenciaCaixa(lancamento),
    descricao: lancamento.descricao,
    centavos: centavosDe(lancamento),
  };
}

/**
 * @param mes         'AAAA-MM' do relatório.
 * @param mesCorrente 'AAAA-MM' de hoje. Mês futuro ainda não teve
 *                    aluguel: faltar um fixo só é pendência até o
 *                    mês corrente.
 */
export function levantarPendencias(
  lancamentos: LancamentoRelatorio[],
  mes: string,
  mesCorrente: string,
): Pendencia[] {
  const pendencias: Pendencia[] = [];
  const ordenados = ordenar(lancamentos);
  const saidas = ordenados.filter((l) => l.tipo === "Saída");

  for (const lancamento of ordenados) {
    if (
      lancamento.tipo === "Entrada" &&
      classificarEntrada(lancamento) === "Sem PF/PJ"
    ) {
      pendencias.push(daLinha("Entrada sem PF/PJ", lancamento));
    }
  }

  // Mesmo grupo e mesmo valor, ao centavo: provável lançamento em dobro.
  const porChave = new Map<string, LancamentoRelatorio[]>();

  for (const saida of saidas) {
    const chave = `${classificarSaida(saida)}|${centavosDe(saida)}`;

    porChave.set(chave, [...(porChave.get(chave) ?? []), saida]);
  }

  for (const iguais of porChave.values()) {
    if (iguais.length < 2) continue;

    for (const saida of iguais) {
      pendencias.push(daLinha("Possível duplicata", saida));
    }
  }

  for (const saida of saidas) {
    if (instituicaoConhecida(saida.instituicao) === "Terceiro") {
      pendencias.push(daLinha("Pago por outra pessoa", saida));
    }

    if (saida.status === "Pendente") {
      pendencias.push(daLinha("Saída ainda não paga (fora das despesas)", saida));
    }
  }

  if (mes <= mesCorrente) {
    const presentes = new Set(saidas.map((saida) => classificarSaida(saida)));

    for (const grupo of GRUPOS_FIXOS) {
      if (!presentes.has(grupo)) {
        pendencias.push({
          motivo: `Sem lançamento de ${grupo}`,
          id: null,
          data: null,
          descricao: null,
          centavos: null,
        });
      }
    }
  }

  return pendencias;
}
