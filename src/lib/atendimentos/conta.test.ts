import { describe, expect, it } from "vitest";

import {
  categoriaDaConta,
  contaSchema,
  descricaoDaConta,
  diferencaConta,
  dividirEmParcelas,
  emCentavos,
  exigeModalidade,
  exigeTitularidade,
  formaContaSchema,
  FORMA_POR_INSTITUICAO,
  FORMA_POR_MODALIDADE,
  itemContaSchema,
  lerConta,
  modalidadeDe,
  parcelasDaForma,
  PARCELAS_MAXIMO,
  titularidadeDe,
  totalItens,
} from "@/lib/atendimentos/conta";
import { FORMAS_PAGAMENTO } from "@/lib/caixa/schema";

const SERVICO = "11111111-1111-4111-8111-111111111111";
const PRODUTO = "22222222-2222-4222-8222-222222222222";

const item = (
  valorUnitario: number,
  quantidade = 1,
  extra: { tipo?: "servico" | "produto"; categoria?: string | null } = {},
) => ({ quantidade, valorUnitario, tipo: "servico" as const, ...extra });

describe("total dos itens", () => {
  it("soma quantidade vezes valor", () => {
    expect(totalItens([item(350), item(150, 2)])).toBe(65_000);
  });

  it("não perde centavo em soma de ponto flutuante", () => {
    // 0,1 + 0,2 em float dá 0,30000000000000004. Em centavos, 30.
    expect(totalItens([item(0.1), item(0.2)])).toBe(30);
  });

  it("arredonda linha a linha, como a calculadora dela", () => {
    expect(totalItens([item(33.33, 3)])).toBe(9999);
  });

  it("conta vazia é zero, não erro", () => {
    expect(totalItens([])).toBe(0);
  });

  it("cortesia soma zero sem virar caso especial", () => {
    expect(totalItens([item(0)])).toBe(0);
  });
});

describe("diferença entre formas e total", () => {
  const itens = [item(350), item(130)];

  it("zero quando as formas cobrem o total", () => {
    expect(diferencaConta(itens, [{ valor: 480 }])).toBe(0);
  });

  it("zero quando várias formas somam o total", () => {
    expect(diferencaConta(itens, [{ valor: 300 }, { valor: 180 }])).toBe(0);
  });

  it("negativa é o que falta receber", () => {
    expect(diferencaConta(itens, [{ valor: 400 }])).toBe(-8000);
  });

  it("positiva é o que sobrou nas formas", () => {
    expect(diferencaConta(itens, [{ valor: 500 }])).toBe(2000);
  });

  it("sem forma nenhuma falta a conta inteira", () => {
    expect(diferencaConta(itens, [])).toBe(-48_000);
  });

  it("cortesia fecha com zero dos dois lados", () => {
    expect(diferencaConta([item(0)], [{ valor: 0 }])).toBe(0);
  });
});

describe("titularidade", () => {
  it("é perguntada só onde a marca tem as duas contas", () => {
    expect(exigeTitularidade("Nubank")).toBe(true);
    expect(exigeTitularidade("PicPay")).toBe(true);

    for (const outra of ["SumUp", "Dinheiro", "Terceiro", "Cortesia"]) {
      expect(exigeTitularidade(outra)).toBe(false);
    }
  });

  it("SumUp grava PJ sem perguntar, e ignora o que vier da tela", () => {
    expect(titularidadeDe("SumUp", null)).toBe("PJ");
    expect(titularidadeDe("SumUp", "PF")).toBe("PJ");
  });

  it("guarda a escolha no Nubank e no PicPay", () => {
    expect(titularidadeDe("Nubank", "PF")).toBe("PF");
    expect(titularidadeDe("PicPay", "PJ")).toBe("PJ");
  });

  it("grava null onde a tela não pergunta, em vez de chutar", () => {
    expect(titularidadeDe("Dinheiro", "PF")).toBeNull();
    expect(titularidadeDe("Terceiro", "PJ")).toBeNull();
    expect(titularidadeDe("Cortesia", "PF")).toBeNull();
  });

  it("recusa a forma quando falta a resposta obrigatória", () => {
    const erro = formaContaSchema.safeParse({
      instituicao: "Nubank",
      titularidade: "",
      modalidade: "",
      parcelas: "1",
      valor: "480,00",
    });

    expect(erro.success).toBe(false);
    expect(erro.error?.issues[0]?.path).toEqual(["titularidade"]);
  });

  it("aceita a forma sem titularidade onde ela não é pedida", () => {
    const forma = formaContaSchema.parse({
      instituicao: "Dinheiro",
      titularidade: "",
      modalidade: "",
      parcelas: "1",
      valor: "480,00",
    });

    expect(forma).toMatchObject({ titularidade: null, valor: 480 });
  });

  it("não deixa passar instituição fora da lista fechada", () => {
    expect(
      formaContaSchema.safeParse({
        instituicao: "Stone",
        titularidade: "",
        modalidade: "",
        parcelas: "1",
        valor: "10,00",
      }).success,
    ).toBe(false);
  });
});

describe("forma de pagamento gravada", () => {
  it("traduz só as duas instituições que não deixam dúvida", () => {
    expect(FORMA_POR_INSTITUICAO.Dinheiro).toBe("Dinheiro");
    expect(FORMA_POR_INSTITUICAO.Cortesia).toBe("Cortesia");
  });

  it("deixa null onde a instituição não diz como o dinheiro andou", () => {
    // SumUp é maquininha (débito ou crédito?), Nubank e PicPay recebem
    // Pix e transferência, Terceiro não diz nada.
    for (const instituicao of ["SumUp", "Nubank", "PicPay", "Terceiro"] as const) {
      expect(FORMA_POR_INSTITUICAO[instituicao]).toBeUndefined();
    }
  });

  it("as traduções existem no check da coluna (002)", () => {
    for (const forma of Object.values(FORMA_POR_INSTITUICAO)) {
      expect(FORMAS_PAGAMENTO).toContain(forma);
    }
  });
});

describe("valor do item", () => {
  const base = { tipo: "servico", refId: SERVICO, quantidade: "1" };

  it("campo vazio é erro, não zero", () => {
    const saida = itemContaSchema.safeParse({ ...base, valorUnitario: "" });

    expect(saida.success).toBe(false);
    expect(saida.error?.issues[0]?.message).toBe("Informe o valor");
  });

  it("zero digitado é aceito: cortesia é zero, não ausência", () => {
    expect(
      itemContaSchema.parse({ ...base, valorUnitario: "0,00" }).valorUnitario,
    ).toBe(0);
  });

  it("lê o valor mascarado", () => {
    expect(
      itemContaSchema.parse({ ...base, valorUnitario: "1.234,50" })
        .valorUnitario,
    ).toBe(1234.5);
  });

  it("recusa quantidade zero, fracionária ou absurda", () => {
    for (const quantidade of ["0", "1,5", "100", "-2", ""]) {
      expect(
        itemContaSchema.safeParse({
          ...base,
          quantidade,
          valorUnitario: "10,00",
        }).success,
      ).toBe(false);
    }
  });

  it("recusa item sem referência de catálogo", () => {
    expect(
      itemContaSchema.safeParse({
        ...base,
        refId: "",
        valorUnitario: "10,00",
      }).success,
    ).toBe(false);
  });
});

describe("categoria do lançamento", () => {
  it("é a categoria de todos quando todos são a mesma", () => {
    expect(
      categoriaDaConta([
        item(350, 1, { categoria: "coloracao" }),
        item(380, 1, { categoria: "coloracao" }),
      ]),
    ).toBe("Coloração");
  });

  it("conta misturada cai em Serviço, que é vago e não errado", () => {
    // O caso que derrubou a regra antiga: pela de maior valor, os 1.000
    // inteiros iriam como Produto, e o resumo do mês afirmaria uma venda
    // de revenda de 1.000 que não houve.
    expect(
      categoriaDaConta([
        item(350, 1, { categoria: "corte" }),
        item(650, 1, { tipo: "produto" }),
      ]),
    ).toBe("Serviço");
  });

  it("mistura de dois serviços de categorias diferentes também", () => {
    expect(
      categoriaDaConta([
        item(350, 1, { categoria: "coloracao" }),
        item(150, 1, { categoria: "corte" }),
      ]),
    ).toBe("Serviço");
  });

  it("valor nenhum entra na decisão", () => {
    // Mesmas categorias, valores invertidos: mesma resposta.
    expect(
      categoriaDaConta([
        item(10, 1, { categoria: "tratamento" }),
        item(9990, 1, { categoria: "tratamento" }),
      ]),
    ).toBe("Tratamento");
  });

  it("conta só de produtos é Produto", () => {
    expect(
      categoriaDaConta([
        item(229.9, 1, { tipo: "produto" }),
        item(399, 2, { tipo: "produto" }),
      ]),
    ).toBe("Produto");
  });

  it("traduz o vocabulário do catálogo para o do Caixa", () => {
    expect(categoriaDaConta([item(10, 1, { categoria: "extensao" })])).toBe(
      "Manutenção Extensão",
    );
  });

  it("produto tem categoria própria", () => {
    expect(categoriaDaConta([item(229.9, 1, { tipo: "produto" })])).toBe(
      "Produto",
    );
  });

  it("serviço sem categoria cai no padrão, que é estado normal", () => {
    expect(categoriaDaConta([item(150, 1, { categoria: null })])).toBe(
      "Serviço",
    );
  });

  it("categoria fora da lista da aplicação também cai no padrão", () => {
    expect(categoriaDaConta([item(150, 1, { categoria: "manicure" })])).toBe(
      "Serviço",
    );
  });

  it("um item fora da unanimidade já derruba a conta inteira", () => {
    expect(
      categoriaDaConta([
        item(120, 1, { categoria: "tratamento" }),
        item(120, 1, { categoria: "tratamento" }),
        item(200, 1, { categoria: "coloracao" }),
      ]),
    ).toBe("Serviço");
  });

  it("serviço sem categoria unânime com um categorizado é mistura", () => {
    // "Revisão" é o serviço sem categoria do catálogo: traduzido, ele é
    // "Serviço", e ao lado de uma coloração a conta deixa de ser unânime.
    expect(
      categoriaDaConta([
        item(150, 1, { categoria: null }),
        item(350, 1, { categoria: "coloracao" }),
      ]),
    ).toBe("Serviço");
  });

  it("cortesia não vira caso especial: vale a unanimidade, não o valor", () => {
    expect(
      categoriaDaConta([
        item(0, 1, { categoria: "corte" }),
        item(0, 1, { categoria: "corte" }),
      ]),
    ).toBe("Corte");

    expect(
      categoriaDaConta([
        item(0, 1, { categoria: "corte" }),
        item(0, 1, { tipo: "produto" }),
      ]),
    ).toBe("Serviço");
  });

  it("conta sem item nenhum não quebra", () => {
    expect(categoriaDaConta([])).toBe("Serviço");
  });
});

describe("descrição do lançamento", () => {
  it("junta os itens na ordem em que ela escolheu", () => {
    expect(
      descricaoDaConta([
        { descricao: "Essenza Cut Hair", quantidade: 1 },
        { descricao: "Tonalização", quantidade: 1 },
      ]),
    ).toBe("Essenza Cut Hair, Tonalização");
  });

  it("mostra a quantidade só quando é mais de um", () => {
    expect(
      descricaoDaConta([{ descricao: "Gloss Absolu", quantidade: 2 }]),
    ).toBe("2× Gloss Absolu");
  });

  it("corta no teto da coluna, com reticências", () => {
    const saida = descricaoDaConta(
      Array.from({ length: 20 }, () => ({
        descricao: "Protocolo lumiére Essenza",
        quantidade: 1,
      })),
    );

    expect(saida.length).toBeLessThanOrEqual(200);
    expect(saida.endsWith("…")).toBe(true);
  });
});

describe("conta inteira", () => {
  const itens = [
    { tipo: "servico", refId: SERVICO, quantidade: "1", valorUnitario: "350,00" },
    { tipo: "produto", refId: PRODUTO, quantidade: "2", valorUnitario: "65,00" },
  ];

  it("fecha quando as formas batem com o total", () => {
    const saida = contaSchema.safeParse({
      data_caixa: "2026-09-14",
      itens,
      formas: [
        {
          instituicao: "SumUp",
          titularidade: "",
          modalidade: "debito",
          parcelas: "1",
          valor: "300,00",
        },
        {
          instituicao: "Nubank",
          titularidade: "PF",
          modalidade: "",
          parcelas: "1",
          valor: "180,00",
        },
      ],
    });

    expect(saida.success).toBe(true);
    expect(saida.data?.formas[0]?.titularidade).toBe("PJ");
    expect(saida.data?.formas[1]?.titularidade).toBe("PF");
  });

  it("recusa fechar com diferença, e diz quanto falta", () => {
    const saida = contaSchema.safeParse({
      data_caixa: "2026-09-14",
      itens,
      formas: [{ instituicao: "Dinheiro", titularidade: "", modalidade: "", parcelas: "1", valor: "400,00" }],
    });

    expect(saida.success).toBe(false);
    expect(saida.error?.issues[0]?.message).toContain("Faltam");
    expect(saida.error?.issues[0]?.message).toContain("80,00");
  });

  it("recusa fechar com sobra", () => {
    const saida = contaSchema.safeParse({
      data_caixa: "2026-09-14",
      itens,
      formas: [{ instituicao: "Dinheiro", titularidade: "", modalidade: "", parcelas: "1", valor: "500,00" }],
    });

    expect(saida.success).toBe(false);
    expect(saida.error?.issues[0]?.message).toContain("Sobram");
  });

  it("recusa conta sem item", () => {
    expect(
      contaSchema.safeParse({
        data_caixa: "2026-09-14",
        itens: [],
        formas: [{ instituicao: "Dinheiro", titularidade: "", modalidade: "", parcelas: "1", valor: "0,00" }],
      }).success,
    ).toBe(false);
  });

  it("recusa conta sem forma de pagamento", () => {
    expect(
      contaSchema.safeParse({ data_caixa: "2026-09-14", itens, formas: [] })
        .success,
    ).toBe(false);
  });

  it("exige a data de caixa", () => {
    expect(
      contaSchema.safeParse({
        data_caixa: "",
        itens,
        formas: [{ instituicao: "Dinheiro", titularidade: "", modalidade: "", parcelas: "1", valor: "480,00" }],
      }).success,
    ).toBe(false);
  });
});

describe("leitura do formulário", () => {
  it("remonta as linhas a partir das listas paralelas", () => {
    const formData = new FormData();

    formData.set("data_caixa", "2026-09-14");

    for (const linha of [
      ["servico", SERVICO, "1", "350,00"],
      ["produto", PRODUTO, "2", "65,00"],
    ]) {
      formData.append("item_tipo", linha[0]);
      formData.append("item_ref", linha[1]);
      formData.append("item_quantidade", linha[2]);
      formData.append("item_valor", linha[3]);
    }

    formData.append("forma_instituicao", "Nubank");
    formData.append("forma_titularidade", "PJ");
    formData.append("forma_modalidade", "");
    formData.append("forma_parcelas", "1");
    formData.append("forma_valor", "480,00");

    const conta = lerConta(formData);

    expect(conta.itens).toHaveLength(2);
    expect(conta.itens[1]).toEqual({
      tipo: "produto",
      refId: PRODUTO,
      quantidade: "2",
      valorUnitario: "65,00",
    });
    expect(conta.formas).toEqual([
      {
        instituicao: "Nubank",
        titularidade: "PJ",
        modalidade: "",
        parcelas: "1",
        valor: "480,00",
      },
    ]);
    expect(contaSchema.safeParse(conta).success).toBe(true);
  });
});

describe("divisão em parcelas", () => {
  /** A regra que nenhum arredondamento pode quebrar. */
  const soma = (valores: number[]) =>
    valores.reduce((total, valor) => total + emCentavos(valor), 0);

  it("divide exato quando divide exato", () => {
    expect(dividirEmParcelas(300, 3)).toEqual([100, 100, 100]);
  });

  it("629,90 em 3x: a sobra de centavo vai na última", () => {
    expect(dividirEmParcelas(629.9, 3)).toEqual([209.96, 209.96, 209.98]);
    expect(soma(dividirEmParcelas(629.9, 3))).toBe(62_990);
  });

  it("uma parcela é o valor inteiro", () => {
    expect(dividirEmParcelas(629.9, 1)).toEqual([629.9]);
  });

  it("dois centavos de sobra também vão todos na última", () => {
    // 100,00 em 3x: 33,33 + 33,33 + 33,34.
    expect(dividirEmParcelas(100, 3)).toEqual([33.33, 33.33, 33.34]);
  });

  it("a soma bate com o valor em qualquer divisão até o teto", () => {
    for (const valor of [0.03, 10, 629.9, 481.37, 1000.01, 99.99]) {
      for (let vezes = 1; vezes <= PARCELAS_MAXIMO; vezes++) {
        expect(soma(dividirEmParcelas(valor, vezes))).toBe(emCentavos(valor));
      }
    }
  });

  it("valor menor que o número de parcelas não some nem estoura", () => {
    // 0,02 em 3x: duas de zero e uma de dois centavos. Continua somando.
    expect(dividirEmParcelas(0.02, 3)).toEqual([0, 0, 0.02]);
  });
});

describe("modalidade da maquininha", () => {
  it("é perguntada só na SumUp", () => {
    expect(exigeModalidade("SumUp")).toBe(true);

    for (const outra of [
      "Nubank",
      "PicPay",
      "Dinheiro",
      "Terceiro",
      "Cortesia",
    ]) {
      expect(exigeModalidade(outra)).toBe(false);
    }
  });

  it("grava null fora da maquininha, mesmo se a tela mandar valor", () => {
    expect(modalidadeDe("Nubank", "credito")).toBeNull();
    expect(modalidadeDe("Dinheiro", "debito")).toBeNull();
  });

  it("recusa valor fora das duas modalidades", () => {
    expect(modalidadeDe("SumUp", "parcelado")).toBeNull();
    expect(modalidadeDe("SumUp", null)).toBeNull();
  });

  it("as duas traduções existem no check da coluna (002)", () => {
    for (const forma of Object.values(FORMA_POR_MODALIDADE)) {
      expect(FORMAS_PAGAMENTO).toContain(forma);
    }
  });

  it("a forma na SumUp não passa sem crédito ou débito", () => {
    const saida = formaContaSchema.safeParse({
      instituicao: "SumUp",
      titularidade: "",
      modalidade: "",
      parcelas: "1",
      valor: "629,90",
    });

    expect(saida.success).toBe(false);
    expect(saida.error?.issues[0]?.path).toEqual(["modalidade"]);
  });

  it("parcelamento escolhido fora do crédito não sobrevive ao parse", () => {
    const forma = formaContaSchema.parse({
      instituicao: "SumUp",
      titularidade: "",
      modalidade: "debito",
      parcelas: "4",
      valor: "629,90",
    });

    expect(forma).toMatchObject({ modalidade: "debito", parcelas: 1 });
  });

  it("recusa parcelamento acima do teto", () => {
    expect(
      formaContaSchema.safeParse({
        instituicao: "SumUp",
        titularidade: "",
        modalidade: "credito",
        parcelas: String(PARCELAS_MAXIMO + 1),
        valor: "629,90",
      }).success,
    ).toBe(false);
  });
});

describe("lançamentos de uma forma de pagamento", () => {
  const CAIXA = "2026-09-14";

  const sumup = (
    modalidade: "credito" | "debito",
    parcelas: number,
    valor: number,
  ) =>
    parcelasDaForma({ instituicao: "SumUp", modalidade, parcelas, valor }, CAIXA);

  it("débito nasce Pago, com a data que a tela perguntou", () => {
    expect(sumup("debito", 1, 629.9)).toEqual([
      {
        forma_pagamento: "Cartão de débito",
        status: "Pago",
        data_caixa: CAIXA,
        parcelamento: null,
        valor: 629.9,
      },
    ]);
  });

  it("crédito em 1x já nasce Pendente e sem data: cai em ~30 dias", () => {
    expect(sumup("credito", 1, 629.9)).toEqual([
      {
        forma_pagamento: "Cartão de crédito",
        status: "Pendente",
        data_caixa: null,
        // 1x não leva rótulo: "1/1" afirmaria parcelamento que não houve.
        parcelamento: null,
        valor: 629.9,
      },
    ]);
  });

  it("629,90 em 3x vira três pendências rotuladas n/N", () => {
    const parcelas = sumup("credito", 3, 629.9);

    expect(parcelas.map((p) => p.parcelamento)).toEqual(["1/3", "2/3", "3/3"]);
    expect(parcelas.map((p) => p.valor)).toEqual([209.96, 209.96, 209.98]);
    expect(parcelas.every((p) => p.status === "Pendente")).toBe(true);
    // Inclusive a primeira: nenhuma parcela de crédito nasce com data.
    expect(parcelas.every((p) => p.data_caixa === null)).toBe(true);
  });

  it("a primeira parcela de crédito não nasce Paga nem por engano", () => {
    expect(sumup("credito", 4, 1200)[0]).toMatchObject({
      status: "Pendente",
      data_caixa: null,
      parcelamento: "1/4",
    });
  });

  it("fora da maquininha segue como era: uma linha, Paga", () => {
    expect(
      parcelasDaForma(
        { instituicao: "Dinheiro", modalidade: null, parcelas: 1, valor: 480 },
        CAIXA,
      ),
    ).toEqual([
      {
        forma_pagamento: "Dinheiro",
        status: "Pago",
        data_caixa: CAIXA,
        parcelamento: null,
        valor: 480,
      },
    ]);
  });

  it("instituição que não diz como o dinheiro andou continua sem forma", () => {
    expect(
      parcelasDaForma(
        { instituicao: "Nubank", modalidade: null, parcelas: 1, valor: 480 },
        CAIXA,
      )[0]?.forma_pagamento,
    ).toBeNull();
  });
});

describe("conta parcelada inteira", () => {
  const itens = [
    {
      tipo: "servico",
      refId: SERVICO,
      quantidade: "1",
      valorUnitario: "629,90",
    },
  ];

  it("fecha: o total confere com o VALOR DA FORMA, não com as parcelas", () => {
    // A trava de total olha os 629,90 da forma. Se olhasse as parcelas
    // arredondadas, uma conta legítima seria recusada por um centavo.
    const saida = contaSchema.safeParse({
      data_caixa: "2026-09-14",
      itens,
      formas: [
        {
          instituicao: "SumUp",
          titularidade: "",
          modalidade: "credito",
          parcelas: "3",
          valor: "629,90",
        },
      ],
    });

    expect(saida.success).toBe(true);
    expect(saida.data?.formas[0]).toMatchObject({
      modalidade: "credito",
      parcelas: 3,
      // A maquininha é do CNPJ: titularidade conhecida, não perguntada.
      titularidade: "PJ",
    });
  });

  it("conta mista gera o Pago do dinheiro e as pendências do crédito", () => {
    const conta = contaSchema.parse({
      data_caixa: "2026-09-14",
      itens,
      formas: [
        {
          instituicao: "Dinheiro",
          titularidade: "",
          modalidade: "",
          parcelas: "1",
          valor: "129,90",
        },
        {
          instituicao: "SumUp",
          titularidade: "",
          modalidade: "credito",
          parcelas: "2",
          valor: "500,00",
        },
      ],
    });

    const linhas = conta.formas.flatMap((forma) =>
      parcelasDaForma(forma, conta.data_caixa),
    );

    expect(linhas).toHaveLength(3);
    expect(linhas.map((linha) => linha.status)).toEqual([
      "Pago",
      "Pendente",
      "Pendente",
    ]);
    expect(linhas.map((linha) => linha.parcelamento)).toEqual([
      null,
      "1/2",
      "2/2",
    ]);
    // O dinheiro gravado soma exatamente o que ela cobrou.
    expect(
      linhas.reduce((soma, linha) => soma + emCentavos(linha.valor), 0),
    ).toBe(62_990);
  });

  it("a leitura do formulário carrega modalidade e parcelas", () => {
    const formData = new FormData();

    formData.set("data_caixa", "2026-09-14");
    formData.append("item_tipo", "servico");
    formData.append("item_ref", SERVICO);
    formData.append("item_quantidade", "1");
    formData.append("item_valor", "629,90");

    formData.append("forma_instituicao", "SumUp");
    formData.append("forma_titularidade", "");
    formData.append("forma_modalidade", "credito");
    formData.append("forma_parcelas", "3");
    formData.append("forma_valor", "629,90");

    expect(lerConta(formData).formas).toEqual([
      {
        instituicao: "SumUp",
        titularidade: "",
        modalidade: "credito",
        parcelas: "3",
        valor: "629,90",
      },
    ]);
  });
});
