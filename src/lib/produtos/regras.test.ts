import { describe, expect, it } from "vitest";

import {
  encontrarDuplicado,
  mensagemDuplicado,
  ordenarProdutos,
  produtoCasaComTermo,
} from "./regras";

const ATIVOS = [
  { id: "1", nome: "Máscara Nutritiva", marca: "Wella", tipo: "revenda" },
  { id: "2", nome: "Óleo Elixir", marca: null, tipo: "revenda" },
  { id: "3", nome: "Koleston 7.1", marca: "Wella", tipo: "coloracao" },
];

describe("encontrarDuplicado", () => {
  it.each([
    ["máscara nutritiva", "wella"],
    ["MASCARA NUTRITIVA", "WELLA"],
    ["  Mascara   Nutritiva ", " Wélla "],
  ])("recusa %s / %s (caixa, acento e espaço)", (nome, marca) => {
    expect(encontrarDuplicado(ATIVOS, nome, marca)?.id).toBe("1");
  });

  it("aceita o mesmo nome com marca diferente", () => {
    expect(
      encontrarDuplicado(ATIVOS, "Máscara Nutritiva", "Kérastase"),
    ).toBeNull();
  });

  it("aceita o mesmo nome quando o existente tem marca e o novo não", () => {
    expect(encontrarDuplicado(ATIVOS, "Máscara Nutritiva", null)).toBeNull();
  });

  it("sem marca colide com sem marca", () => {
    expect(encontrarDuplicado(ATIVOS, "oleo elixir", null)?.id).toBe("2");
  });

  it("colide também com insumo, como o índice da 011", () => {
    expect(encontrarDuplicado(ATIVOS, "koleston 7.1", "wella")?.id).toBe("3");
  });

  it("ignora o próprio produto na edição", () => {
    expect(
      encontrarDuplicado(ATIVOS, "Máscara Nutritiva", "Wella", "1"),
    ).toBeNull();
  });
});

describe("mensagemDuplicado", () => {
  it("nomeia o existente e a marca", () => {
    expect(mensagemDuplicado(ATIVOS[0])).toContain(
      '"Máscara Nutritiva" (Wella)',
    );
    expect(mensagemDuplicado(ATIVOS[1])).toContain('"Óleo Elixir" (sem marca)');
  });

  it("avisa quando o existente é material de uso", () => {
    expect(mensagemDuplicado(ATIVOS[2])).toContain("material de uso");
  });
});

describe("ordenarProdutos", () => {
  it("põe os sem preço no topo e ordena por nome dentro de cada grupo", () => {
    const ordenados = ordenarProdutos([
      { nome: "Shampoo", preco: 80 },
      { nome: "óleo", preco: null },
      { nome: "Condicionador", preco: 90 },
      { nome: "Ampola", preco: null },
      { nome: "Leave-in", preco: 0.5 },
    ]);

    expect(ordenados.map((p) => p.nome)).toEqual([
      "Ampola",
      "óleo",
      "Condicionador",
      "Leave-in",
      "Shampoo",
    ]);
  });

  it("não altera a lista original", () => {
    const original = [
      { nome: "B", preco: 1 },
      { nome: "A", preco: null },
    ];

    ordenarProdutos(original);

    expect(original[0].nome).toBe("B");
  });
});

describe("produtoCasaComTermo", () => {
  it("ignora acento e caixa", () => {
    expect(produtoCasaComTermo({ nome: "Óleo Elixir" }, "oleo")).toBe(true);
    expect(produtoCasaComTermo({ nome: "Óleo Elixir" }, "ELIX")).toBe(true);
    expect(produtoCasaComTermo({ nome: "Óleo Elixir" }, "shampoo")).toBe(false);
  });

  it("termo vazio casa com tudo", () => {
    expect(produtoCasaComTermo({ nome: "Óleo" }, "  ")).toBe(true);
  });
});
