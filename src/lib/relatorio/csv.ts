import { nomeMes } from "@/lib/caixa/mes";
import { dataReferenciaCaixa } from "@/lib/caixa/visao";
import { formatarData } from "@/lib/formatters";

import {
  classificarEntrada,
  classificarSaida,
  GRUPOS_DESPESA,
  type LancamentoRelatorio,
} from "./classificar";
import {
  centavosDe,
  ordenar,
  resumirAno,
  type ResumoRelatorio,
} from "./resumo";

/**
 * O CSV do mês para a contadora: uma linha por lançamento, no formato
 * que o Excel em português abre com dois cliques — separador ";",
 * vírgula decimal, datas dd/mm/aaaa e BOM para o UTF-8 não virar "Ã§".
 */

const BOM = "﻿";
const SEPARADOR = ";";
const FIM_DE_LINHA = "\r\n";

const CABECALHO = [
  "Data",
  "Tipo",
  "Situação",
  "Grupo",
  "Descrição",
  "Instituição",
  "Titularidade",
  "Forma",
  "Parcela",
  "Valor",
];

/**
 * Um campo do CSV. Quebra de linha vira espaço (a contadora quer uma
 * linha por lançamento); separador ou aspas obrigam a cercar de aspas,
 * com as de dentro dobradas.
 */
export function campoCsv(valor: string | null | undefined) {
  const texto = (valor ?? "").replace(/\r\n|\r|\n/g, " ");

  return /[;"]/.test(texto) ? `"${texto.replace(/"/g, '""')}"` : texto;
}

/** 123456 → "1234,56". Sem milhar: é número para planilha, não para ler. */
export function centavosCsv(centavos: number) {
  const sinal = centavos < 0 ? "-" : "";
  const absoluto = Math.abs(centavos);
  const reais = Math.floor(absoluto / 100);
  const resto = String(absoluto % 100).padStart(2, "0");

  return `${sinal}${reais},${resto}`;
}

function grupoCsv(lancamento: LancamentoRelatorio) {
  if (lancamento.tipo === "Saída") return classificarSaida(lancamento);

  const destino = classificarEntrada(lancamento);

  return destino === "Ignorada" ? "Cortesia (sem valor)" : destino;
}

function situacaoCsv(lancamento: LancamentoRelatorio) {
  if (lancamento.status === "Pendente") return "Previsto";

  return lancamento.tipo === "Entrada" ? "Recebido" : "Pago";
}

export function gerarCsv(lancamentos: LancamentoRelatorio[]) {
  const linhas = ordenar(lancamentos).map((lancamento) =>
    [
      formatarData(dataReferenciaCaixa(lancamento)),
      lancamento.tipo,
      situacaoCsv(lancamento),
      grupoCsv(lancamento),
      lancamento.descricao,
      lancamento.instituicao,
      lancamento.titularidade,
      lancamento.forma_pagamento,
      lancamento.parcelamento,
      centavosCsv(centavosDe(lancamento)),
    ]
      .map(campoCsv)
      .join(SEPARADOR),
  );

  return (
    BOM +
    [CABECALHO.map(campoCsv).join(SEPARADOR), ...linhas].join(FIM_DE_LINHA) +
    FIM_DE_LINHA
  );
}

export function nomeArquivoCsv(mes: string) {
  return `essenza-relatorio-${mes}.csv`;
}

// ---------------------------------------------------------------------
// CSV anual: uma linha por mês, as colunas na ordem da tela
// ---------------------------------------------------------------------

type ColunaAnual = {
  titulo: string;
  centavos: (resumo: ResumoRelatorio) => number;
  /** Na linha do total do ano, em branco em vez de somado. */
  semTotal?: boolean;
};

const COLUNAS_ANUAL: ColunaAnual[] = [
  { titulo: "PJ SumUp", centavos: (r) => r.entradas["PJ SumUp"].centavos },
  { titulo: "PJ Nubank", centavos: (r) => r.entradas["PJ Nubank"].centavos },
  { titulo: "Total PJ", centavos: (r) => r.totalPJ.centavos },
  { titulo: "PF Nubank", centavos: (r) => r.entradas["PF Nubank"].centavos },
  { titulo: "PF PicPay", centavos: (r) => r.entradas["PF PicPay"].centavos },
  { titulo: "Total PF", centavos: (r) => r.totalPF.centavos },
  { titulo: "Dinheiro", centavos: (r) => r.entradas.Dinheiro.centavos },
  { titulo: "Sem PF/PJ", centavos: (r) => r.entradas["Sem PF/PJ"].centavos },
  { titulo: "Total entradas", centavos: (r) => r.totalEntradas.centavos },
  ...GRUPOS_DESPESA.map(
    (grupo): ColunaAnual => ({
      titulo: grupo,
      centavos: (r) => r.despesas[grupo].centavos,
    }),
  ),
  { titulo: "Total despesas", centavos: (r) => r.totalDespesas.centavos },
  { titulo: "Resultado", centavos: (r) => r.resultado },
  { titulo: "Participação nos lucros", centavos: (r) => r.retirada.centavos },
  // Previsto de cada mês é foto de quando o arquivo foi gerado: somar
  // parcelas de meses diferentes não diz nada à contadora.
  {
    titulo: "Previsto a receber",
    centavos: (r) => r.previsto.centavos,
    semTotal: true,
  },
];

/**
 * O ano para a contadora: 12 linhas (janeiro a dezembro, meses futuros
 * zerados) e a linha "Total <ano>". Cada mês é o mesmo `montarResumo`
 * da tela; o total é a soma das 12 linhas, coluna a coluna.
 *
 * @param ano 'AAAA'.
 */
export function gerarCsvAnual(lancamentos: LancamentoRelatorio[], ano: string) {
  const meses = resumirAno(lancamentos, ano);

  const linhas = meses.map(({ mes, resumo }) =>
    [nomeMes(mes), ...COLUNAS_ANUAL.map((c) => centavosCsv(c.centavos(resumo)))],
  );

  const total = [
    `Total ${ano}`,
    ...COLUNAS_ANUAL.map((coluna) =>
      coluna.semTotal
        ? ""
        : centavosCsv(
            meses.reduce((soma, { resumo }) => soma + coluna.centavos(resumo), 0),
          ),
    ),
  ];

  return (
    BOM +
    [["Mês", ...COLUNAS_ANUAL.map((c) => c.titulo)], ...linhas, total]
      .map((campos) => campos.map(campoCsv).join(SEPARADOR))
      .join(FIM_DE_LINHA) +
    FIM_DE_LINHA
  );
}

export function nomeArquivoCsvAnual(ano: string) {
  return `Essenza_${ano}_relatorio_anual.csv`;
}
