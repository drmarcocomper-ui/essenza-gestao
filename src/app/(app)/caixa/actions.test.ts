import { beforeEach, describe, expect, it, vi } from "vitest";

import type { Lancamento } from "@/lib/caixa/consultas";
import { lancamentoSchema, lerFormulario } from "@/lib/caixa/schema";
import {
  MENSAGEM_CAMPO_TRAVADO_CONTA,
  MENSAGEM_COMPETENCIA_TRAVADA,
  MENSAGEM_EXCLUSAO_CONTA,
  MENSAGEM_REABRA_A_CONTA,
} from "@/lib/caixa/travas";

const { obterLancamento, update, remover, filtros, redirect, apagadas } =
  vi.hoisted(() => ({
    obterLancamento: vi.fn(),
    update: vi.fn(),
    remover: vi.fn(),
    /** Cada filtro encadeado no delete, na ordem: ["eq", "id", ID]… */
    filtros: [] as unknown[][],
    redirect: vi.fn(),
    /** O que o próximo delete devolve em `data`. */
    apagadas: { linhas: [] as { id: string }[] },
  }));

vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));
vi.mock("next/navigation", () => ({ redirect }));
vi.mock("@/lib/clientes/consultas", () => ({ listarClientes: vi.fn() }));
vi.mock("@/lib/caixa/consultas", () => ({ obterLancamento }));
vi.mock("@/lib/auth", () => ({
  exigirSessao: async () => ({
    supabase: {
      from: () => ({
        update: (dados: unknown) => {
          update(dados);
          return { eq: async () => ({ error: null }) };
        },
        delete: () => {
          remover();

          const cadeia = {
            eq: (...args: unknown[]) => {
              filtros.push(["eq", ...args]);
              return cadeia;
            },
            is: (...args: unknown[]) => {
              filtros.push(["is", ...args]);
              return cadeia;
            },
            select: async () => ({ data: apagadas.linhas, error: null }),
          };

          return cadeia;
        },
      }),
    },
  }),
}));

import { atualizarLancamento, excluirLancamento } from "./actions";

const ID = "33333333-3333-4333-8333-333333333333";
const CLIENTE = "44444444-4444-4444-8444-444444444444";
const ATENDIMENTO = "55555555-5555-4555-8555-555555555555";

const linha = (atendimento_id: string | null): Lancamento => ({
  id: ID,
  data_competencia: "2026-09-23",
  data_caixa: null,
  tipo: "Entrada",
  categoria: "Coloração",
  descricao: "Coloração",
  cliente_id: CLIENTE,
  atendimento_id,
  data_prevista: "2026-12-22",
  fornecedor: null,
  forma_pagamento: "Cartão de crédito",
  instituicao: "SumUp",
  titularidade: "PJ",
  parcelamento: "3/3",
  valor: 209.98,
  status: "Pendente",
  observacoes: null,
  origem_registro: "app",
  cliente: { id: CLIENTE, nome: "Cliente" },
});

/** O formulário da linha acima, com o que o teste mudar por cima. */
function formulario(mudancas: Record<string, string> = {}) {
  const dados = new FormData();

  for (const [campo, valor] of Object.entries({
    tipo: "Entrada",
    data_competencia: "2026-09-23",
    data_caixa: "",
    data_prevista: "2026-12-22",
    categoria: "Coloração",
    descricao: "Coloração",
    cliente_id: CLIENTE,
    fornecedor: "",
    forma_pagamento: "Cartão de crédito",
    instituicao: "SumUp",
    titularidade: "PJ",
    parcelamento: "3/3",
    valor: "209,98",
    status: "Pendente",
    observacoes: "",
    ...mudancas,
  })) {
    dados.set(campo, valor);
  }

  return dados;
}

beforeEach(() => {
  obterLancamento.mockReset();
  update.mockReset();
  remover.mockReset();
  redirect.mockReset();
  filtros.length = 0;
  apagadas.linhas = [];
});

describe("editar lançamento: competência", () => {
  it("recusa mudar a competência de parcela vinda de fechamento", async () => {
    obterLancamento.mockResolvedValue(linha(ATENDIMENTO));

    const estado = await atualizarLancamento(
      ID,
      {},
      formulario({ data_competencia: "2026-10-23" }),
    );

    expect(estado.erros?.data_competencia).toBe(MENSAGEM_COMPETENCIA_TRAVADA);
    expect(update).not.toHaveBeenCalled();
    expect(redirect).not.toHaveBeenCalled();
  });

  it("parcela de fechamento salva o resto quando a competência não muda", async () => {
    obterLancamento.mockResolvedValue(linha(ATENDIMENTO));

    await atualizarLancamento(ID, {}, formulario());

    // Travado igual ao gravado passa, mas não entra no update.
    expect(update).toHaveBeenCalledTimes(1);
    expect(update.mock.calls[0][0]).not.toHaveProperty("data_competencia");
    expect(redirect).toHaveBeenCalledWith("/caixa?mes=2026-09");
  });

  it("lançamento manual continua com a competência editável", async () => {
    obterLancamento.mockResolvedValue(linha(null));

    await atualizarLancamento(
      ID,
      {},
      formulario({ data_competencia: "2026-10-23" }),
    );

    expect(update).toHaveBeenCalledWith(
      expect.objectContaining({
        data_competencia: "2026-10-23",
        mes_competencia: "2026-10",
      }),
    );
    expect(redirect).toHaveBeenCalledWith("/caixa?mes=2026-10");
  });

  it("lançamento que sumiu não é gravado", async () => {
    obterLancamento.mockResolvedValue(null);

    const estado = await atualizarLancamento(ID, {}, formulario());

    expect(estado.mensagem).toBe("Este lançamento não existe mais.");
    expect(update).not.toHaveBeenCalled();
  });
});

describe("editar lançamento de conta: travas", () => {
  it.each([
    ["valor", { valor: "250,00" }],
    ["parcelamento", { parcelamento: "1/3" }],
    ["cliente_id", { cliente_id: "66666666-6666-4666-8666-666666666666" }],
  ])("recusa mudar %s, sem tocar o banco", async (campo, mudanca) => {
    obterLancamento.mockResolvedValue(linha(ATENDIMENTO));

    const estado = await atualizarLancamento(ID, {}, formulario(mudanca));

    expect(estado.erros).toEqual({ [campo]: MENSAGEM_CAMPO_TRAVADO_CONTA });
    expect(estado.mensagem).toBe(MENSAGEM_REABRA_A_CONTA);
    // O que ela digitou volta para a tela, como em qualquer recusa.
    expect(estado.valores?.[campo as "valor"]).toBe(Object.values(mudanca)[0]);
    expect(update).not.toHaveBeenCalled();
    expect(redirect).not.toHaveBeenCalled();
  });

  it("recusa virar Saída", async () => {
    obterLancamento.mockResolvedValue(linha(ATENDIMENTO));

    const estado = await atualizarLancamento(
      ID,
      {},
      formulario({ tipo: "Saída", categoria: "Custo Fixo", fornecedor: "WELLA" }),
    );

    expect(estado.erros?.tipo).toBe(MENSAGEM_CAMPO_TRAVADO_CONTA);
    expect(update).not.toHaveBeenCalled();
  });

  it("aceita mudar a instituição, e grava só os editáveis", async () => {
    obterLancamento.mockResolvedValue(linha(ATENDIMENTO));

    await atualizarLancamento(
      ID,
      {},
      formulario({ instituicao: "Nubank", titularidade: "PF" }),
    );

    expect(update).toHaveBeenCalledWith({
      instituicao: "Nubank",
      titularidade: "PF",
      forma_pagamento: "Cartão de crédito",
      categoria: "Coloração",
      descricao: "Coloração",
      observacoes: null,
      status: "Pendente",
      data_caixa: null,
      data_prevista: "2026-12-22",
    });
    expect(redirect).toHaveBeenCalledWith("/caixa?mes=2026-09");
  });

  it("aceita marcar como pago pelo formulário, como hoje", async () => {
    obterLancamento.mockResolvedValue(linha(ATENDIMENTO));

    await atualizarLancamento(
      ID,
      {},
      formulario({ status: "Pago", data_caixa: "2026-09-24" }),
    );

    expect(update).toHaveBeenCalledWith(
      expect.objectContaining({ status: "Pago", data_caixa: "2026-09-24" }),
    );
  });
});

describe("editar lançamento manual: nada muda", () => {
  it("grava o formulário inteiro, com os campos que na conta são travados", async () => {
    obterLancamento.mockResolvedValue(linha(null));

    const mudancas = {
      valor: "250,00",
      parcelamento: "1/2",
      data_competencia: "2026-10-01",
      cliente_id: "66666666-6666-4666-8666-666666666666",
    };

    await atualizarLancamento(ID, {}, formulario(mudancas));

    // Exatamente o que o schema produz — o mesmo update de antes.
    expect(update).toHaveBeenCalledWith(
      lancamentoSchema.parse(lerFormulario(formulario(mudancas))),
    );
    expect(redirect).toHaveBeenCalledWith("/caixa?mes=2026-10");
  });
});

describe("excluir lançamento", () => {
  it("recusa excluir entrada de conta, sem chamar o delete", async () => {
    obterLancamento.mockResolvedValue(linha(ATENDIMENTO));

    const resultado = await excluirLancamento(ID);

    expect(resultado).toEqual({ erro: MENSAGEM_EXCLUSAO_CONTA });
    expect(remover).not.toHaveBeenCalled();
  });

  it("lançamento manual do app é excluído", async () => {
    obterLancamento.mockResolvedValue(linha(null));
    apagadas.linhas = [{ id: ID }];

    const resultado = await excluirLancamento(ID);

    expect(resultado).toEqual({});
    expect(remover).toHaveBeenCalledTimes(1);
    expect(filtros).toEqual([
      ["eq", "id", ID],
      ["eq", "origem_registro", "app"],
      ["is", "atendimento_id", null],
    ]);
  });

  it("lançamento da planilha: o banco não apaga, e a mensagem diz por quê", async () => {
    obterLancamento.mockResolvedValue({
      ...linha(null),
      origem_registro: "planilha",
    });
    apagadas.linhas = [];

    const resultado = await excluirLancamento(ID);

    expect(resultado.erro).toBe(
      "Este lançamento veio da planilha e não pode ser excluído aqui.",
    );
  });

  it("lançamento que sumiu não chama o delete", async () => {
    obterLancamento.mockResolvedValue(null);

    const resultado = await excluirLancamento(ID);

    expect(resultado.erro).toBe("Este lançamento não existe mais.");
    expect(remover).not.toHaveBeenCalled();
  });
});
