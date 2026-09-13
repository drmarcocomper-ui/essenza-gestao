import { describe, expect, it } from "vitest";

import {
  formatarQuantidade,
  valoresParaRepetir,
  type FormulaParaRepetir,
} from "./repetir";

/** Uma fórmula como o Supabase devolve: numeric em string, texto nulável. */
function formula(
  ajustes: Partial<FormulaParaRepetir> = {},
): FormulaParaRepetir {
  return {
    tipo: "coloracao",
    base_natural: "5",
    resultado_alvo: "7.1 loiro médio acinzentado",
    volume_oxidante: 20,
    tempo_pausa_min: 35,
    tecnica: "papel alumínio",
    itens: [
      { descricao: "Wella Koleston 7.1", quantidade: "60.00", unidade: "g" },
      { descricao: "Oxidante 20 vol", quantidade: "90.00", unidade: "ml" },
    ],
    ...ajustes,
  };
}

describe("valoresParaRepetir", () => {
  it("copia a receita inteira para os campos do formulário", () => {
    expect(valoresParaRepetir(formula())).toEqual({
      tipo: "coloracao",
      base_natural: "5",
      resultado_alvo: "7.1 loiro médio acinzentado",
      volume_oxidante: "20",
      tempo_pausa_min: "35",
      tecnica: "papel alumínio",
      itens: [
        { descricao: "Wella Koleston 7.1", quantidade: "60", unidade: "g" },
        { descricao: "Oxidante 20 vol", quantidade: "90", unidade: "ml" },
      ],
    });
  });

  it("não traz resultado, observação nem data da fórmula anterior", () => {
    // O que aconteceu da última vez é leitura, não rascunho: copiado para
    // o formulário, viraria fato de hoje sem ninguém notar.
    const valores = valoresParaRepetir({
      ...formula(),
      // Campos que existem na linha do banco e não podem vazar para cá.
      ...({ resultado: "saiu mais claro", observacao: "usar 10 vol", data: "2026-01-05" } as object),
    } as FormulaParaRepetir);

    expect(valores).not.toHaveProperty("resultado");
    expect(valores).not.toHaveProperty("observacao");
    expect(valores).not.toHaveProperty("data");
  });

  it("devolve null quando a cliente ainda não tem fórmula", () => {
    expect(valoresParaRepetir(null)).toBeNull();
    expect(valoresParaRepetir(undefined)).toBeNull();
  });

  it("troca campo nulo por string vazia, para o input controlado", () => {
    const valores = valoresParaRepetir(
      formula({
        base_natural: null,
        resultado_alvo: null,
        volume_oxidante: null,
        tempo_pausa_min: null,
        tecnica: null,
      }),
    );

    expect(valores).toMatchObject({
      base_natural: "",
      resultado_alvo: "",
      volume_oxidante: "",
      tempo_pausa_min: "",
      tecnica: "",
    });
  });

  it("mantém a ordem dos produtos da mistura", () => {
    const valores = valoresParaRepetir(
      formula({
        itens: [
          { descricao: "pó descolorante", quantidade: "30", unidade: "g" },
          { descricao: "oxidante", quantidade: "60", unidade: "ml" },
          { descricao: "plex", quantidade: "5", unidade: "ml" },
        ],
      }),
    );

    expect(valores?.itens.map((item) => item.descricao)).toEqual([
      "pó descolorante",
      "oxidante",
      "plex",
    ]);
  });

  it("aceita fórmula sem mistura registrada", () => {
    expect(valoresParaRepetir(formula({ itens: [] }))?.itens).toEqual([]);
  });

  it("cai no tipo padrão quando o tipo gravado não existe mais", () => {
    // Tipo veio de um `check` que pode mudar: um valor desconhecido não
    // pode deixar o <select> sem opção marcada.
    expect(valoresParaRepetir(formula({ tipo: "sei_la" }))?.tipo).toBe(
      "coloracao",
    );
  });

  it("cai na unidade padrão quando a unidade é desconhecida ou nula", () => {
    const valores = valoresParaRepetir(
      formula({
        itens: [
          { descricao: "creme", quantidade: "1", unidade: null },
          { descricao: "pó", quantidade: "1", unidade: "kg" },
        ],
      }),
    );

    expect(valores?.itens.map((item) => item.unidade)).toEqual(["g", "g"]);
  });
});

describe("formatarQuantidade", () => {
  it("tira as casas decimais que o numeric acrescenta", () => {
    expect(formatarQuantidade("60.00")).toBe("60");
  });

  it("mostra a fração com vírgula", () => {
    expect(formatarQuantidade("1.50")).toBe("1,5");
    expect(formatarQuantidade(2.25)).toBe("2,25");
  });

  it("devolve vazio para ausência", () => {
    expect(formatarQuantidade(null)).toBe("");
    expect(formatarQuantidade(undefined)).toBe("");
    expect(formatarQuantidade("abc")).toBe("");
  });
});
