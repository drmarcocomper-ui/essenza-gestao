import { describe, expect, it } from "vitest";

import { indicesProdutoRepetido, totalDaCompra } from "./regras";

describe("indicesProdutoRepetido", () => {
  it("marca só a repetição, não a primeira ocorrência", () => {
    expect([...indicesProdutoRepetido(["a", "b", "a", "a"])]).toEqual([2, 3]);
  });

  it("linha sem produto não repete nada", () => {
    expect(indicesProdutoRepetido(["", "", "a"]).size).toBe(0);
  });
});

describe("totalDaCompra", () => {
  it("soma quantidade × custo em centavos", () => {
    expect(
      totalDaCompra([
        { quantidade: 3, custoUnitario: 0.1 },
        { quantidade: 2, custoUnitario: 85.55 },
      ]),
    ).toBe(171.4);
  });

  it("zero sem linhas", () => {
    expect(totalDaCompra([])).toBe(0);
  });
});
