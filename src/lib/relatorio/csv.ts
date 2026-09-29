import { dataReferenciaCaixa } from "@/lib/caixa/visao";
import { formatarData } from "@/lib/formatters";

import {
  classificarEntrada,
  classificarSaida,
  type LancamentoRelatorio,
} from "./classificar";
import { centavosDe, ordenar } from "./resumo";

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
