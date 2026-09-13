import { describe, expect, it } from "vitest";

import {
  apenasDigitos,
  formatarData,
  formatarMoeda,
  formatarTelefone,
  linkWhatsApp,
  mascararTelefone,
} from "./formatters";

describe("formatarMoeda", () => {
  it("formata em real com duas casas", () => {
    //   = espaço não separável, que o Intl usa depois do R$.
    expect(formatarMoeda(1234.5)).toBe("R$ 1.234,50");
    expect(formatarMoeda(0)).toBe("R$ 0,00");
  });

  it("aceita a string que o Supabase devolve em colunas numeric", () => {
    expect(formatarMoeda("180.00")).toBe("R$ 180,00");
  });

  it("cai para zero em valor ausente ou inválido", () => {
    expect(formatarMoeda(null)).toBe("R$ 0,00");
    expect(formatarMoeda("abc")).toBe("R$ 0,00");
  });
});

describe("formatarTelefone", () => {
  it("formata celular com 11 dígitos", () => {
    expect(formatarTelefone("27999998888")).toBe("(27) 99999-8888");
  });

  it("formata fixo com 10 dígitos", () => {
    expect(formatarTelefone("2733334444")).toBe("(27) 3333-4444");
  });

  it("devolve o valor original quando o tamanho não é reconhecido", () => {
    expect(formatarTelefone("123")).toBe("123");
    expect(formatarTelefone(null)).toBe("");
  });
});

describe("mascararTelefone", () => {
  it("aplica a máscara enquanto digita", () => {
    expect(mascararTelefone("2")).toBe("2");
    expect(mascararTelefone("27")).toBe("27");
    expect(mascararTelefone("279")).toBe("(27) 9");
    expect(mascararTelefone("279999")).toBe("(27) 9999");
    expect(mascararTelefone("2799999")).toBe("(27) 9999-9");
    expect(mascararTelefone("27999998888")).toBe("(27) 99999-8888");
  });

  it("ignora o que passa de 11 dígitos", () => {
    expect(mascararTelefone("279999988889999")).toBe("(27) 99999-8888");
  });
});

describe("apenasDigitos", () => {
  it("tira máscara e espaços", () => {
    expect(apenasDigitos("(27) 99999-8888")).toBe("27999998888");
    expect(apenasDigitos(null)).toBe("");
  });
});

describe("formatarData", () => {
  it("converte date do Postgres para dd/MM/yyyy", () => {
    expect(formatarData("2026-03-14")).toBe("14/03/2026");
  });

  it("não desloca o dia por causa de fuso", () => {
    // `new Date('2026-01-01')` seria 31/12/2025 em fuso negativo.
    expect(formatarData("2026-01-01")).toBe("01/01/2026");
  });

  it("aceita timestamptz cortando a hora", () => {
    expect(formatarData("2026-03-14T20:30:00Z")).toBe("14/03/2026");
  });

  it("devolve vazio sem data", () => {
    expect(formatarData(null)).toBe("");
    expect(formatarData("")).toBe("");
  });
});

describe("linkWhatsApp", () => {
  it("monta o link com 55 e só dígitos", () => {
    expect(linkWhatsApp("(27) 99999-8888")).toBe("https://wa.me/5527999998888");
  });

  it("não duplica o 55 quando o número já tem código do país", () => {
    expect(linkWhatsApp("5527999998888")).toBe("https://wa.me/5527999998888");
  });

  it("devolve null para telefone ausente ou curto", () => {
    expect(linkWhatsApp(null)).toBeNull();
    expect(linkWhatsApp("99998888")).toBeNull();
  });
});
