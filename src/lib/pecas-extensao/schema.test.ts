import { describe, expect, it } from "vitest";

import { novaPeca, pecaSchema, type CampoPeca } from "./schema";

function validar(campos: Partial<Record<CampoPeca, string>>) {
  return pecaSchema.safeParse({
    codigo: "1254",
    cor: "",
    textura: "",
    gramas: "",
    comprimento_cm: "",
    preco_compra: "",
    preco_venda: "",
    ...campos,
  });
}

function erroDe(campo: CampoPeca, valor: string) {
  const resultado = validar({ [campo]: valor });

  expect(resultado.success).toBe(false);

  return resultado.error?.issues.find((i) => i.path[0] === campo)?.message;
}

describe("pecaSchema — código", () => {
  it.each(["", "   "])("recusa %j", (codigo) => {
    expect(erroDe("codigo", codigo)).toBe("Informe o código da peça");
  });

  it("tira espaço das pontas e preserva a caixa", () => {
    expect(validar({ codigo: "  1254-B " }).data?.codigo).toBe("1254-B");
  });
});

describe("pecaSchema — vazio vira NULL", () => {
  it("todos os opcionais em branco gravam NULL", () => {
    expect(validar({ cor: "  ", gramas: " " }).data).toEqual({
      codigo: "1254",
      cor: null,
      textura: null,
      gramas: null,
      comprimento_cm: null,
      preco_compra: null,
      preco_venda: null,
    });
  });
});

describe("pecaSchema — gramas e comprimento", () => {
  it("recusam zero", () => {
    expect(erroDe("gramas", "0")).toContain("maior que zero");
    expect(erroDe("gramas", "0,00")).toContain("maior que zero");
    expect(erroDe("comprimento_cm", "0")).toContain("maior que zero");
  });

  it("recusam negativo e texto", () => {
    expect(erroDe("gramas", "-5")).toContain("maior que zero");
    expect(erroDe("comprimento_cm", "abc")).toBe("Número inválido");
  });

  it("aceitam vírgula decimal", () => {
    expect(validar({ gramas: "100" }).data?.gramas).toBe(100);
    expect(validar({ gramas: "12,5" }).data?.gramas).toBe(12.5);
    expect(validar({ comprimento_cm: "55,5" }).data?.comprimento_cm).toBe(55.5);
  });

  it("recusam mais casas do que a coluna guarda", () => {
    expect(erroDe("comprimento_cm", "55,25")).toBe("Use no máximo 1 casa decimal");
    expect(erroDe("gramas", "12,345")).toBe("Use no máximo 2 casas decimais");
  });

  it("respeitam o teto de numeric(6,1) no comprimento", () => {
    expect(erroDe("comprimento_cm", "100000")).toContain("alto demais");
  });
});

describe("pecaSchema — preços", () => {
  it("zero é aceito e é diferente de vazio", () => {
    expect(validar({ preco_compra: "0,00" }).data?.preco_compra).toBe(0);
    expect(validar({ preco_venda: "0" }).data?.preco_venda).toBe(0);
    expect(validar({ preco_venda: "" }).data?.preco_venda).toBeNull();
  });

  it("lê o que a máscara de moeda escreve", () => {
    expect(validar({ preco_compra: "1.234,50" }).data?.preco_compra).toBe(1234.5);
  });

  it("recusa negativo e texto", () => {
    expect(erroDe("preco_compra", "-1,00")).toBe("O preço não pode ser negativo");
    expect(erroDe("preco_venda", "abc")).toBe("Preço inválido");
  });
});

describe("novaPeca", () => {
  it("grava peça inteira, sem mãe", () => {
    const dados = validar({ codigo: "1254" }).data!;

    expect(novaPeca(dados)).toEqual({ ...dados, peca_mae_id: null });
  });
});
