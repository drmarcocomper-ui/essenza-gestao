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

  describe("23505", () => {
    const PECA = "33333333-3333-4333-8333-333333333333";

    const REPETIDA = {
      code: "23505",
      message:
        'duplicate key value violates unique constraint "uq_atendimento_itens_peca_extensao"',
      details: `Key (peca_extensao_id)=(${PECA}) already exists.`,
    };

    it("peça repetida pelo índice da 020 nomeia a peça", () => {
      const falha = classificarFalhaConta("itens", REPETIDA, {
        codigoDaPeca: (id) => (id === PECA ? "1254" : null),
      });

      expect(falha.texto).toMatch(/^A peça 1254 já está em outra conta\. /);
      expect(falha.texto).toContain("não foram gravados");
      expect(falha.podeTentarDeNovo).toBe(false);
    });

    it("sem saber qual peça, a frase vai sem o código", () => {
      expect(classificarFalhaConta("itens", REPETIDA).texto).toMatch(
        /^A peça já está em outra conta\. /,
      );

      expect(
        classificarFalhaConta("itens", { ...REPETIDA, details: undefined }, {
          codigoDaPeca: () => "1254",
        }).texto,
      ).toMatch(/^A peça já está em outra conta\. /);
    });

    it("nenhum 23505 cai em “Tente de novo”", () => {
      const falha = classificarFalhaConta("lancamentos", {
        code: "23505",
        message: 'duplicate key value violates unique constraint "outra_coisa"',
      });

      expect(falha.podeTentarDeNovo).toBe(false);
      expect(falha.texto).not.toContain("Tente de novo");
      expect(falha.texto).toContain("Marco");
    });
  });
});
