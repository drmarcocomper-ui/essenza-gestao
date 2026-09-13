import { describe, expect, it } from "vitest";

import { LADO_MAXIMO, calcularDimensoes } from "./imagem";

describe("calcularDimensoes", () => {
  it("reduz a paisagem pelo lado maior, mantendo a proporção", () => {
    // 4032x3024 é a foto padrão do iPhone na horizontal.
    expect(calcularDimensoes(4032, 3024)).toEqual({
      largura: 1600,
      altura: 1200,
    });
  });

  it("reduz o retrato pelo lado maior", () => {
    expect(calcularDimensoes(3024, 4032)).toEqual({
      largura: 1200,
      altura: 1600,
    });
  });

  it("não amplia imagem menor que o teto", () => {
    expect(calcularDimensoes(800, 600)).toEqual({ largura: 800, altura: 600 });
  });

  it("deixa passar a imagem que já está exatamente no teto", () => {
    expect(calcularDimensoes(1600, 900)).toEqual({
      largura: 1600,
      altura: 900,
    });
  });

  it("arredonda o lado menor para inteiro", () => {
    // 3000x2000 → escala 1600/3000; 2000 * 0.5333… = 1066,67.
    expect(calcularDimensoes(3000, 2000)).toEqual({
      largura: 1600,
      altura: 1067,
    });
  });

  it("nunca devolve dimensão zero em imagem muito alongada", () => {
    // Canvas com lado 0 não desenha: o mínimo é 1px.
    const { largura, altura } = calcularDimensoes(20000, 5);

    expect(largura).toBe(LADO_MAXIMO);
    expect(altura).toBe(1);
  });

  it("respeita um teto diferente do padrão", () => {
    expect(calcularDimensoes(2000, 1000, 500)).toEqual({
      largura: 500,
      altura: 250,
    });
  });

  it("não divide por zero em imagem sem dimensão", () => {
    expect(calcularDimensoes(0, 0)).toEqual({ largura: 0, altura: 0 });
  });
});

