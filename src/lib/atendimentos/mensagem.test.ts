import { describe, expect, it } from "vitest";

import { linkDaMensagem, mensagemDoAtendimento } from "./mensagem";

describe("mensagemDoAtendimento", () => {
  const texto = mensagemDoAtendimento({
    cliente: { nome: "  Ana Paula Souza " },
    data: "2026-09-05",
    itens: [
      { descricao: "Escova", quantidade: 1, valorUnitario: 150 },
      { descricao: "Máscara Reparadora", quantidade: 2, valorUnitario: 60 },
      { descricao: "Hidratação", quantidade: 1, valorUnitario: 0 },
      { descricao: "Extensão 1254", quantidade: 1, valorUnitario: 900.5 },
    ],
  });

  it("monta a mensagem inteira no formato combinado", () => {
    expect(texto).toBe(
      [
        "Olá, Ana! Segue o resumo do seu atendimento de 05/09/2026 na Essenza:",
        "",
        "• Escova — R$ 150,00",
        "• 2× Máscara Reparadora — R$ 120,00",
        "• Hidratação — cortesia",
        "• Extensão 1254 — R$ 900,50",
        "",
        "Total: R$ 1.170,50",
        "Obrigada pela preferência! 💛",
      ].join("\n"),
    );
  });

  it("quantidade 1 não aparece", () => {
    expect(texto).not.toContain("1× ");
  });

  it("item a zero nunca sai R$ 0,00", () => {
    expect(texto).not.toContain("R$ 0,00");
  });

  it("sem espaço não quebrável do Intl", () => {
    expect(texto).not.toContain(" ");
  });
});

describe("linkDaMensagem", () => {
  it("com telefone abre a conversa da cliente, texto codificado", () => {
    expect(linkDaMensagem("(27) 99999-1234", "Olá, Ana! 💛\nTotal: R$ 1,00")).toBe(
      `https://wa.me/5527999991234?text=${encodeURIComponent("Olá, Ana! 💛\nTotal: R$ 1,00")}`,
    );
  });

  it("sem telefone válido deixa ela escolher o contato", () => {
    expect(linkDaMensagem(null, "oi")).toBe("https://wa.me/?text=oi");
    expect(linkDaMensagem("123", "oi")).toBe("https://wa.me/?text=oi");
  });
});
