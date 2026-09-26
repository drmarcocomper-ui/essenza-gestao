import { describe, expect, it } from "vitest";

import { resumoReabertura, textoReabertura } from "./reabertura";

const credito = (status: "Pago" | "Pendente") => ({
  status,
  formaPagamento: "Cartão de crédito",
});

describe("resumoReabertura", () => {
  it("conta toda linha e só o crédito confirmado", () => {
    expect(
      resumoReabertura([
        credito("Pago"),
        credito("Pendente"),
        credito("Pago"),
        { status: "Pago", formaPagamento: "Pix" },
        { status: "Pago", formaPagamento: null },
      ]),
    ).toEqual({ lancamentos: 5, confirmadas: 2 });
  });

  it("Pix e dinheiro pagos não pedem nova confirmação", () => {
    expect(
      resumoReabertura([
        { status: "Pago", formaPagamento: "Dinheiro" },
        { status: "Pago", formaPagamento: "Cartão de débito" },
      ]),
    ).toEqual({ lancamentos: 2, confirmadas: 0 });
  });
});

describe("textoReabertura", () => {
  it("sem parcela confirmada: uma frase só", () => {
    expect(textoReabertura({ lancamentos: 3, confirmadas: 0 })).toEqual([
      "Reabrir a conta apaga 3 lançamentos do Caixa. Os itens ficam, e a conta pode ser fechada de novo.",
    ]);
  });

  it("singular", () => {
    expect(textoReabertura({ lancamentos: 1, confirmadas: 1 })).toEqual([
      "Reabrir a conta apaga 1 lançamento do Caixa. Os itens ficam, e a conta pode ser fechada de novo.",
      "1 parcela já confirmada como recebida terá de ser confirmada de novo em A receber.",
    ]);
  });

  it("plural", () => {
    expect(textoReabertura({ lancamentos: 3, confirmadas: 2 })[1]).toBe(
      "2 parcelas já confirmadas como recebidas terão de ser confirmadas de novo em A receber.",
    );
  });
});
