import { describe, expect, it } from "vitest";

import { lerFiltros, linkCaixa, statusDoSlug, tipoDoSlug } from "./url";

describe("lerFiltros", () => {
  it("lê mês, tipo e status da URL", () => {
    expect(
      lerFiltros({ mes: "2026-03", tipo: "saida", status: "pendente" }),
    ).toEqual({ mes: "2026-03", tipo: "saida", status: "pendente" });
  });

  it("cai no padrão quando o filtro vem torto", () => {
    const filtros = lerFiltros({ mes: "banana", tipo: "qualquer" });

    expect(filtros.tipo).toBe("todos");
    expect(filtros.status).toBe("todos");
    // Sem mês válido, abre no mês corrente.
    expect(filtros.mes).toMatch(/^\d{4}-\d{2}$/);
  });
});

describe("slug → valor do banco", () => {
  it("devolve o rótulo com acento que a coluna guarda", () => {
    expect(tipoDoSlug("saida")).toBe("Saída");
    expect(tipoDoSlug("entrada")).toBe("Entrada");
    expect(tipoDoSlug("todos")).toBe("Todos");
    expect(statusDoSlug("pendente")).toBe("Pendente");
  });
});

describe("linkCaixa", () => {
  it("leva sempre o mês", () => {
    expect(
      linkCaixa({ mes: "2026-09", tipo: "todos", status: "todos" }),
    ).toBe("/caixa?mes=2026-09");
  });

  it("não escreve filtro que está no padrão", () => {
    expect(
      linkCaixa({ mes: "2026-09", tipo: "entrada", status: "todos" }),
    ).toBe("/caixa?mes=2026-09&tipo=entrada");
  });

  it("leva os dois filtros quando os dois estão ligados", () => {
    expect(
      linkCaixa({ mes: "2026-09", tipo: "saida", status: "pago" }),
    ).toBe("/caixa?mes=2026-09&tipo=saida&status=pago");
  });
});
