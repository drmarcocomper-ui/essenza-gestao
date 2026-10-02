import { describe, expect, it } from "vitest";

import { hoje } from "@/lib/caixa/mes";

import { MENSAGEM_PRODUTO_REPETIDO } from "./regras";
import {
  contagemSchema,
  lerCompra,
  MENSAGEM_DATA_FUTURA,
  MENSAGEM_QUANTIDADE_INTEIRA,
  MENSAGEM_SEM_ITENS,
  validarCompra,
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

const PRODUTO_A = "11111111-1111-1111-1111-111111111111";
const PRODUTO_B = "22222222-2222-2222-2222-222222222222";

function compra(
  campos: Partial<Record<"fornecedor" | "data" | "observacoes", string>> = {},
  itens: Partial<Record<"produto_id" | "quantidade" | "custo_unitario", string>>[] = [
    {},
  ],
) {
  return validarCompra(
    lerCompra({
      fornecedor: "Distribuidora Sul",
      data: hoje(),
      observacoes: "",
      ...campos,
      itens: itens.map((item) => ({
        produto_id: PRODUTO_A,
        quantidade: "2",
        custo_unitario: "85,50",
        ...item,
      })),
    }),
  );
}

describe("validarCompra", () => {
  it("aceita a compra e converte quantidade e custo", () => {
    expect(compra()).toEqual({
      ok: true,
      dados: {
        fornecedor: "Distribuidora Sul",
        data: hoje(),
        observacoes: null,
        itens: [{ produto_id: PRODUTO_A, quantidade: 2, custo_unitario: 85.5 }],
      },
    });
  });

  it("custo zero é dado (brinde); negativo e vazio não", () => {
    expect(compra({}, [{ custo_unitario: "0,00" }]).ok).toBe(true);

    const negativo = compra({}, [{ custo_unitario: "-1,00" }]);
    const vazio = compra({}, [{ custo_unitario: "" }]);

    expect(!negativo.ok && negativo.errosItens[0].custo_unitario).toBe(
      "O custo não pode ser negativo",
    );
    expect(!vazio.ok && vazio.errosItens[0].custo_unitario).toBe("Informe o custo");
  });

  it.each(["1,5", "2.5"])("recusa fração na quantidade (%s)", (quantidade) => {
    const resultado = compra({}, [{ quantidade }]);

    expect(!resultado.ok && resultado.errosItens[0].quantidade).toBe(
      MENSAGEM_QUANTIDADE_INTEIRA,
    );
  });

  it("recusa quantidade zero", () => {
    const resultado = compra({}, [{ quantidade: "0" }]);

    expect(!resultado.ok && resultado.errosItens[0].quantidade).toBe(
      "Tem que ser pelo menos 1",
    );
  });

  it("recusa o mesmo produto duas vezes, na segunda linha", () => {
    const resultado = compra({}, [{}, { produto_id: PRODUTO_B }, { quantidade: "1" }]);

    expect(resultado.ok).toBe(false);
    expect(!resultado.ok && resultado.errosItens).toEqual([
      {},
      {},
      { produto_id: MENSAGEM_PRODUTO_REPETIDO },
    ]);
  });

  it("recusa data futura", () => {
    const resultado = compra({ data: somarDias(hoje(), 1) });

    expect(!resultado.ok && resultado.erros.data).toBe(MENSAGEM_DATA_FUTURA);
  });

  it("exige fornecedor e pelo menos um produto", () => {
    const semFornecedor = compra({ fornecedor: "   " });
    const semItens = compra({}, []);

    expect(!semFornecedor.ok && semFornecedor.erros.fornecedor).toBe(
      "Informe o fornecedor",
    );
    expect(!semItens.ok && semItens.mensagem).toBe(MENSAGEM_SEM_ITENS);
  });

  it("não confia na forma do que chega da tela", () => {
    const resultado = validarCompra(
      lerCompra({ fornecedor: 1, itens: [{ produto_id: null }, "lixo"] }),
    );

    expect(resultado.ok).toBe(false);
    expect(!resultado.ok && resultado.errosItens).toHaveLength(2);
  });
});
