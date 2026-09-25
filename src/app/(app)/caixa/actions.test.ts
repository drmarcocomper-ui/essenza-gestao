import { beforeEach, describe, expect, it, vi } from "vitest";

import type { Lancamento } from "@/lib/caixa/consultas";
import { MENSAGEM_COMPETENCIA_TRAVADA } from "@/lib/caixa/schema";

const { obterLancamento, update, redirect } = vi.hoisted(() => ({
  obterLancamento: vi.fn(),
  update: vi.fn(),
  redirect: vi.fn(),
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
      }),
    },
  }),
}));

import { atualizarLancamento } from "./actions";

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

function formulario(dataCompetencia: string) {
  const dados = new FormData();

  for (const [campo, valor] of Object.entries({
    tipo: "Entrada",
    data_competencia: dataCompetencia,
    data_caixa: "",
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
  })) {
    dados.set(campo, valor);
  }

  return dados;
}

beforeEach(() => {
  obterLancamento.mockReset();
  update.mockReset();
  redirect.mockReset();
});

describe("editar lançamento: competência", () => {
  it("recusa mudar a competência de parcela vinda de fechamento", async () => {
    obterLancamento.mockResolvedValue(linha(ATENDIMENTO));

    const estado = await atualizarLancamento(ID, {}, formulario("2026-10-23"));

    expect(estado.erros?.data_competencia).toBe(MENSAGEM_COMPETENCIA_TRAVADA);
    expect(update).not.toHaveBeenCalled();
    expect(redirect).not.toHaveBeenCalled();
  });

  it("parcela de fechamento salva o resto quando a competência não muda", async () => {
    obterLancamento.mockResolvedValue(linha(ATENDIMENTO));

    await atualizarLancamento(ID, {}, formulario("2026-09-23"));

    expect(update).toHaveBeenCalledWith(
      expect.objectContaining({ data_competencia: "2026-09-23" }),
    );
    expect(redirect).toHaveBeenCalledWith("/caixa?mes=2026-09");
  });

  it("lançamento manual continua com a competência editável", async () => {
    obterLancamento.mockResolvedValue(linha(null));

    await atualizarLancamento(ID, {}, formulario("2026-10-23"));

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

    const estado = await atualizarLancamento(ID, {}, formulario("2026-09-23"));

    expect(estado.mensagem).toBe("Este lançamento não existe mais.");
    expect(update).not.toHaveBeenCalled();
  });
});
