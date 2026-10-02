import { describe, expect, it } from "vitest";

import { hoje } from "@/lib/caixa/mes";

import {
  contagemSchema,
  MENSAGEM_DATA_FUTURA,
  MENSAGEM_QUANTIDADE_INTEIRA,
  type CampoContagem,
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

function erroDe<C extends string>(
  resultado: { success: boolean; error?: { issues: { path: PropertyKey[]; message: string }[] } },
  campo: C,
) {
  expect(resultado.success).toBe(false);

  return resultado.error?.issues.find((i) => i.path[0] === campo)?.message;
}

function contar(campos: Partial<Record<CampoContagem, string>>) {
  return contagemSchema.safeParse({
    data: hoje(),
    quantidade: "3",
    observacao: "",
    ...campos,
  });
}

describe("contagemSchema", () => {
  it("aceita inteiro, zero e observação vazia como null", () => {
    expect(contar({}).data).toEqual({
      data: hoje(),
      quantidade: 3,
      observacao: null,
    });
    expect(contar({ quantidade: "0" }).data?.quantidade).toBe(0);
  });

  it.each(["1,5", "1.5", "0,5", ",5"])("recusa fração %s", (quantidade) => {
    expect(erroDe(contar({ quantidade }), "quantidade")).toBe(
      MENSAGEM_QUANTIDADE_INTEIRA,
    );
  });

  it("recusa negativo, vazio e texto", () => {
    expect(erroDe(contar({ quantidade: "-1" }), "quantidade")).toBe(
      "Não pode ser negativa",
    );
    expect(erroDe(contar({ quantidade: "" }), "quantidade")).toBe(
      "Informe a quantidade",
    );
    expect(erroDe(contar({ quantidade: "abc" }), "quantidade")).toBe(
      "Quantidade inválida",
    );
  });

  it("recusa data futura e aceita hoje e ontem", () => {
    expect(erroDe(contar({ data: somarDias(hoje(), 1) }), "data")).toBe(
      MENSAGEM_DATA_FUTURA,
    );
    expect(contar({ data: somarDias(hoje(), -1) }).success).toBe(true);
  });

  it("exige data válida", () => {
    expect(erroDe(contar({ data: "" }), "data")).toBe("Informe a data");
    expect(erroDe(contar({ data: "2026-02-30" }), "data")).toBe("Data inválida");
  });
});
