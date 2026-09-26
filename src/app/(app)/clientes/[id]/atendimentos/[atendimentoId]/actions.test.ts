import { beforeEach, describe, expect, it, vi } from "vitest";

import { MENSAGEM_CONTA_JA_ABERTA } from "@/lib/caixa/travas";

const { tabela, remover, filtros, revalidatePath, resposta } = vi.hoisted(() => ({
  tabela: vi.fn(),
  remover: vi.fn(),
  /** Cada filtro encadeado no delete, na ordem: ["eq", coluna, valor]… */
  filtros: [] as unknown[][],
  revalidatePath: vi.fn(),
  /** O que o próximo delete devolve. */
  resposta: {
    data: [] as { id: string }[] | null,
    error: null as null | { message: string },
  },
}));

vi.mock("next/cache", () => ({ revalidatePath }));
vi.mock("@/lib/atendimentos/consultas", () => ({
  listarProdutosParaConferencia: vi.fn(),
  listarProdutosRevenda: vi.fn(),
  listarServicos: vi.fn(),
  obterAtendimento: vi.fn(),
}));
vi.mock("@/lib/auth", () => ({
  exigirSessao: async () => ({
    supabase: {
      from: (nome: string) => {
        tabela(nome);

        return {
          delete: () => {
            remover();

            // Só `eq` e `select` existem: um `.not()`/`.is()` aqui
            // quebraria o teste, que é o que se quer.
            const cadeia = {
              eq: (...args: unknown[]) => {
                filtros.push(["eq", ...args]);
                return cadeia;
              },
              select: async (colunas: string) => {
                filtros.push(["select", colunas]);
                return resposta;
              },
            };

            return cadeia;
          },
        };
      },
    },
  }),
}));

import { reabrirConta } from "./actions";

const CLIENTE = "44444444-4444-4444-8444-444444444444";
const ATENDIMENTO = "55555555-5555-4555-8555-555555555555";

beforeEach(() => {
  tabela.mockReset();
  remover.mockReset();
  revalidatePath.mockReset();
  filtros.length = 0;
  resposta.data = [];
  resposta.error = null;
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
