import { describe, expect, it } from "vitest";

import { acharServicoPorNome, jaEscolhido } from "./servicos";

const CATALOGO = [
  { id: "1", nome: "Coloração" },
  { id: "2", nome: "Corte" },
  { id: "3", nome: "Manutenção de extensão" },
];

describe("acharServicoPorNome", () => {
  it("casa ignorando acento", () => {
    expect(acharServicoPorNome(CATALOGO, "coloracao")?.id).toBe("1");
    expect(acharServicoPorNome(CATALOGO, "manutencao de extensao")?.id).toBe(
      "3",
    );
  });

  it("casa ignorando caixa", () => {
    expect(acharServicoPorNome(CATALOGO, "COLORAÇÃO")?.id).toBe("1");
    expect(acharServicoPorNome(CATALOGO, "corte")?.id).toBe("2");
  });

  it("casa ignorando espaço das pontas e espaço duplicado", () => {
    expect(acharServicoPorNome(CATALOGO, "  Corte ")?.id).toBe("2");
    expect(acharServicoPorNome(CATALOGO, "Manutenção  de   extensão")?.id).toBe(
      "3",
    );
  });

  it("casa com tudo junto: acento, caixa e espaço", () => {
    expect(acharServicoPorNome(CATALOGO, "  MANUTENCAO   DE  EXTENSAO ")?.id).toBe(
      "3",
    );
  });

  it("devolve null quando o serviço é mesmo novo", () => {
    expect(acharServicoPorNome(CATALOGO, "Botox capilar")).toBeNull();
  });

  it("não casa por pedaço do nome", () => {
    // Busca de cliente é por trecho; catálogo é por nome inteiro, senão
    // "Corte" engoliria "Corte infantil".
    expect(acharServicoPorNome(CATALOGO, "Corte infantil")).toBeNull();
    expect(acharServicoPorNome(CATALOGO, "cor")).toBeNull();
  });

  it("devolve null para nome vazio ou só espaço", () => {
    expect(acharServicoPorNome(CATALOGO, "")).toBeNull();
    expect(acharServicoPorNome(CATALOGO, "   ")).toBeNull();
  });

  it("devolve null com catálogo vazio", () => {
    expect(acharServicoPorNome([], "Corte")).toBeNull();
  });

  it("devolve o primeiro quando o catálogo já tem duplicata", () => {
    const comDuplicata = [
      { id: "1", nome: "Corte" },
      { id: "9", nome: "corte" },
    ];

    expect(acharServicoPorNome(comDuplicata, "CORTE")?.id).toBe("1");
  });
});

describe("jaEscolhido", () => {
  const escolhidos = [{ nome: "Coloração" }, { nome: "Corte" }];

  it("reconhece o mesmo serviço escrito de outro jeito", () => {
    expect(jaEscolhido(escolhidos, "coloracao")).toBe(true);
    expect(jaEscolhido(escolhidos, "  CORTE  ")).toBe(true);
  });

  it("deixa passar o que ainda não está na lista", () => {
    expect(jaEscolhido(escolhidos, "Hidratação")).toBe(false);
  });

  it("nome vazio não conta como escolhido", () => {
    expect(jaEscolhido(escolhidos, "  ")).toBe(false);
  });
});
