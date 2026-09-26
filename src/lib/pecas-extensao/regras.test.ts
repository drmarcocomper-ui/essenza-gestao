import { describe, expect, it } from "vitest";

import {
  chaveCodigo,
  compararCodigos,
  encontrarCodigoDuplicado,
  mensagemCodigoDuplicado,
  ordenarPecas,
  pecaCasaComTermo,
  valoresDistintos,
} from "./regras";

function peca(codigo: string, pecaMaeId: string | null = null) {
  return { id: codigo, codigo, pecaMaeId };
}

function codigos(pecas: { peca: { codigo: string } }[]) {
  return pecas.map(({ peca }) => peca.codigo);
}

describe("compararCodigos", () => {
  it("ordem natural: número pelo valor, sufixo depois da peça inteira", () => {
    const ordenados = ["1254-a1", "1254-b", "999", "1254", "1254-a"].sort(
      compararCodigos,
    );

    expect(ordenados).toEqual(["999", "1254", "1254-a", "1254-a1", "1254-b"]);
  });

  it("ignora caixa", () => {
    expect(compararCodigos("1254-B", "1254-b")).toBe(0);
  });
});

describe("ordenarPecas", () => {
  it("sem partes, é a ordem natural do código", () => {
    const lista = ordenarPecas([
      peca("1254-b"),
      peca("1254-a1"),
      peca("999"),
      peca("1254"),
      peca("1254-a"),
    ]);

    expect(codigos(lista)).toEqual(["999", "1254", "1254-a", "1254-a1", "1254-b"]);
    expect(lista.every(({ nivel }) => nivel === 0)).toBe(true);
  });

  it("cada parte vem logo abaixo da mãe, em qualquer grafia", () => {
    const lista = ordenarPecas([
      peca("2000"),
      peca("1254"),
      peca("z-parte", "1254"),
      peca("1254-a", "1254"),
      peca("1254-a1", "1254-a"),
      peca("999"),
    ]);

    expect(
      lista.map(({ peca, nivel }) => `${nivel}:${peca.codigo}`),
    ).toEqual(["0:999", "0:1254", "1:1254-a", "2:1254-a1", "1:z-parte", "0:2000"]);
  });

  it("parte cuja mãe ficou fora da lista sobe para o primeiro nível", () => {
    const lista = ordenarPecas([peca("1254-a", "1254"), peca("999")]);

    expect(lista.map(({ peca, nivel }) => `${nivel}:${peca.codigo}`)).toEqual([
      "0:999",
      "0:1254-a",
    ]);
  });

  it("ciclo no banco não trava nem some com as peças", () => {
    const lista = ordenarPecas([peca("A", "B"), peca("B", "A"), peca("1")]);

    expect(codigos(lista).sort()).toEqual(["1", "A", "B"]);
  });

  it("não altera a lista original", () => {
    const original = [peca("2"), peca("1")];

    ordenarPecas(original);

    expect(original[0].codigo).toBe("2");
  });
});

describe("chaveCodigo", () => {
  it("é lower + trim, como o índice da 018", () => {
    expect(chaveCodigo(" 1254-B ")).toBe("1254-b");
  });

  it("não tira acento nem junta espaço do meio (o índice não faz)", () => {
    expect(chaveCodigo("Açaí  1")).toBe("açaí  1");
  });
});

describe("encontrarCodigoDuplicado", () => {
  const PECAS = [
    { id: "1", codigo: "1254" },
    { id: "2", codigo: "1254-B" },
  ];

  it.each(["1254-b", " 1254-B ", "1254-B"])("recusa %j", (codigo) => {
    expect(encontrarCodigoDuplicado(PECAS, codigo)?.id).toBe("2");
  });

  it("aceita código novo", () => {
    expect(encontrarCodigoDuplicado(PECAS, "1254-c")).toBeNull();
  });

  it("ignora a própria peça na edição", () => {
    expect(encontrarCodigoDuplicado(PECAS, "1254-b", "2")).toBeNull();
    expect(encontrarCodigoDuplicado(PECAS, "1254", "2")?.id).toBe("1");
  });
});

describe("mensagemCodigoDuplicado", () => {
  it("nomeia a peça", () => {
    expect(mensagemCodigoDuplicado("1254")).toBe("Já existe a peça 1254.");
  });
});

describe("pecaCasaComTermo", () => {
  it("procura dentro do código, sem caixa", () => {
    expect(pecaCasaComTermo({ codigo: "1254-B" }, "254-b")).toBe(true);
    expect(pecaCasaComTermo({ codigo: "1254" }, "999")).toBe(false);
  });

  it("termo vazio casa com tudo", () => {
    expect(pecaCasaComTermo({ codigo: "1254" }, "  ")).toBe(true);
  });
});

describe("valoresDistintos", () => {
  it("uma vez cada, na primeira grafia, em ordem alfabética", () => {
    expect(
      valoresDistintos(["Loiro", null, "castanho ", "Castanho", "", "Ômbre", "loiro"]),
    ).toEqual(["castanho", "Loiro", "Ômbre"]);
  });
});
