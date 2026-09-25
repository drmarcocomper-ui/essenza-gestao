import { describe, expect, it, vi } from "vitest";

type Linha = Record<string, string | number | null>;

/**
 * PostgREST de mentira, sobre linhas em memória: avalia de verdade os
 * filtros que a consulta monta (`gte`, `lte`, `eq` e o `or` com `and`),
 * para o teste pegar erro na string do filtro, e não só na regra.
 */
const { linhas } = vi.hoisted(() => ({ linhas: [] as Linha[] }));

function condicao(texto: string): (linha: Linha) => boolean {
  const [coluna, operador, ...resto] = texto.split(".");
  const valor = resto.join(".");

  return (linha) => {
    const atual = linha[coluna!] ?? null;

    if (operador === "is" && valor === "null") return atual === null;
    // Comparação com null é falsa no SQL.
    if (atual === null) return false;
    if (operador === "eq") return String(atual) === valor;
    if (operador === "gte") return String(atual) >= valor;
    if (operador === "lte") return String(atual) <= valor;

    throw new Error(`Operador não suportado no teste: ${texto}`);
  };
}

function ou(filtro: string): (linha: Linha) => boolean {
  const grupos = [...filtro.matchAll(/and\(([^()]*)\)/g)];

  // Falha alto se aparecer sintaxe que este avaliador não entende.
  expect(grupos.map((g) => g[0]).join(",")).toBe(filtro);

  const ramos = grupos.map((g) => g[1]!.split(",").map(condicao));

  return (linha) => ramos.some((ramo) => ramo.every((c) => c(linha)));
}

vi.mock("@/lib/auth", () => ({
  exigirSessao: async () => ({
    supabase: {
      from: () => ({
        select: () => {
          const filtros: ((linha: Linha) => boolean)[] = [];
          const consulta = {
            gte: (c: string, v: string) => (
              filtros.push(condicao(`${c}.gte.${v}`)), consulta
            ),
            lte: (c: string, v: string) => (
              filtros.push(condicao(`${c}.lte.${v}`)), consulta
            ),
            eq: (c: string, v: string) => (
              filtros.push(condicao(`${c}.eq.${v}`)), consulta
            ),
            or: (f: string) => (filtros.push(ou(f)), consulta),
            order: () => consulta,
            then: (resolver: (r: unknown) => void) =>
              resolver({
                data: linhas.filter((l) => filtros.every((f) => f(l))),
                error: null,
              }),
          };

          return consulta;
        },
      }),
    },
  }),
}));

import { listarLancamentos, obterResumoCaixa } from "./consultas";

// Atendimento de 23/09 em 3x no crédito: previsão D+30 por parcela.
const parcela = (n: number, data_prevista: string): Linha => ({
  id: `parcela-${n}`,
  data_competencia: "2026-09-23",
  data_caixa: null,
  data_prevista,
  tipo: "Entrada",
  status: "Pendente",
  valor: 100,
});

linhas.push(
  parcela(1, "2026-10-23"),
  parcela(2, "2026-11-22"),
  parcela(3, "2026-12-22"),
  {
    id: "pix-setembro",
    data_competencia: "2026-09-10",
    data_caixa: "2026-09-10",
    data_prevista: null,
    tipo: "Entrada",
    status: "Pago",
    valor: 180,
  },
  {
    // Vendido em setembro, recebido só em outubro.
    id: "confianca-recebida",
    data_competencia: "2026-09-28",
    data_caixa: "2026-10-02",
    data_prevista: null,
    tipo: "Entrada",
    status: "Pago",
    valor: 90,
  },
  {
    id: "boleto-sem-previsao",
    data_competencia: "2026-10-05",
    data_caixa: null,
    data_prevista: null,
    tipo: "Saída",
    status: "Pendente",
    valor: 420,
  },
);

const ids = async (mes: string, visao: "caixa" | "competencia") =>
  (await listarLancamentos({ mes, visao })).map((l) => l.id).sort();

describe("listarLancamentos — visão Caixa × Competência", () => {
  it("parcela 1/3 de 23/09 cai em outubro no Caixa e em setembro na Competência", async () => {
    expect(await ids("2026-10", "caixa")).toContain("parcela-1");
    expect(await ids("2026-09", "caixa")).not.toContain("parcela-1");

    expect(await ids("2026-09", "competencia")).toContain("parcela-1");
    expect(await ids("2026-10", "competencia")).not.toContain("parcela-1");
  });

  it("no Caixa, cada parcela no mês da sua previsão", async () => {
    expect(await ids("2026-11", "caixa")).toEqual(["parcela-2"]);
    expect(await ids("2026-12", "caixa")).toEqual(["parcela-3"]);
  });

  it("Pago vai pela data de caixa; Pendente sem previsão, pela competência", async () => {
    expect(await ids("2026-09", "caixa")).toEqual(["pix-setembro"]);
    expect(await ids("2026-10", "caixa")).toEqual([
      "boleto-sem-previsao",
      "confianca-recebida",
      "parcela-1",
    ]);
  });

  it("Competência continua pela data da venda", async () => {
    expect(await ids("2026-09", "competencia")).toEqual([
      "confianca-recebida",
      "parcela-1",
      "parcela-2",
      "parcela-3",
      "pix-setembro",
    ]);
  });

  it("no Caixa, ordena pela data de referência, a mais recente em cima", async () => {
    const lista = await listarLancamentos({ mes: "2026-10", visao: "caixa" });

    expect(lista.map((l) => l.id)).toEqual([
      "parcela-1", // 23/10, previsto
      "boleto-sem-previsao", // 05/10, pela competência
      "confianca-recebida", // 02/10, data de caixa
    ]);
  });
});

describe("obterResumoCaixa", () => {
  it("soma o mês pela data de referência, separando Pago de Pendente", async () => {
    expect(await obterResumoCaixa("2026-10")).toEqual({
      recebido: 90,
      pago: 0,
      saldo: 90,
      aReceber: 100,
      aPagar: 420,
      saldoPrevisto: -320,
    });
  });
});
