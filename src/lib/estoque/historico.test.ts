import { describe, expect, it } from "vitest";

import type { Movimentos } from "./consultas";
import { montarHistorico, ultimoCustoPago } from "./historico";

function as(data: string, hora: string) {
  return `${data}T${hora}+00:00`;
}

const MOVIMENTOS: Movimentos = {
  contagens: [
    {
      id: "c1",
      data: "2026-09-10",
      registradoEm: as("2026-09-10", "14:00:00"),
      quantidade: 5,
      observacao: null,
    },
  ],
  entradas: [
    {
      compraId: "k1",
      fornecedor: "Distribuidora",
      data: "2026-09-01",
      registradoEm: as("2026-09-01", "10:00:00"),
      quantidade: 6,
      custoUnitario: 80,
    },
    {
      compraId: "k2",
      fornecedor: "Distribuidora",
      data: "2026-09-12",
      registradoEm: as("2026-09-12", "10:00:00"),
      quantidade: 2,
      custoUnitario: 85.5,
    },
  ],
  saidas: [
    {
      atendimentoId: "a1",
      clienteId: "cl1",
      clienteNome: "Ana",
      data: "2026-09-12",
      fechadaEm: as("2026-09-12", "18:00:00"),
      quantidade: 1,
    },
    {
      atendimentoId: "a2",
      clienteId: "cl2",
      clienteNome: "Bia",
      data: "2026-09-13",
      fechadaEm: null,
      quantidade: 1,
    },
  ],
};

describe("montarHistorico", () => {
  it("mais recente primeiro, e no mesmo dia o registrado por último", () => {
    expect(
      montarHistorico(MOVIMENTOS).map((evento) => evento.tipo + ":" + evento.data),
    ).toEqual([
      "venda:2026-09-13",
      "venda:2026-09-12",
      "compra:2026-09-12",
      "contagem:2026-09-10",
      "compra:2026-09-01",
    ]);
  });

  it("diz por que uma linha ficou fora do saldo", () => {
    const [aberta, fechada, depois, contagem, antes] = montarHistorico(MOVIMENTOS);

    expect(aberta.tipo === "venda" && aberta.foraDoSaldo).toBe("Conta aberta");
    expect(fechada.tipo === "venda" && fechada.foraDoSaldo).toBeNull();
    expect(depois.tipo === "compra" && depois.foraDoSaldo).toBeNull();
    expect(contagem.tipo === "contagem" && contagem.vigente).toBe(true);
    expect(antes.tipo === "compra" && antes.foraDoSaldo).toBe("Antes da contagem");
  });
});

describe("ultimoCustoPago", () => {
  it("é o custo da compra mais recente", () => {
    expect(ultimoCustoPago(MOVIMENTOS.entradas)).toBe(85.5);
    expect(ultimoCustoPago([...MOVIMENTOS.entradas].reverse())).toBe(85.5);
  });

  it("null sem compra", () => {
    expect(ultimoCustoPago([])).toBeNull();
  });
});
