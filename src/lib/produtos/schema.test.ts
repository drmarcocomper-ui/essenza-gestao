import { describe, expect, it } from "vitest";

import {
  MENSAGEM_PRECO_ZERO,
  novoProdutoDoCatalogo,
  produtoSchema,
} from "./schema";

function validar(campos: Partial<Record<"nome" | "marca" | "preco_venda", string>>) {
  return produtoSchema.safeParse({
    nome: "Óleo Elixir",
    marca: "",
    preco_venda: "",
    ...campos,
  });
}

function erroDoPreco(preco: string) {
  const resultado = validar({ preco_venda: preco });

  expect(resultado.success).toBe(false);

  return resultado.error?.issues.find((i) => i.path[0] === "preco_venda")
    ?.message;
}

describe("produtoSchema — preço", () => {
  it("vazio grava NULL", () => {
    expect(validar({ preco_venda: "" }).data?.preco_venda).toBeNull();
    expect(validar({ preco_venda: "   " }).data?.preco_venda).toBeNull();
  });

  it("recusa zero, com a mensagem de deixar em branco", () => {
    expect(erroDoPreco("0")).toBe(MENSAGEM_PRECO_ZERO);
    expect(erroDoPreco("0,00")).toBe(MENSAGEM_PRECO_ZERO);
  });

  it("aceita vírgula decimal", () => {
    expect(validar({ preco_venda: "89,90" }).data?.preco_venda).toBe(89.9);
    expect(validar({ preco_venda: "1.234,50" }).data?.preco_venda).toBe(1234.5);
    expect(validar({ preco_venda: "0,50" }).data?.preco_venda).toBe(0.5);
  });

  it("recusa texto e negativo", () => {
    expect(erroDoPreco("abc")).toBe("Preço inválido");
    expect(erroDoPreco("-10,00")).toBe("O preço não pode ser negativo");
  });
});

describe("produtoSchema — nome e marca", () => {
  it("exige nome", () => {
    const resultado = validar({ nome: "   " });

    expect(resultado.success).toBe(false);
    expect(resultado.error?.issues[0].path[0]).toBe("nome");
  });

  it("marca vazia vira null e preenchida perde espaço das pontas", () => {
    expect(validar({ marca: "" }).data?.marca).toBeNull();
    expect(validar({ marca: " Wella " }).data?.marca).toBe("Wella");
  });
});

describe("novoProdutoDoCatalogo", () => {
  it("grava revenda, un e origem catalogo", () => {
    expect(
      novoProdutoDoCatalogo({ nome: "Óleo", marca: null, preco_venda: null }),
    ).toEqual({
      nome: "Óleo",
      marca: null,
      preco_venda: null,
      tipo: "revenda",
      unidade: "un",
      origem_registro: "catalogo",
    });
  });
});
