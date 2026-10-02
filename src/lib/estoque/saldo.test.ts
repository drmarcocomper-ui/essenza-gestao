import { describe, expect, it } from "vitest";

import {
  calcularSaldo,
  registradoDepois,
  ultimaContagem,
  type Contagem,
  type Entrada,
  type Saida,
} from "./saldo";

/** Carimbo do jeito que o PostgREST devolve timestamptz. */
function as(data: string, hora: string) {
  return `${data}T${hora}+00:00`;
}

const CONTAGEM: Contagem = {
  data: "2026-09-10",
  registradoEm: as("2026-09-10", "14:00:00.000000"),
  quantidade: 5,
};

function compra(data: string, hora: string, quantidade: number): Entrada {
  return { data, registradoEm: as(data, hora), quantidade };
}

function venda(
  data: string,
  fechadaEm: string | null,
  quantidade: number,
): Saida {
  return { data, fechadaEm, quantidade };
}

function quantidade(
  contagens: Contagem[],
  entradas: Entrada[] = [],
  saidas: Saida[] = [],
) {
  const saldo = calcularSaldo(contagens, entradas, saidas);

  return saldo.situacao === "contado" ? saldo.quantidade : null;
}

describe("calcularSaldo", () => {
  it("sem contagem não tem número, nem com compra e venda", () => {
    expect(
      calcularSaldo(
        [],
        [compra("2026-09-01", "10:00:00", 3)],
        [venda("2026-09-02", as("2026-09-02", "18:00:00"), 1)],
      ),
    ).toEqual({ situacao: "sem_contagem" });
  });

  it("só a contagem: o saldo é ela", () => {
    expect(quantidade([CONTAGEM])).toBe(5);
  });

  it("compra depois da contagem soma", () => {
    expect(quantidade([CONTAGEM], [compra("2026-09-12", "09:00:00", 4)])).toBe(9);
  });

  it("compra antes da contagem é ignorada (a contagem já a viu)", () => {
    expect(quantidade([CONTAGEM], [compra("2026-09-08", "09:00:00", 4)])).toBe(5);
  });

  it("compra de data anterior registrada depois da contagem também é ignorada", () => {
    // Lançou hoje a nota da semana passada: vale a data da compra.
    const atrasada: Entrada = {
      data: "2026-09-08",
      registradoEm: as("2026-09-11", "09:00:00"),
      quantidade: 4,
    };

    expect(quantidade([CONTAGEM], [atrasada])).toBe(5);
  });

  it("compra no mesmo dia: antes da contagem não soma, depois soma", () => {
    expect(
      quantidade([CONTAGEM], [compra("2026-09-10", "13:59:59.999999", 2)]),
    ).toBe(5);
    expect(
      quantidade([CONTAGEM], [compra("2026-09-10", "14:00:00.000001", 2)]),
    ).toBe(7);
  });

  it("venda em conta fechada depois da contagem desconta", () => {
    expect(
      quantidade(
        [CONTAGEM],
        [],
        [venda("2026-09-15", as("2026-09-15", "17:00:00"), 2)],
      ),
    ).toBe(3);
  });

  it("venda antes da contagem é ignorada", () => {
    expect(
      quantidade(
        [CONTAGEM],
        [],
        [venda("2026-09-05", as("2026-09-05", "17:00:00"), 2)],
      ),
    ).toBe(5);
  });

  it("venda no mesmo dia: fechada antes da contagem não desconta, depois desconta", () => {
    expect(
      quantidade(
        [CONTAGEM],
        [],
        [venda("2026-09-10", as("2026-09-10", "11:30:00"), 1)],
      ),
    ).toBe(5);
    expect(
      quantidade(
        [CONTAGEM],
        [],
        [venda("2026-09-10", as("2026-09-10", "16:30:00"), 1)],
      ),
    ).toBe(4);
  });

  it("venda em conta ABERTA é ignorada", () => {
    expect(quantidade([CONTAGEM], [], [venda("2026-09-15", null, 2)])).toBe(5);
  });

  it("duas contagens no mesmo dia: vale a registrada por último", () => {
    const tarde: Contagem = {
      data: "2026-09-10",
      registradoEm: as("2026-09-10", "18:00:00"),
      quantidade: 6,
    };

    // A compra das 16h fica entre as duas: a de 18h já a enxergou.
    const entradas = [compra("2026-09-10", "16:00:00", 2)];

    expect(quantidade([tarde, CONTAGEM], entradas)).toBe(6);
    expect(quantidade([CONTAGEM, tarde], entradas)).toBe(6);
  });

  it("a contagem de data mais recente ganha da registrada por último", () => {
    // Contagem do dia 9 lançada depois da do dia 10: vale a do dia 10.
    const antiga: Contagem = {
      data: "2026-09-09",
      registradoEm: as("2026-09-11", "08:00:00"),
      quantidade: 1,
    };

    expect(ultimaContagem([CONTAGEM, antiga])).toBe(CONTAGEM);
  });

  it("saldo negativo aparece como número", () => {
    expect(
      quantidade(
        [CONTAGEM],
        [compra("2026-09-11", "10:00:00", 1)],
        [venda("2026-09-12", as("2026-09-12", "17:00:00"), 8)],
      ),
    ).toBe(-2);
  });

  it("tudo junto", () => {
    expect(
      quantidade(
        [CONTAGEM],
        [
          compra("2026-09-01", "10:00:00", 10), // antes: fora
          compra("2026-09-20", "10:00:00", 6),
        ],
        [
          venda("2026-09-21", as("2026-09-21", "19:00:00"), 2),
          venda("2026-09-22", null, 5), // aberta: fora
        ],
      ),
    ).toBe(9);
  });
});

describe("registradoDepois", () => {
  it("desempata pelos microssegundos, que o Date.parse corta", () => {
    expect(
      registradoDepois(
        "2026-09-10T14:00:00.123457+00:00",
        "2026-09-10T14:00:00.123456+00:00",
      ),
    ).toBe(true);
    expect(
      registradoDepois(
        "2026-09-10T14:00:00.123456+00:00",
        "2026-09-10T14:00:00.123456+00:00",
      ),
    ).toBe(false);
  });

  it("entende fração encurtada e fuso diferente", () => {
    expect(
      registradoDepois("2026-09-10T14:00:00.5+00:00", "2026-09-10T14:00:00.45+00:00"),
    ).toBe(true);
    expect(
      registradoDepois("2026-09-10T11:00:01-03:00", "2026-09-10T14:00:00+00:00"),
    ).toBe(true);
  });
});
