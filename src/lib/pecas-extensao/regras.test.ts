import { describe, expect, it } from "vitest";

import {
  chaveCodigo,
  codigoContemTermo,
  estadoDaPeca,
  mensagemPecaEmOutraConta,
  MENSAGEM_CODIGO_TRAVADO,
  pecaVendavelNaConta,
  resumoDaPeca,
  type ContaDaPeca,
  codigoDoDuplicado,
  compararCodigos,
  conferirCustos,
  encontrarCodigoDuplicado,
  idsDesmembradas,
  indicesCodigoRepetido,
  mensagemCodigoDuplicado,
  mensagemSomaNaoFecha,
  mesmoPreco,
  MENSAGEM_CUSTO_TRAVADO_MAE,
  MENSAGEM_CUSTO_TRAVADO_PARTE,
  MENSAGEM_DESMEMBRAR_SEM_CUSTO,
  MENSAGEM_EXCLUSAO_PARTE,
  MENSAGEM_EXCLUSAO_TRAVADA,
  MENSAGEM_JA_DESMEMBRADA,
  ordenarPecas,
  pecaCasaComTermo,
  somarCentavos,
  sugerirCodigos,
  textoConferencia,
  travasDaPeca,
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

describe("idsDesmembradas", () => {
  it("são as mães apontadas por alguma peça", () => {
    expect(
      idsDesmembradas([
        peca("1254"),
        peca("1254-a", "1254"),
        peca("1254-a1", "1254-a"),
        peca("999"),
      ]),
    ).toEqual(new Set(["1254", "1254-a"]));
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

describe("conferirCustos — soma em centavos", () => {
  it("0,1 + 0,2 fecha com 0,30 (o float daria 0,30000000000000004)", () => {
    expect(0.1 + 0.2).not.toBe(0.3);
    expect(conferirCustos([0.1, 0.2], 0.3).situacao).toBe("fecha");
  });

  it("100,00 em 33,33 + 33,33 + 33,34 fecha", () => {
    expect(conferirCustos([33.33, 33.33, 33.34], 100).situacao).toBe("fecha");
  });

  it("33,33 × 3 não fecha com 100,00: falta um centavo", () => {
    const conferencia = conferirCustos([33.33, 33.33, 33.33], 100);

    expect(conferencia.situacao).toBe("faltam");
    expect(conferencia.diferencaCentavos).toBe(1);
    expect(textoConferencia(conferencia)).toMatch(/^faltam R\$\s0,01$/);
  });

  it("soma maior que a mãe sobra", () => {
    const conferencia = conferirCustos([60, 50], 100);

    expect(conferencia.situacao).toBe("sobram");
    expect(textoConferencia(conferencia)).toMatch(/^sobram R\$\s10,00$/);
  });

  it("custo em branco não entra na soma", () => {
    expect(conferirCustos([100, null], 100).situacao).toBe("fecha");
    expect(conferirCustos([null, null], 100).somaCentavos).toBe(0);
  });

  it("mãe de custo zero fecha com partes zero", () => {
    expect(conferirCustos([0, 0], 0).situacao).toBe("fecha");
  });

  it("somarCentavos arredonda cada parcela, não a soma", () => {
    expect(somarCentavos([33.33, 33.33, 33.34])).toBe(10000);
  });

  it("a mensagem do servidor diz os dois valores e o que falta", () => {
    expect(mensagemSomaNaoFecha(conferirCustos([50, 40], 100))).toMatch(
      /R\$\s90,00.*R\$\s100,00.*faltam R\$\s10,00/,
    );
  });
});

describe("mesmoPreco", () => {
  it("compara em centavos", () => {
    expect(mesmoPreco(0.1 + 0.2, 0.3)).toBe(true);
    expect(mesmoPreco(100, 100.01)).toBe(false);
  });

  it("null só é igual a null; zero é outro dado", () => {
    expect(mesmoPreco(null, null)).toBe(true);
    expect(mesmoPreco(null, 0)).toBe(false);
    expect(mesmoPreco(0, null)).toBe(false);
  });
});

describe("sugerirCodigos", () => {
  it("mãe terminando em dígito: -a, -b, -c", () => {
    expect(sugerirCodigos("1254", 3)).toEqual(["1254-a", "1254-b", "1254-c"]);
  });

  it("mãe terminando em letra: 1, 2, 3", () => {
    expect(sugerirCodigos("1254-a", 3)).toEqual(["1254-a1", "1254-a2", "1254-a3"]);
  });

  it("10 partes vão até -j", () => {
    const codigos = sugerirCodigos("1254", 10);

    expect(codigos).toHaveLength(10);
    expect(codigos.at(-1)).toBe("1254-j");
  });

  it("10 partes de mãe com letra vão até 10", () => {
    expect(sugerirCodigos("1254-a", 10).at(-1)).toBe("1254-a10");
  });

  it("tira espaço das pontas e mantém a caixa", () => {
    expect(sugerirCodigos(" 1254-B ", 2)).toEqual(["1254-B1", "1254-B2"]);
  });
});

describe("indicesCodigoRepetido", () => {
  it("acha a repetição ignorando caixa e espaços nas pontas", () => {
    expect(indicesCodigoRepetido(["1254-a", " 1254-A ", "1254-b"])).toEqual([1]);
  });

  it("marca toda repetição depois da primeira", () => {
    expect(indicesCodigoRepetido(["x", "y", "X", "x "])).toEqual([2, 3]);
  });

  it("códigos distintos e em branco não são repetição", () => {
    expect(indicesCodigoRepetido(["1254-a", "1254-b", "", "  "])).toEqual([]);
  });
});

describe("codigoDoDuplicado", () => {
  const DETALHE =
    "Key (lower(TRIM(BOTH FROM codigo)))=(1254-a) already exists.";

  it("devolve o código como ela escreveu na parte", () => {
    expect(codigoDoDuplicado(DETALHE, ["1254-A", "1254-B"])).toBe("1254-A");
  });

  it("sem parte correspondente, devolve a chave do banco", () => {
    expect(codigoDoDuplicado(DETALHE, ["x"])).toBe("1254-a");
  });

  it("formato desconhecido é null", () => {
    expect(codigoDoDuplicado("outra coisa", ["1254-a"])).toBeNull();
    expect(codigoDoDuplicado(undefined, ["1254-a"])).toBeNull();
  });
});

function travas(situacao: Partial<Parameters<typeof travasDaPeca>[0]>) {
  return travasDaPeca({
    pecaMaeId: null,
    precoCompra: 300,
    temFilhas: false,
    conta: null,
    ...situacao,
  });
}

const CONTA_ABERTA: ContaDaPeca = {
  atendimentoId: "at-1",
  clienteId: "cl-1",
  clienteNome: "Maria Souza",
  data: "2026-09-12",
  fechada: false,
};

const CONTA_FECHADA: ContaDaPeca = { ...CONTA_ABERTA, fechada: true };

describe("travasDaPeca", () => {
  it("mãe sem filhas, com custo: tudo livre", () => {
    expect(travas({})).toEqual({
      codigoTravado: false,
      motivoCodigoTravado: null,
      motivoCustoTravado: null,
      motivoExclusaoTravada: null,
      motivoNaoDesmembra: null,
    });
  });

  it("mãe sem filhas e sem custo: não desmembra, o resto livre", () => {
    const resultado = travas({ precoCompra: null });

    expect(resultado.motivoNaoDesmembra).toBe(MENSAGEM_DESMEMBRAR_SEM_CUSTO);
    expect(resultado.motivoCustoTravado).toBeNull();
    expect(resultado.motivoExclusaoTravada).toBeNull();
  });

  it("custo zero desmembra: zero é custo informado", () => {
    expect(travas({ precoCompra: 0 }).motivoNaoDesmembra).toBeNull();
  });

  it("mãe com filhas: código e custo travados, não exclui, não desmembra de novo", () => {
    expect(travas({ temFilhas: true })).toEqual({
      codigoTravado: true,
      motivoCodigoTravado: MENSAGEM_CODIGO_TRAVADO,
      motivoCustoTravado: MENSAGEM_CUSTO_TRAVADO_MAE,
      motivoExclusaoTravada: MENSAGEM_EXCLUSAO_TRAVADA,
      motivoNaoDesmembra: MENSAGEM_JA_DESMEMBRADA,
    });
  });

  it("parte: custo travado e exclusão bloqueada; código livre; desmembra", () => {
    expect(travas({ pecaMaeId: "mae", precoCompra: 100 })).toEqual({
      codigoTravado: false,
      motivoCodigoTravado: null,
      motivoCustoTravado: MENSAGEM_CUSTO_TRAVADO_PARTE,
      motivoExclusaoTravada: MENSAGEM_EXCLUSAO_PARTE,
      motivoNaoDesmembra: null,
    });
  });

  it("parte com filhas: travada como mãe", () => {
    expect(travas({ pecaMaeId: "mae", precoCompra: 100, temFilhas: true })).toEqual({
      codigoTravado: true,
      motivoCodigoTravado: MENSAGEM_CODIGO_TRAVADO,
      motivoCustoTravado: MENSAGEM_CUSTO_TRAVADO_MAE,
      motivoExclusaoTravada: MENSAGEM_EXCLUSAO_TRAVADA,
      motivoNaoDesmembra: MENSAGEM_JA_DESMEMBRADA,
    });
  });

  it.each([
    ["aberta", CONTA_ABERTA],
    ["fechada", CONTA_FECHADA],
  ])("peça em conta %s: código só leitura, não exclui, não desmembra", (_, conta) => {
    expect(travas({ conta })).toEqual({
      codigoTravado: true,
      motivoCodigoTravado:
        "Esta peça está na conta de Maria Souza em 12/09/2026: o código não muda.",
      motivoCustoTravado: null,
      motivoExclusaoTravada:
        "Esta peça está na conta de Maria Souza em 12/09/2026 e não pode ser excluída.",
      motivoNaoDesmembra:
        "Esta peça está na conta de Maria Souza em 12/09/2026 e não pode ser desmembrada.",
    });
  });

  it("parte em conta: o motivo da conta vem antes do de parte", () => {
    const resultado = travas({ pecaMaeId: "mae", precoCompra: 100, conta: CONTA_FECHADA });

    expect(resultado.motivoExclusaoTravada).toMatch(/^Esta peça está na conta de/);
    expect(resultado.motivoCustoTravado).toBe(MENSAGEM_CUSTO_TRAVADO_PARTE);
  });
});

describe("estadoDaPeca", () => {
  it("sem partes e sem item: disponível", () => {
    expect(estadoDaPeca({ temFilhas: false, conta: null })).toBe("disponivel");
  });

  it("com partes: desmembrada", () => {
    expect(estadoDaPeca({ temFilhas: true, conta: null })).toBe("desmembrada");
  });

  it("com item e conta sem lançamento: na conta aberta", () => {
    expect(estadoDaPeca({ temFilhas: false, conta: CONTA_ABERTA })).toBe(
      "na_conta_aberta",
    );
  });

  it("com item e conta com lançamento: vendida", () => {
    expect(estadoDaPeca({ temFilhas: false, conta: CONTA_FECHADA })).toBe("vendida");
  });
});

describe("pecaVendavelNaConta", () => {
  const ATENDIMENTO = "at-1";

  it("livre: vendável", () => {
    expect(
      pecaVendavelNaConta({ temFilhas: false, atendimentoDoItem: null }, ATENDIMENTO),
    ).toBe(true);
  });

  it("com partes: não é vendável, nem livre", () => {
    expect(
      pecaVendavelNaConta({ temFilhas: true, atendimentoDoItem: null }, ATENDIMENTO),
    ).toBe(false);
  });

  it("em outra conta: não é vendável", () => {
    expect(
      pecaVendavelNaConta({ temFilhas: false, atendimentoDoItem: "at-2" }, ATENDIMENTO),
    ).toBe(false);
  });

  it("na própria conta (reaberta): continua vendável", () => {
    expect(
      pecaVendavelNaConta(
        { temFilhas: false, atendimentoDoItem: ATENDIMENTO },
        ATENDIMENTO,
      ),
    ).toBe(true);
  });
});

describe("codigoContemTermo", () => {
  it("trim + lower, contém — sem tirar acento (a chave do índice)", () => {
    expect(codigoContemTermo("1254-B", " 54-b ")).toBe(true);
    expect(codigoContemTermo("Açaí-1", "acai")).toBe(false);
    expect(codigoContemTermo("1254", "999")).toBe(false);
  });

  it("termo vazio casa com tudo", () => {
    expect(codigoContemTermo("1254", "   ")).toBe(true);
  });
});

describe("mensagens de peça na conta", () => {
  it("em outra conta, com e sem código", () => {
    expect(mensagemPecaEmOutraConta("1254")).toBe("A peça 1254 já está em outra conta.");
    expect(mensagemPecaEmOutraConta(null)).toBe("A peça já está em outra conta.");
  });
});

describe("resumoDaPeca", () => {
  it("cor · gramas · comprimento", () => {
    expect(resumoDaPeca({ cor: "Castanho", gramas: 100, comprimentoCm: 55.5 })).toBe(
      "Castanho · 100 g · 55,5 cm",
    );
  });

  it("o que não foi informado é —, nunca 0", () => {
    expect(resumoDaPeca({ cor: null, gramas: null, comprimentoCm: null })).toBe(
      "— · — g · — cm",
    );
  });
});
