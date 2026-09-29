import { describe, expect, it } from "vitest";

import {
  classificarEntrada,
  classificarSaida,
  type LancamentoRelatorio,
} from "./classificar";
import { campoCsv, centavosCsv, gerarCsv, nomeArquivoCsv } from "./csv";
import { levantarPendencias } from "./pendencias";
import { montarResumo } from "./resumo";

let sequencia = 0;

function entrada(parcial: Partial<LancamentoRelatorio> = {}): LancamentoRelatorio {
  sequencia += 1;

  return {
    id: `e${sequencia}`,
    tipo: "Entrada",
    status: "Pago",
    data_competencia: "2026-09-10",
    data_caixa: "2026-09-10",
    data_prevista: null,
    categoria: "Serviço",
    descricao: "Coloração",
    instituicao: "Nubank",
    titularidade: "PJ",
    forma_pagamento: "Pix",
    parcelamento: null,
    valor: 100,
    cliente: null,
    ...parcial,
  };
}

function saida(parcial: Partial<LancamentoRelatorio> = {}): LancamentoRelatorio {
  sequencia += 1;

  return {
    id: `s${sequencia}`,
    tipo: "Saída",
    status: "Pago",
    data_competencia: "2026-09-05",
    data_caixa: "2026-09-05",
    data_prevista: null,
    categoria: "Custo Fixo",
    descricao: "Compra diversa",
    instituicao: "Nubank",
    titularidade: "PJ",
    forma_pagamento: "Pix",
    parcelamento: null,
    valor: 50,
    cliente: null,
    ...parcial,
  };
}

/** Os cinco fixos do mês, para as pendências não falarem deles. */
function fixos() {
  return [
    saida({ descricao: "Aluguel", valor: 1500 }),
    saida({ descricao: "Condomínio", valor: 300 }),
    saida({ descricao: "EDP", valor: 180.37 }),
    saida({ descricao: "DAS", valor: 75.9 }),
    saida({ descricao: "INSS", valor: 166.98 }),
  ];
}

describe("classificarEntrada", () => {
  it.each([
    ["SumUp", "PJ", "PJ SumUp"],
    ["SumUp", "PF", "PJ SumUp"],
    ["SumUp", null, "PJ SumUp"],
    ["PicPay", "PF", "PF PicPay"],
    ["PicPay", "PJ", "PF PicPay"],
    ["PicPay", null, "PF PicPay"],
    ["Nubank", "PJ", "PJ Nubank"],
    ["Nubank", "PF", "PF Nubank"],
    ["Nubank", null, "Sem PF/PJ"],
    ["Nubank", "Terceiro", "Sem PF/PJ"],
    ["Dinheiro", null, "Dinheiro"],
    ["Dinheiro", "PF", "Dinheiro"],
    ["Terceiro", "Terceiro", "Sem PF/PJ"],
    [null, "PJ", "Sem PF/PJ"],
    ["Itaú", "PJ", "Sem PF/PJ"],
  ])("%s + %s → %s", (instituicao, titularidade, esperado) => {
    expect(classificarEntrada(entrada({ instituicao, titularidade }))).toBe(
      esperado,
    );
  });

  it("instituição em texto livre: ' sumup ' é a SumUp", () => {
    expect(classificarEntrada(entrada({ instituicao: " sumup " }))).toBe(
      "PJ SumUp",
    );
  });

  it("Cortesia de valor zero é ignorada", () => {
    expect(
      classificarEntrada(
        entrada({ instituicao: "Cortesia", forma_pagamento: "Cortesia", valor: 0 }),
      ),
    ).toBe("Ignorada");
  });

  it("Cortesia com valor vai para Sem PF/PJ", () => {
    expect(
      classificarEntrada(
        entrada({ instituicao: "Cortesia", forma_pagamento: "Cortesia", valor: 40 }),
      ),
    ).toBe("Sem PF/PJ");
    expect(
      classificarEntrada(
        entrada({ instituicao: null, forma_pagamento: "Cortesia", valor: 40 }),
      ),
    ).toBe("Sem PF/PJ");
  });

  it("Pendente é previsto a receber, seja qual for a conta", () => {
    expect(
      classificarEntrada(
        entrada({ status: "Pendente", data_caixa: null, instituicao: "SumUp" }),
      ),
    ).toBe("Previsto a receber");
  });
});

describe("classificarSaida", () => {
  it.each([
    ["Aluguel sala setembro", "Aluguel"],
    ["Condomínio", "Condomínio"],
    ["Taxa condominial", "Condomínio"],
    ["EDP", "Luz"],
    ["Conta de energia", "Luz"],
    ["Luz", "Luz"],
    ["DAS", "DAS MEI"],
    ["DAS MEI 09/2026", "DAS MEI"],
    ["Imposto", "DAS MEI"],
    ["INSS", "INSS"],
    ["Boleto WELLA", "Boletos de produtos"],
    ["L'Oréal", "Boletos de produtos"],
    ["Loreal", "Boletos de produtos"],
    ["Kérastase", "Boletos de produtos"],
    ["Produtos", "Boletos de produtos"],
    ["Curso de visagismo", "Outras"],
  ])("%s → %s", (descricao, esperado) => {
    expect(classificarSaida({ categoria: "Custo Fixo", descricao })).toBe(
      esperado,
    );
  });

  it("'luz' e 'das' só como palavra inteira", () => {
    expect(classificarSaida({ categoria: "Custo Variável", descricao: "Luzia" })).toBe(
      "Outras",
    );
    expect(
      classificarSaida({ categoria: "Custo Variável", descricao: "Sacola de vendas" }),
    ).toBe("Outras");
  });

  it("'imposto' só quando é a descrição inteira", () => {
    expect(
      classificarSaida({ categoria: "Custo Fixo", descricao: "Imposto de renda" }),
    ).toBe("Outras");
  });

  it("prioridade: aluguel ganha de boleto", () => {
    expect(
      classificarSaida({ categoria: "Custo Fixo", descricao: "Boleto aluguel" }),
    ).toBe("Aluguel");
  });

  it("Participação Lucros é retirada, pela categoria", () => {
    expect(
      classificarSaida({ categoria: "Participação Lucros", descricao: "Aluguel" }),
    ).toBe("Retirada");
  });
});

describe("montarResumo", () => {
  it("separa PJ, PF, Dinheiro e Sem PF/PJ, com os totais", () => {
    const resumo = montarResumo([
      entrada({ instituicao: "SumUp", valor: 200 }),
      entrada({ instituicao: "Nubank", titularidade: "PJ", valor: 100 }),
      entrada({ instituicao: "Nubank", titularidade: "PF", valor: 80 }),
      entrada({ instituicao: "PicPay", titularidade: "PJ", valor: 60 }),
      entrada({ instituicao: "Dinheiro", titularidade: null, valor: 50 }),
      entrada({ instituicao: "Nubank", titularidade: null, valor: 30 }),
      entrada({ instituicao: "Cortesia", forma_pagamento: "Cortesia", valor: 0 }),
    ]);

    expect(resumo.entradas["PJ SumUp"].centavos).toBe(20000);
    expect(resumo.entradas["PJ Nubank"].centavos).toBe(10000);
    expect(resumo.totalPJ.centavos).toBe(30000);
    expect(resumo.entradas["PF Nubank"].centavos).toBe(8000);
    expect(resumo.entradas["PF PicPay"].centavos).toBe(6000);
    expect(resumo.totalPF.centavos).toBe(14000);
    expect(resumo.entradas.Dinheiro.centavos).toBe(5000);
    expect(resumo.entradas["Sem PF/PJ"].centavos).toBe(3000);
    expect(resumo.totalPJ.linhas).toHaveLength(2);
  });

  it("Pendente fica fora de todos os totais, só no previsto", () => {
    const resumo = montarResumo([
      entrada({ instituicao: "SumUp", valor: 100 }),
      entrada({
        instituicao: "SumUp",
        status: "Pendente",
        data_caixa: null,
        data_prevista: "2026-09-23",
        parcelamento: "2/3",
        valor: 209.97,
      }),
      entrada({
        instituicao: "Nubank",
        titularidade: "PF",
        status: "Pendente",
        data_caixa: null,
        valor: 50,
      }),
    ]);

    expect(resumo.totalPJ.centavos).toBe(10000);
    expect(resumo.totalPF.centavos).toBe(0);
    expect(resumo.entradas["Sem PF/PJ"].centavos).toBe(0);
    expect(resumo.previsto.centavos).toBe(25997);
    expect(resumo.previsto.linhas).toHaveLength(2);
  });

  it("despesas por grupo; retirada fora do total de despesas", () => {
    const resumo = montarResumo([
      ...fixos(),
      saida({ descricao: "Boleto Wella", valor: 412.5 }),
      saida({ descricao: "Curso", valor: 100 }),
      saida({ categoria: "Participação Lucros", descricao: "Retirada", valor: 3000 }),
    ]);

    expect(resumo.despesas.Aluguel.centavos).toBe(150000);
    expect(resumo.despesas.Luz.centavos).toBe(18037);
    expect(resumo.despesas["Boletos de produtos"].centavos).toBe(41250);
    expect(resumo.despesas.Outras.centavos).toBe(10000);
    expect(resumo.retirada.centavos).toBe(300000);
    expect(resumo.totalDespesas.centavos).toBe(
      150000 + 30000 + 18037 + 7590 + 16698 + 41250 + 10000,
    );
  });

  it("saída Pendente não soma nas despesas", () => {
    const resumo = montarResumo([
      saida({ descricao: "Aluguel", status: "Pendente", data_caixa: null }),
    ]);

    expect(resumo.despesas.Aluguel.centavos).toBe(0);
    expect(resumo.totalDespesas.centavos).toBe(0);
  });

  it("soma em centavos: dez vezes 0,10 mais 0,20 dá 1,20 exato", () => {
    const resumo = montarResumo([
      ...Array.from({ length: 10 }, () =>
        entrada({ instituicao: "SumUp", valor: 0.1 }),
      ),
      entrada({ instituicao: "SumUp", valor: 0.2 }),
      saida({ valor: 0.1 }),
      saida({ valor: 0.2 }),
    ]);

    expect(resumo.totalPJ.centavos).toBe(120);
    expect(resumo.totalDespesas.centavos).toBe(30);
    expect(Number.isInteger(resumo.totalPJ.centavos)).toBe(true);
  });

  it("linhas ordenadas pela data em que o dinheiro andou", () => {
    const resumo = montarResumo([
      entrada({ instituicao: "SumUp", data_caixa: "2026-09-20", descricao: "b" }),
      entrada({ instituicao: "SumUp", data_caixa: "2026-09-02", descricao: "a" }),
    ]);

    expect(resumo.entradas["PJ SumUp"].linhas.map((l) => l.descricao)).toEqual([
      "a",
      "b",
    ]);
  });
});

describe("levantarPendencias", () => {
  const motivos = (lista: ReturnType<typeof levantarPendencias>) =>
    lista.map((p) => p.motivo);

  it("mês completo e limpo: nada a conferir", () => {
    expect(
      levantarPendencias([...fixos(), entrada()], "2026-09", "2026-09"),
    ).toEqual([]);
  });

  it("entrada Sem PF/PJ vira pendência com data, descrição e valor", () => {
    const lista = levantarPendencias(
      [
        ...fixos(),
        entrada({
          instituicao: "Nubank",
          titularidade: null,
          descricao: "Mechas",
          data_caixa: "2026-09-12",
          valor: 350.5,
        }),
      ],
      "2026-09",
      "2026-09",
    );

    expect(lista).toEqual([
      expect.objectContaining({
        motivo: "Entrada sem PF/PJ",
        data: "2026-09-12",
        descricao: "Mechas",
        centavos: 35050,
      }),
    ]);
  });

  it("entrada Pendente não vira pendência de PF/PJ", () => {
    expect(
      levantarPendencias(
        [
          ...fixos(),
          entrada({ status: "Pendente", data_caixa: null, titularidade: null }),
        ],
        "2026-09",
        "2026-09",
      ),
    ).toEqual([]);
  });

  it("duas saídas do mesmo grupo e mesmo valor: possível duplicata", () => {
    const lista = levantarPendencias(
      [...fixos(), saida({ descricao: "Aluguel", valor: 1500 })],
      "2026-09",
      "2026-09",
    );

    expect(motivos(lista)).toEqual(["Possível duplicata", "Possível duplicata"]);
  });

  it("um centavo de diferença não é duplicata", () => {
    expect(
      levantarPendencias(
        [...fixos(), saida({ descricao: "Aluguel", valor: 1500.01 })],
        "2026-09",
        "2026-09",
      ),
    ).toEqual([]);
  });

  it("mesmo valor em grupos diferentes não é duplicata", () => {
    expect(
      levantarPendencias(
        [...fixos(), saida({ descricao: "Curso", valor: 1500 })],
        "2026-09",
        "2026-09",
      ),
    ).toEqual([]);
  });

  it("saída paga por Terceiro", () => {
    expect(
      motivos(
        levantarPendencias(
          [...fixos(), saida({ instituicao: "Terceiro", titularidade: "Terceiro" })],
          "2026-09",
          "2026-09",
        ),
      ),
    ).toEqual(["Pago por outra pessoa"]);
  });

  it("saída Pendente aparece para conferir", () => {
    expect(
      motivos(
        levantarPendencias(
          [...fixos(), saida({ status: "Pendente", data_caixa: null })],
          "2026-09",
          "2026-09",
        ),
      ),
    ).toEqual(["Saída ainda não paga (fora das despesas)"]);
  });

  it("mês encerrado sem os fixos: um aviso por fixo", () => {
    expect(motivos(levantarPendencias([], "2026-08", "2026-09"))).toEqual([
      "Sem lançamento de Aluguel",
      "Sem lançamento de Condomínio",
      "Sem lançamento de Luz",
      "Sem lançamento de DAS MEI",
      "Sem lançamento de INSS",
    ]);
  });

  it("mês corrente também avisa", () => {
    expect(levantarPendencias([], "2026-09", "2026-09")).toHaveLength(5);
  });

  it("mês futuro nunca avisa falta de fixo", () => {
    expect(levantarPendencias([], "2026-10", "2026-09")).toEqual([]);
    expect(levantarPendencias([], "2027-01", "2026-12")).toEqual([]);
  });
});

describe("CSV", () => {
  it("campo com ';' ou aspas vai entre aspas, com as de dentro dobradas", () => {
    expect(campoCsv('Boleto "Wella"; setembro')).toBe(
      '"Boleto ""Wella""; setembro"',
    );
    expect(campoCsv("simples")).toBe("simples");
    expect(campoCsv(null)).toBe("");
  });

  it("quebra de linha vira espaço", () => {
    expect(campoCsv("linha 1\nlinha 2\r\nlinha 3\rfim")).toBe(
      "linha 1 linha 2 linha 3 fim",
    );
  });

  it("valor com vírgula decimal, sem milhar e sem ponto flutuante", () => {
    expect(centavosCsv(123456)).toBe("1234,56");
    expect(centavosCsv(5)).toBe("0,05");
    expect(centavosCsv(0)).toBe("0,00");
  });

  it("arquivo completo: BOM, cabeçalho, ';', data dd/mm/aaaa, uma linha por lançamento", () => {
    const csv = gerarCsv([
      saida({
        descricao: 'Boleto "Wella"; lote\n2',
        data_caixa: "2026-09-05",
        instituicao: "Nubank",
        titularidade: "PJ",
        forma_pagamento: "Boleto",
        valor: 1234.5,
      }),
      entrada({
        instituicao: "SumUp",
        titularidade: "PJ",
        forma_pagamento: "Cartão de crédito",
        status: "Pendente",
        data_caixa: null,
        data_prevista: "2026-09-23",
        parcelamento: "2/3",
        descricao: "Mechas",
        valor: 209.97,
      }),
      entrada({ data_caixa: "2026-09-01", descricao: "Corte", valor: 80 }),
    ]);

    expect(csv.startsWith("﻿")).toBe(true);

    const linhas = csv.slice(1).split("\r\n");

    expect(linhas).toEqual([
      "Data;Tipo;Situação;Grupo;Descrição;Instituição;Titularidade;Forma;Parcela;Valor",
      "01/09/2026;Entrada;Recebido;PJ Nubank;Corte;Nubank;PJ;Pix;;80,00",
      '05/09/2026;Saída;Pago;Boletos de produtos;"Boleto ""Wella""; lote 2";Nubank;PJ;Boleto;;1234,50',
      "23/09/2026;Entrada;Previsto;Previsto a receber;Mechas;SumUp;PJ;Cartão de crédito;2/3;209,97",
      "",
    ]);
  });

  it("nome do arquivo", () => {
    expect(nomeArquivoCsv("2026-09")).toBe("essenza-relatorio-2026-09.csv");
  });
});
