import { describe, expect, it } from "vitest";

import { hoje } from "@/lib/caixa/mes";

import {
  lerCampos,
  MENSAGEM_ENTRADA_FUTURA,
  novaParte,
  novaPeca,
  pecaSchema,
  type CampoPeca,
} from "./schema";

/**
 * Relativa a hoje, não fixa: a regra do futuro só se testa contra o
 * relógio (mesmo raciocínio do schema.test do Caixa).
 */
function somarDias(data: string, dias: number) {
  const [ano, mes, dia] = data.split("-").map(Number);

  return new Date(Date.UTC(ano, mes - 1, dia + dias))
    .toISOString()
    .slice(0, 10);
}

function validar(campos: Partial<Record<CampoPeca, string>>) {
  return pecaSchema.safeParse({
    codigo: "1254",
    cor: "",
    textura: "",
    gramas: "",
    comprimento_cm: "",
    preco_compra: "",
    preco_venda: "",
    origem: "",
    numero_origem: "",
    data_entrada: "",
    observacoes: "",
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
    expect(
      validar({
        cor: "  ",
        gramas: " ",
        origem: "   ",
        numero_origem: " ",
        observacoes: "  \n  ",
      }).data,
    ).toEqual({
      codigo: "1254",
      cor: null,
      textura: null,
      gramas: null,
      comprimento_cm: null,
      preco_compra: null,
      preco_venda: null,
      origem: null,
      numero_origem: null,
      data_entrada: null,
      observacoes: null,
    });
  });
});

describe("pecaSchema — origem, nº de origem e observações", () => {
  it("gravam com trim", () => {
    const dados = validar({
      origem: "  Sul do Brasil ",
      numero_origem: " A-0091 ",
    }).data;

    expect(dados?.origem).toBe("Sul do Brasil");
    expect(dados?.numero_origem).toBe("A-0091");
  });

  it("observação preserva a quebra de linha do meio", () => {
    expect(
      validar({ observacoes: "  Lacre rompido.\nTroca com a Ana.\n " }).data
        ?.observacoes,
    ).toBe("Lacre rompido.\nTroca com a Ana.");
  });

  it("respeitam o tamanho máximo", () => {
    expect(erroDe("origem", "x".repeat(81))).toBe("Máximo de 80 caracteres");
    expect(erroDe("numero_origem", "x".repeat(41))).toBe("Máximo de 40 caracteres");
    expect(erroDe("observacoes", "x".repeat(1001))).toBe(
      "Máximo de 1000 caracteres",
    );
  });
});

describe("pecaSchema — data de entrada", () => {
  it("vazia vira NULL", () => {
    expect(validar({ data_entrada: "" }).data?.data_entrada).toBeNull();
  });

  it("aceita hoje e o passado", () => {
    expect(validar({ data_entrada: hoje() }).data?.data_entrada).toBe(hoje());
    expect(validar({ data_entrada: "2026-01-15" }).data?.data_entrada).toBe(
      "2026-01-15",
    );
  });

  it("recusa o futuro", () => {
    expect(erroDe("data_entrada", somarDias(hoje(), 1))).toBe(
      MENSAGEM_ENTRADA_FUTURA,
    );
  });

  it("recusa data que não existe", () => {
    expect(erroDe("data_entrada", "2026-02-30")).toBe("Data inválida");
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

describe("novaParte", () => {
  it("grava a parte apontando para a mãe", () => {
    const dados = validar({ codigo: "1254-a" }).data!;

    expect(novaParte(dados, "mae")).toEqual({ ...dados, peca_mae_id: "mae" });
  });
});

describe("lerCampos", () => {
  it("fica só com os campos previstos, e o que não é texto vira vazio", () => {
    const campos = lerCampos({ codigo: "1254-a", gramas: 50, peca_mae_id: "x" });

    expect(campos.codigo).toBe("1254-a");
    expect(campos.gramas).toBe("");
    expect(campos).not.toHaveProperty("peca_mae_id");
    expect(Object.keys(campos)).toHaveLength(11);
  });

  it("aceita lixo sem quebrar", () => {
    expect(lerCampos(null).codigo).toBe("");
    expect(lerCampos("1254").codigo).toBe("");
  });
});
