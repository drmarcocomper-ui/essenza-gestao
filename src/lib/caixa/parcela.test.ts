import { describe, expect, it } from "vitest";

import { compararPorParcela, lerParcela } from "@/lib/caixa/parcela";

describe("rótulo de parcela", () => {
  it("lê n/N", () => {
    expect(lerParcela("1/3")).toEqual({ rotulo: "1/3", numero: 1, total: 3 });
    expect(lerParcela("0/3")).toEqual({ rotulo: "0/3", numero: 0, total: 3 });
  });

  it("recusa o que não é n/N", () => {
    expect(lerParcela("2026-03-15")).toBeNull();
    expect(lerParcela(null)).toBeNull();
    expect(lerParcela("")).toBeNull();
    expect(lerParcela(" 1/3")).toBeNull();
    expect(lerParcela("1/3x")).toBeNull();
  });
});

describe("ordem das linhas da conta", () => {
  it("sem parcela primeiro, parcelas pelo número, id desempata", () => {
    const linhas = [
      { id: "c", parcelamento: "10/12" },
      { id: "b", parcelamento: "2/12" },
      { id: "e", parcelamento: "1/12" },
      { id: "d", parcelamento: null },
      { id: "a", parcelamento: "2026-03-15" },
      { id: "f", parcelamento: "1/12" },
    ];

    expect([...linhas].sort(compararPorParcela).map((l) => l.id)).toEqual([
      "a",
      "d",
      "e",
      "f",
      "b",
      "c",
    ]);
  });

  it("não depende da ordem de entrada", () => {
    const linhas = [
      { id: "3", parcelamento: "3/3" },
      { id: "1", parcelamento: "1/3" },
      { id: "2", parcelamento: "2/3" },
    ];

    expect([...linhas].reverse().sort(compararPorParcela)).toEqual(
      [...linhas].sort(compararPorParcela),
    );
  });
});
