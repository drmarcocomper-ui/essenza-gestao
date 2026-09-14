import { describe, expect, it } from "vitest";

import { classificarFalhaConta } from "@/lib/atendimentos/erros";

describe("falha ao fechar a conta", () => {
  it("policy errada manda chamar o Marco, não tentar de novo", () => {
    const falha = classificarFalhaConta("lancamentos", {
      code: "42501",
      message: "new row violates row-level security policy",
    });

    expect(falha.podeTentarDeNovo).toBe(false);
    expect(falha.texto).toContain("Marco");
  });

  it("coluna que não existe é app fora de sincronia com o banco", () => {
    const falha = classificarFalhaConta("itens", {
      code: "42703",
      message: 'column "categoria" does not exist',
    });

    expect(falha.podeTentarDeNovo).toBe(false);
    expect(falha.texto).toContain("Marco");
  });

  it("constraint recusada não melhora repetindo", () => {
    const falha = classificarFalhaConta("itens", {
      code: "23514",
      message: 'violates check constraint "chk_item_referencia"',
    });

    expect(falha.podeTentarDeNovo).toBe(false);
  });

  it("conexão caída é tentar de novo", () => {
    const falha = classificarFalhaConta("lancamentos", {
      message: "TypeError: fetch failed",
    });

    expect(falha.podeTentarDeNovo).toBe(true);
    expect(falha.texto).toContain("Tente de novo");
  });

  it("erro desconhecido cai no caminho de tentar de novo", () => {
    expect(classificarFalhaConta("itens", null).podeTentarDeNovo).toBe(true);
  });

  it("cada etapa diz em que estado o atendimento ficou", () => {
    expect(classificarFalhaConta("itens", null).texto).toContain(
      "não foram gravados",
    );
    expect(classificarFalhaConta("lancamentos", null).texto).toContain(
      "ficaram salvos",
    );
    expect(classificarFalhaConta("limpar", null).texto).toContain(
      "segue aberta",
    );
  });
});
