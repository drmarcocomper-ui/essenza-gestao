import { describe, expect, it } from "vitest";

import {
  categoriaDaConta,
  contaSchema,
  descricaoDaConta,
  diferencaConta,
  exigeTitularidade,
  formaContaSchema,
  FORMA_POR_INSTITUICAO,
  itemContaSchema,
  lerConta,
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
      valor: "480,00",
    });

    expect(erro.success).toBe(false);
    expect(erro.error?.issues[0]?.path).toEqual(["titularidade"]);
  });

  it("aceita a forma sem titularidade onde ela não é pedida", () => {
    const forma = formaContaSchema.parse({
      instituicao: "Dinheiro",
      titularidade: "",
      valor: "480,00",
    });

    expect(forma).toMatchObject({ titularidade: null, valor: 480 });
  });

  it("não deixa passar instituição fora da lista fechada", () => {
    expect(
      formaContaSchema.safeParse({
        instituicao: "Stone",
        titularidade: "",
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
  it("segue o item de maior valor", () => {
    expect(
      categoriaDaConta([
        item(150, 1, { categoria: "corte" }),
        item(350, 1, { categoria: "coloracao" }),
      ]),
    ).toBe("Coloração");
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

  it("soma as linhas da mesma categoria antes de comparar", () => {
    expect(
      categoriaDaConta([
        item(200, 1, { categoria: "coloracao" }),
        item(120, 1, { categoria: "tratamento" }),
        item(120, 1, { categoria: "tratamento" }),
      ]),
    ).toBe("Tratamento");
  });

  it("empate fica com o primeiro item, que é o caso da cortesia", () => {
    expect(
      categoriaDaConta([
        item(0, 1, { categoria: "corte" }),
        item(0, 1, { tipo: "produto" }),
      ]),
    ).toBe("Corte");
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
        { instituicao: "SumUp", titularidade: "", valor: "300,00" },
        { instituicao: "Nubank", titularidade: "PF", valor: "180,00" },
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
      formas: [{ instituicao: "Dinheiro", titularidade: "", valor: "400,00" }],
    });

    expect(saida.success).toBe(false);
    expect(saida.error?.issues[0]?.message).toContain("Faltam");
    expect(saida.error?.issues[0]?.message).toContain("80,00");
  });

  it("recusa fechar com sobra", () => {
    const saida = contaSchema.safeParse({
      data_caixa: "2026-09-14",
      itens,
      formas: [{ instituicao: "Dinheiro", titularidade: "", valor: "500,00" }],
    });

    expect(saida.success).toBe(false);
    expect(saida.error?.issues[0]?.message).toContain("Sobram");
  });

  it("recusa conta sem item", () => {
    expect(
      contaSchema.safeParse({
        data_caixa: "2026-09-14",
        itens: [],
        formas: [{ instituicao: "Dinheiro", titularidade: "", valor: "0,00" }],
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
        formas: [{ instituicao: "Dinheiro", titularidade: "", valor: "480,00" }],
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
      { instituicao: "Nubank", titularidade: "PJ", valor: "480,00" },
    ]);
    expect(contaSchema.safeParse(conta).success).toBe(true);
  });
});
