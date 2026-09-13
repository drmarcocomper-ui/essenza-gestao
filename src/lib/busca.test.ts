import { describe, expect, it } from "vitest";

import { clienteCasaComTermo, normalizar } from "./busca";

describe("normalizar", () => {
  it("tira acento e maiúscula", () => {
    expect(normalizar("Jéssica")).toBe("jessica");
    expect(normalizar("CONCEIÇÃO")).toBe("conceicao");
    expect(normalizar("Ângela Nóbrega")).toBe("angela nobrega");
  });

  it("colapsa espaços das pontas e do meio", () => {
    expect(normalizar("  Ana   Paula ")).toBe("ana paula");
  });

  it("aceita nulo", () => {
    expect(normalizar(null)).toBe("");
  });
});

describe("clienteCasaComTermo", () => {
  const jessica = { nome: "Jéssica Conceição", telefone: "27999998888" };

  it("acha por nome parcial ignorando acento e caixa", () => {
    expect(clienteCasaComTermo(jessica, "jess")).toBe(true);
    expect(clienteCasaComTermo(jessica, "JÉSSICA")).toBe(true);
    expect(clienteCasaComTermo(jessica, "conceicao")).toBe(true);
  });

  it("acha por sobrenome no meio do nome", () => {
    expect(clienteCasaComTermo(jessica, "ceiç")).toBe(true);
  });

  it("acha por telefone, com ou sem máscara", () => {
    expect(clienteCasaComTermo(jessica, "99999")).toBe(true);
    expect(clienteCasaComTermo(jessica, "(27) 9999")).toBe(true);
  });

  it("não acha quem não casa", () => {
    expect(clienteCasaComTermo(jessica, "mariana")).toBe(false);
    expect(clienteCasaComTermo(jessica, "12345")).toBe(false);
  });

  it("termo vazio deixa tudo passar", () => {
    expect(clienteCasaComTermo(jessica, "")).toBe(true);
    expect(clienteCasaComTermo(jessica, "   ")).toBe(true);
  });

  it("não quebra com cliente sem telefone", () => {
    expect(clienteCasaComTermo({ nome: "Ana", telefone: null }, "9999")).toBe(
      false,
    );
  });
});
