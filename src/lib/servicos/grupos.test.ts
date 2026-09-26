import { describe, expect, it } from "vitest";

import { agruparPorCategoria, ordenarPorNome, SEM_CATEGORIA } from "./grupos";

const servico = (nome: string, categoria: string | null) => ({
  nome,
  categoria,
});

describe("agruparPorCategoria", () => {
  it("põe cada serviço no bloco da categoria dele", () => {
    const grupos = agruparPorCategoria([
      servico("Matização", "coloracao"),
      servico("Corte feminino", "corte"),
      servico("Hidratação", "tratamento"),
    ]);

    expect(grupos.map((grupo) => grupo.rotulo)).toEqual([
      "Coloração",
      "Corte",
      "Tratamento",
    ]);
    expect(grupos.map((grupo) => grupo.servicos.map((s) => s.nome))).toEqual([
      ["Matização"],
      ["Corte feminino"],
      ["Hidratação"],
    ]);
  });

  it("mantém a ordem fixa dos blocos, não a ordem de chegada", () => {
    const grupos = agruparPorCategoria([
      servico("Manutenção", "extensao"),
      servico("Corte masculino", "corte"),
      servico("Luzes", "coloracao"),
    ]);

    expect(grupos.map((grupo) => grupo.chave)).toEqual([
      "coloracao",
      "corte",
      "extensao",
    ]);
  });

  it("ordena por nome dentro do bloco, qualquer que seja a chegada", () => {
    const grupos = agruparPorCategoria([
      servico("Cauterização", "tratamento"),
      servico("lumiére", "tratamento"),
      servico("Ampola", "tratamento"),
      servico("Botox", "tratamento"),
    ]);

    expect(grupos[0].servicos.map((s) => s.nome)).toEqual([
      "Ampola",
      "Botox",
      "Cauterização",
      "lumiére",
    ]);
  });

  it("ordenar os nomes não mexe na ordem dos blocos", () => {
    const grupos = agruparPorCategoria([
      servico("Zero", "tratamento"),
      servico("Alongamento", "extensao"),
      servico("Mechas", "coloracao"),
      servico("Aparar", "corte"),
    ]);

    // Nem alfabética de categoria nem puxada pelo primeiro nome: a de
    // CATEGORIAS, com Tratamento antes de Extensão.
    expect(grupos.map((grupo) => grupo.chave)).toEqual([
      "coloracao",
      "corte",
      "tratamento",
      "extensao",
    ]);
  });

  it("manda serviço sem categoria para o bloco próprio, no fim", () => {
    const grupos = agruparPorCategoria([
      servico("Escova do ato", null),
      servico("Corte feminino", "corte"),
    ]);

    expect(grupos.map((grupo) => grupo.rotulo)).toEqual([
      "Corte",
      "Sem categoria",
    ]);
    expect(grupos[1].chave).toBe(SEM_CATEGORIA);
    expect(grupos[1].servicos.map((s) => s.nome)).toEqual(["Escova do ato"]);
  });

  it("não deixa sumir serviço com categoria fora da lista", () => {
    // A coluna não tem `check` (012): valor estranho é possível, e some
    // da tela é pior que aparecer no bloco vago.
    const grupos = agruparPorCategoria([servico("Maquiagem", "penteado")]);

    expect(grupos).toHaveLength(1);
    expect(grupos[0].chave).toBe(SEM_CATEGORIA);
    expect(grupos[0].servicos.map((s) => s.nome)).toEqual(["Maquiagem"]);
  });

  it("não devolve bloco vazio", () => {
    const grupos = agruparPorCategoria([servico("Corte feminino", "corte")]);

    expect(grupos).toHaveLength(1);
    expect(grupos[0].chave).toBe("corte");
  });

  it("devolve lista vazia quando o catálogo está vazio", () => {
    expect(agruparPorCategoria([])).toEqual([]);
  });
});

describe("ordenarPorNome", () => {
  const nomes = (lista: { nome: string }[]) => lista.map((item) => item.nome);
  const itens = (...lista: string[]) => lista.map((nome) => ({ nome }));

  it("minúscula no começo não manda o nome para o fim", () => {
    expect(
      nomes(ordenarPorNome(itens("Mechas", "lumiére", "Gloss", "Tonalizante"))),
    ).toEqual(["Gloss", "lumiére", "Mechas", "Tonalizante"]);
  });

  it("maiúscula e minúscula do mesmo nome ficam juntas, na ordem de chegada", () => {
    expect(
      nomes(
        ordenarPorNome(
          itens(
            "Ritual Reconstrução",
            "Selagem",
            "Ritual reconstrução",
            "Hidratação",
          ),
        ),
      ),
    ).toEqual([
      "Hidratação",
      "Ritual Reconstrução",
      "Ritual reconstrução",
      "Selagem",
    ]);
  });

  it("acento não muda a posição: Área fica junto de Area", () => {
    expect(
      nomes(ordenarPorNome(itens("Botox", "Área", "Ampola", "Area", "Azul"))),
    ).toEqual(["Ampola", "Área", "Area", "Azul", "Botox"]);
  });

  it("não mexe na lista recebida", () => {
    const lista = itens("B", "A");

    ordenarPorNome(lista);

    expect(nomes(lista)).toEqual(["B", "A"]);
  });
});
