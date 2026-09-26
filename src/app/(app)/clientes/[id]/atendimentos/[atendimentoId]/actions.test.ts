import { beforeEach, describe, expect, it, vi } from "vitest";

import { MENSAGEM_CONTA_JA_ABERTA } from "@/lib/caixa/travas";

const {
  tabela,
  remover,
  inserir,
  filtros,
  revalidatePath,
  resposta,
  respostaInsert,
  obterAtendimento,
  listarServicos,
  listarProdutosRevenda,
  lerPecasParaConta,
} = vi.hoisted(() => ({
  tabela: vi.fn(),
  remover: vi.fn(),
  /** Cada insert: (tabela, linhas). */
  inserir: vi.fn(),
  /** Cada filtro encadeado no delete, na ordem: ["eq", coluna, valor]… */
  filtros: [] as unknown[][],
  revalidatePath: vi.fn(),
  /** O que o próximo delete devolve. */
  resposta: {
    data: [] as { id: string }[] | null,
    error: null as null | { message: string },
  },
  /** O que o insert de cada tabela devolve. */
  respostaInsert: {} as Record<
    string,
    { error: null | { code?: string; message: string; details?: string } }
  >,
  obterAtendimento: vi.fn(),
  listarServicos: vi.fn(),
  listarProdutosRevenda: vi.fn(),
  lerPecasParaConta: vi.fn(),
}));

vi.mock("next/cache", () => ({ revalidatePath }));
vi.mock("@/lib/atendimentos/consultas", () => ({
  listarProdutosParaConferencia: vi.fn(async () => []),
  listarProdutosRevenda,
  listarServicos,
  obterAtendimento,
}));
vi.mock("@/lib/pecas-extensao/consultas", () => ({ lerPecasParaConta }));
vi.mock("@/lib/auth", () => ({
  exigirSessao: async () => ({
    supabase: {
      from: (nome: string) => {
        tabela(nome);

        return {
          delete: () => {
            remover();

            // Só `eq` e `select` existem: um `.not()`/`.is()` aqui
            // quebraria o teste, que é o que se quer. O `then` deixa o
            // delete sem `select` (limpeza dos itens) ser aguardado.
            const cadeia = {
              eq: (...args: unknown[]) => {
                filtros.push(["eq", ...args]);
                return cadeia;
              },
              select: async (colunas: string) => {
                filtros.push(["select", colunas]);
                return resposta;
              },
              then: (resolver: (valor: { error: null }) => unknown) =>
                resolver({ error: null }),
            };

            return cadeia;
          },
          insert: async (linhas: unknown) => {
            inserir(nome, linhas);
            return respostaInsert[nome] ?? { error: null };
          },
        };
      },
    },
  }),
}));

import { fecharConta, reabrirConta } from "./actions";

const CLIENTE = "44444444-4444-4444-8444-444444444444";
const ATENDIMENTO = "55555555-5555-4555-8555-555555555555";
const OUTRO_ATENDIMENTO = "66666666-6666-4666-8666-666666666666";
const SERVICO = "11111111-1111-4111-8111-111111111111";
const PECA = "33333333-3333-4333-8333-333333333333";

beforeEach(() => {
  vi.clearAllMocks();
  tabela.mockReset();
  remover.mockReset();
  revalidatePath.mockReset();
  filtros.length = 0;
  resposta.data = [];
  resposta.error = null;
  inserir.mockReset();
  for (const nome of Object.keys(respostaInsert)) delete respostaInsert[nome];
  obterAtendimento.mockResolvedValue({
    id: ATENDIMENTO,
    clienteId: CLIENTE,
    data: "2026-09-20",
    observacao: null,
    itens: [],
    formas: [],
    formulaId: null,
    fechada: false,
  });
  listarServicos.mockResolvedValue([
    { id: SERVICO, nome: "Manutenção", categoria: "extensao", preco: 300, semPreco: false },
  ]);
  listarProdutosRevenda.mockResolvedValue([]);
  lerPecasParaConta.mockResolvedValue([
    { id: PECA, codigo: "1254", temFilhas: false, atendimentoDoItem: null },
  ]);
});

describe("reabrirConta", () => {
  it("um único delete em lancamentos, pelo atendimento_id exato", async () => {
    resposta.data = [{ id: "a" }, { id: "b" }, { id: "c" }];

    const resultado = await reabrirConta(CLIENTE, ATENDIMENTO);

    expect(resultado).toEqual({});
    expect(tabela).toHaveBeenCalledTimes(1);
    expect(tabela).toHaveBeenCalledWith("lancamentos");
    expect(remover).toHaveBeenCalledTimes(1);
    expect(filtros).toEqual([
      ["eq", "atendimento_id", ATENDIMENTO],
      ["select", "id"],
    ]);
  });

  it("revalida o atendimento, a ficha, o Caixa, A receber e cada edição apagada", async () => {
    resposta.data = [{ id: "a" }, { id: "b" }];

    await reabrirConta(CLIENTE, ATENDIMENTO);

    const caminhos = revalidatePath.mock.calls.map(([caminho]) => caminho);

    expect(caminhos).toEqual(
      expect.arrayContaining([
        `/clientes/${CLIENTE}/atendimentos/${ATENDIMENTO}`,
        `/clientes/${CLIENTE}`,
        "/caixa",
        "/caixa/pendentes",
        "/caixa/a/editar",
        "/caixa/b/editar",
      ]),
    );
  });

  it("zero linhas: a conta já estava aberta", async () => {
    resposta.data = [];

    const resultado = await reabrirConta(CLIENTE, ATENDIMENTO);

    expect(resultado).toEqual({ erro: MENSAGEM_CONTA_JA_ABERTA });
    expect(revalidatePath).not.toHaveBeenCalled();
  });

  it("erro do banco volta como mensagem, não como exceção", async () => {
    resposta.data = null;
    resposta.error = { message: "falhou" };

    const resultado = await reabrirConta(CLIENTE, ATENDIMENTO);

    expect(resultado).toEqual({
      erro: "Não foi possível reabrir a conta: falhou",
    });
    expect(revalidatePath).not.toHaveBeenCalled();
  });
});

type Item = { tipo: string; ref: string; quantidade?: string; valor: string };

/** A conta como o FecharConta a posta: listas paralelas e uma forma. */
function conta(itens: Item[], total: string) {
  const dados = new FormData();

  dados.set("data_caixa", "2026-09-20");

  for (const item of itens) {
    dados.append("item_tipo", item.tipo);
    dados.append("item_ref", item.ref);
    dados.append("item_nome", "");
    dados.append("item_novo", "0");
    dados.append("item_quantidade", item.quantidade ?? "1");
    dados.append("item_valor", item.valor);
  }

  dados.append("forma_instituicao", "Dinheiro");
  dados.append("forma_titularidade", "");
  dados.append("forma_modalidade", "");
  dados.append("forma_parcelas", "1");
  dados.append("forma_valor", total);

  return dados;
}

const ITEM_PECA: Item = { tipo: "peca_extensao", ref: PECA, valor: "1.200,00" };

function fechar(dados: FormData) {
  return fecharConta(CLIENTE, ATENDIMENTO, {}, dados);
}

/** As linhas que foram para `atendimento_itens`, se foram. */
function itensInseridos() {
  const chamada = inserir.mock.calls.find(([nome]) => nome === "atendimento_itens");

  return chamada?.[1] as Record<string, unknown>[] | undefined;
}

describe("fecharConta com peça de extensão", () => {
  it("grava o item com as três referências certas e a descrição do banco", async () => {
    const saida = await fechar(
      conta(
        [{ tipo: "servico", ref: SERVICO, valor: "300,00" }, ITEM_PECA],
        "1.500,00",
      ),
    );

    expect(saida).toEqual({});
    expect(lerPecasParaConta).toHaveBeenCalledWith([PECA]);
    expect(itensInseridos()).toEqual([
      {
        atendimento_id: ATENDIMENTO,
        tipo: "servico",
        servico_id: SERVICO,
        produto_id: null,
        peca_extensao_id: null,
        descricao: "Manutenção",
        quantidade: 1,
        valor_unitario: 300,
      },
      {
        atendimento_id: ATENDIMENTO,
        tipo: "peca_extensao",
        servico_id: null,
        produto_id: null,
        peca_extensao_id: PECA,
        descricao: "Extensão 1254",
        quantidade: 1,
        valor_unitario: 1200,
      },
    ]);

    // Conta mista serviço + peça: categoria "Serviço", como hoje.
    const lancamentos = inserir.mock.calls.find(([nome]) => nome === "lancamentos")?.[1] as {
      categoria: string;
    }[];

    expect(lancamentos[0].categoria).toBe("Serviço");
  });

  it("só a peça: categoria Produto", async () => {
    await fechar(conta([ITEM_PECA], "1.200,00"));

    const lancamentos = inserir.mock.calls.find(([nome]) => nome === "lancamentos")?.[1] as {
      categoria: string;
    }[];

    expect(lancamentos[0].categoria).toBe("Produto");
  });

  it("peça de outra conta: recusada, sem apagar nem inserir nada", async () => {
    lerPecasParaConta.mockResolvedValue([
      { id: PECA, codigo: "1254", temFilhas: false, atendimentoDoItem: OUTRO_ATENDIMENTO },
    ]);

    expect(await fechar(conta([ITEM_PECA], "1.200,00"))).toEqual({
      erros: { itens: "A peça 1254 já está em outra conta." },
    });
    expect(inserir).not.toHaveBeenCalled();
    expect(remover).not.toHaveBeenCalled();
  });

  it("peça desta mesma conta (reaberta) passa", async () => {
    lerPecasParaConta.mockResolvedValue([
      { id: PECA, codigo: "1254", temFilhas: false, atendimentoDoItem: ATENDIMENTO },
    ]);

    expect(await fechar(conta([ITEM_PECA], "1.200,00"))).toEqual({});
    expect(itensInseridos()?.[0]).toMatchObject({ peca_extensao_id: PECA });
  });

  it("peça com partes: recusada, sem inserir", async () => {
    lerPecasParaConta.mockResolvedValue([
      { id: PECA, codigo: "1254", temFilhas: true, atendimentoDoItem: null },
    ]);

    expect(await fechar(conta([ITEM_PECA], "1.200,00"))).toEqual({
      erros: { itens: "A peça 1254 foi desmembrada: escolha uma das partes." },
    });
    expect(inserir).not.toHaveBeenCalled();
  });

  it("peça que não existe mais: recusada", async () => {
    lerPecasParaConta.mockResolvedValue([]);

    expect((await fechar(conta([ITEM_PECA], "1.200,00"))).erros?.itens).toBe(
      "Uma das peças de extensão não existe mais.",
    );
    expect(inserir).not.toHaveBeenCalled();
  });

  it("a mesma peça duas vezes: recusada antes do banco", async () => {
    expect(
      (await fechar(conta([ITEM_PECA, ITEM_PECA], "2.400,00"))).erros?.itens,
    ).toBe("A mesma peça de extensão entrou duas vezes na conta.");
    expect(inserir).not.toHaveBeenCalled();
  });

  it("quantidade 2: recusada pelo schema, sem ler nem gravar", async () => {
    const saida = await fechar(conta([{ ...ITEM_PECA, quantidade: "2" }], "2.400,00"));

    expect(saida.erros?.itens).toBe("Peça de extensão é uma unidade só.");
    expect(lerPecasParaConta).not.toHaveBeenCalled();
    expect(inserir).not.toHaveBeenCalled();
  });

  it("23505 do índice único da 020 vira “A peça X já está em outra conta.”", async () => {
    respostaInsert.atendimento_itens = {
      error: {
        code: "23505",
        message:
          'duplicate key value violates unique constraint "uq_atendimento_itens_peca_extensao"',
        details: `Key (peca_extensao_id)=(${PECA}) already exists.`,
      },
    };

    const saida = await fechar(conta([ITEM_PECA], "1.200,00"));

    expect(saida.mensagem).toMatch(/^A peça 1254 já está em outra conta\. /);
    expect(saida.mensagem).not.toContain("Tente de novo");
    // O dinheiro não entra.
    expect(inserir.mock.calls.some(([nome]) => nome === "lancamentos")).toBe(false);
  });
});
