import { describe, expect, it } from "vitest";

import {
  filtrosNaBusca,
  lerFiltros,
  linkCaixa,
  linkEditarLancamento,
  linkNovoLancamento,
  linkPendentes,
  statusDoSlug,
  tipoDoSlug,
  voltaCaixa,
  voltaDaOrigem,
} from "./url";

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

describe("Voltar das telas abertas pelo Caixa", () => {
  const competencia = {
    mes: "2026-03",
    tipo: "todos",
    status: "todos",
    visao: "competencia",
  } as const;

  /** O `?origem=` do link, como a página de destino o recebe. */
  function origemDoLink(link: string) {
    return new URL(link, "http://x").searchParams.get("origem") ?? undefined;
  }

  it("editar lançamento vindo da visão Competência volta com a visão e o mês", () => {
    const link = linkEditarLancamento("abc", linkCaixa(competencia));

    expect(voltaDaOrigem(origemDoLink(link))).toEqual({
      href: "/caixa?mes=2026-03&visao=competencia",
      rotulo: "Caixa",
    });
  });

  it("volta com os filtros de tipo e status também", () => {
    const filtros = { ...competencia, tipo: "saida", status: "pendente" } as const;
    const link = linkEditarLancamento("abc", linkCaixa(filtros));

    expect(voltaDaOrigem(origemDoLink(link)).href).toBe(linkCaixa(filtros));
  });

  it("novo lançamento: o tipo do formulário não se mistura com o filtro", () => {
    const link = linkNovoLancamento("saida", linkCaixa(competencia));
    const busca = new URL(link, "http://x").searchParams;

    expect(busca.get("tipo")).toBe("saida");
    expect(voltaDaOrigem(busca.get("origem") ?? undefined).href).toBe(
      "/caixa?mes=2026-03&visao=competencia",
    );
  });

  it("editar vindo do A receber volta ao A receber, que volta ao Caixa de origem", () => {
    const pendentes = linkPendentes(competencia);
    const volta = voltaDaOrigem(
      origemDoLink(linkEditarLancamento("abc", pendentes)),
    );

    expect(volta).toEqual({ href: pendentes, rotulo: "A receber" });

    const busca = Object.fromEntries(new URL(volta.href, "http://x").searchParams);
    expect(voltaCaixa(busca)).toBe("/caixa?mes=2026-03&visao=competencia");
  });

  it("editar vindo do Relatório volta ao relatório do mesmo mês", () => {
    const link = linkEditarLancamento("abc", "/caixa/relatorio?mes=2026-03");

    expect(voltaDaOrigem(origemDoLink(link))).toEqual({
      href: "/caixa/relatorio?mes=2026-03",
      rotulo: "Relatório",
    });
  });

  it("sem origem, cai no /caixa padrão", () => {
    expect(linkEditarLancamento("abc")).toBe("/caixa/abc/editar");
    expect(voltaDaOrigem(undefined)).toEqual({ href: "/caixa", rotulo: "Caixa" });
    expect(voltaCaixa({})).toBe("/caixa");
    expect(linkPendentes(filtrosNaBusca({}))).toBe("/caixa/pendentes");
  });

  it.each([
    "https://exemplo.com/caixa",
    "//exemplo.com/caixa",
    "/clientes",
    "/caixa/../clientes",
    "javascript:alert(1)",
  ])("origem %s não vira link: cai no /caixa padrão", (origem) => {
    expect(voltaDaOrigem(origem)).toEqual({ href: "/caixa", rotulo: "Caixa" });
  });

  it("origem com filtro torto é relida pelo padrão", () => {
    expect(voltaDaOrigem("/caixa?mes=banana&visao=competencia").href).toMatch(
      /^\/caixa\?mes=\d{4}-\d{2}&visao=competencia$/,
    );
  });
});
