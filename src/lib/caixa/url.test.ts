import { describe, expect, it } from "vitest";

import { lerFiltros, linkCaixa, statusDoSlug, tipoDoSlug } from "./url";

describe("lerFiltros", () => {
  it("lê mês, tipo, status e visão da URL", () => {
    expect(
      lerFiltros({
        mes: "2026-03",
        tipo: "saida",
        status: "pendente",
        visao: "competencia",
      }),
    ).toEqual({
      mes: "2026-03",
      tipo: "saida",
      status: "pendente",
      visao: "competencia",
    });
  });

  it("cai no padrão quando o filtro vem torto", () => {
    const filtros = lerFiltros({ mes: "banana", tipo: "qualquer", visao: "x" });

    expect(filtros.tipo).toBe("todos");
    expect(filtros.status).toBe("todos");
    expect(filtros.visao).toBe("caixa");
    // Sem mês válido, abre no mês corrente.
    expect(filtros.mes).toMatch(/^\d{4}-\d{2}$/);
  });

  it("abre na visão Caixa quando a URL não diz qual", () => {
    expect(lerFiltros({ mes: "2026-09" }).visao).toBe("caixa");
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
      linkCaixa({ mes: "2026-09", tipo: "todos", status: "todos", visao: "caixa" }),
    ).toBe("/caixa?mes=2026-09");
  });

  it("não escreve filtro que está no padrão", () => {
    expect(
      linkCaixa({
        mes: "2026-09",
        tipo: "entrada",
        status: "todos",
        visao: "caixa",
      }),
    ).toBe("/caixa?mes=2026-09&tipo=entrada");
  });

  it("leva os dois filtros quando os dois estão ligados", () => {
    expect(
      linkCaixa({ mes: "2026-09", tipo: "saida", status: "pago", visao: "caixa" }),
    ).toBe("/caixa?mes=2026-09&tipo=saida&status=pago");
  });

  it("leva a visão Competência, que não é o padrão", () => {
    expect(
      linkCaixa({
        mes: "2026-09",
        tipo: "todos",
        status: "todos",
        visao: "competencia",
      }),
    ).toBe("/caixa?mes=2026-09&visao=competencia");
  });
});
