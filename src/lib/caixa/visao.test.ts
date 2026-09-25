import { describe, expect, it } from "vitest";

import {
  dataReferenciaCaixa,
  filtroMesCaixa,
  marcaCaixa,
  somarResumoCaixa,
} from "./visao";

describe("dataReferenciaCaixa", () => {
  it("Pago: a data de caixa, não a da venda", () => {
    const pago = {
      status: "Pago" as const,
      data_competencia: "2026-09-23",
      data_caixa: "2026-09-25",
      data_prevista: null,
    };

    expect(dataReferenciaCaixa(pago)).toBe("2026-09-25");
    expect(marcaCaixa(pago)).toBeNull();
  });

  it("Pago ignora a previsão: o dinheiro já tem data real", () => {
    expect(
      dataReferenciaCaixa({
        status: "Pago",
        data_competencia: "2026-09-23",
        data_caixa: "2026-10-20",
        data_prevista: "2026-10-23",
      }),
    ).toBe("2026-10-20");
  });

  it("Pendente com previsão: a data prevista, marcada Previsto", () => {
    const parcela = {
      status: "Pendente" as const,
      data_competencia: "2026-09-23",
      data_caixa: null,
      data_prevista: "2026-10-23",
    };

    expect(dataReferenciaCaixa(parcela)).toBe("2026-10-23");
    expect(marcaCaixa(parcela)).toBe("Previsto");
  });

  it("Pendente sem previsão: a data de competência, marcada Pendente", () => {
    const boleto = {
      status: "Pendente" as const,
      data_competencia: "2026-09-12",
      data_caixa: null,
      data_prevista: null,
    };

    expect(dataReferenciaCaixa(boleto)).toBe("2026-09-12");
    expect(marcaCaixa(boleto)).toBe("Pendente");
  });
});

describe("filtroMesCaixa", () => {
  it("escreve a regra em três ramos, com o mês fechado nas pontas", () => {
    expect(filtroMesCaixa("2026-02")).toBe(
      "and(status.eq.Pago,data_caixa.gte.2026-02-01,data_caixa.lte.2026-02-28)," +
        "and(status.eq.Pendente,data_prevista.gte.2026-02-01,data_prevista.lte.2026-02-28)," +
        "and(status.eq.Pendente,data_prevista.is.null,data_competencia.gte.2026-02-01,data_competencia.lte.2026-02-28)",
    );
  });
});

describe("somarResumoCaixa", () => {
  it("separa o que já andou do que ainda vai andar", () => {
    expect(
      somarResumoCaixa([
        { tipo: "Entrada", status: "Pago", valor: 180 },
        { tipo: "Entrada", status: "Pendente", valor: 209.98 },
        { tipo: "Entrada", status: "Pendente", valor: 209.98 },
        { tipo: "Saída", status: "Pago", valor: 50 },
        { tipo: "Saída", status: "Pendente", valor: 420 },
      ]),
    ).toEqual({
      recebido: 180,
      pago: 50,
      saldo: 130,
      aReceber: 419.96,
      aPagar: 420,
      saldoPrevisto: -0.04,
    });
  });

  it("soma em centavos, sem erro de ponto flutuante", () => {
    const resumo = somarResumoCaixa([
      { tipo: "Entrada", status: "Pago", valor: 0.1 },
      { tipo: "Entrada", status: "Pago", valor: 0.2 },
    ]);

    expect(resumo.recebido).toBe(0.3);
  });

  it("mês vazio é zero", () => {
    expect(somarResumoCaixa([])).toEqual({
      recebido: 0,
      pago: 0,
      saldo: 0,
      aReceber: 0,
      aPagar: 0,
      saldoPrevisto: 0,
    });
  });
});
