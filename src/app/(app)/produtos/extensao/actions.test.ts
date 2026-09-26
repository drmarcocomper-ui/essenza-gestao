import { beforeEach, describe, expect, it, vi } from "vitest";

import type { PecaExtensao } from "@/lib/pecas-extensao/consultas";
import {
  MENSAGEM_CODIGO_REPETIDO_PARTES,
  MENSAGEM_CUSTO_PARTE_OBRIGATORIO,
  MENSAGEM_CUSTO_TRAVADO_MAE,
  MENSAGEM_CUSTO_TRAVADO_PARTE,
  MENSAGEM_DESFAZER_TRAVADO,
  MENSAGEM_DESMEMBRAR_SEM_CUSTO,
  MENSAGEM_EXCLUSAO_PARTE,
  MENSAGEM_JA_DESMEMBRADA,
  MENSAGEM_QUANTIDADE_PARTES,
  MENSAGEM_SEM_PARTES,
} from "@/lib/pecas-extensao/regras";
import { CAMPOS_PECA, type CampoPeca } from "@/lib/pecas-extensao/schema";

const {
  obterPeca,
  pecaTemFilhas,
  listarCodigos,
  listarPartes,
  algumaTemFilhas,
  obterContaDaPeca,
  listarContasDasPecas,
  insert,
  update,
  remover,
  resultado,
} = vi.hoisted(() => ({
  obterPeca: vi.fn(),
  pecaTemFilhas: vi.fn(),
  listarCodigos: vi.fn(),
  listarPartes: vi.fn(),
  algumaTemFilhas: vi.fn(),
  obterContaDaPeca: vi.fn(),
  listarContasDasPecas: vi.fn(),
  insert: vi.fn(),
  update: vi.fn(),
  remover: vi.fn(),
  /** O que o próximo comando no banco devolve. */
  resultado: { error: null as null | { code?: string; details?: string; message: string } },
}));

vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));
vi.mock("next/navigation", () => ({ redirect: vi.fn() }));
vi.mock("@/lib/pecas-extensao/consultas", () => ({
  obterPeca,
  pecaTemFilhas,
  listarCodigos,
  listarPartes,
  algumaTemFilhas,
  obterContaDaPeca,
  listarContasDasPecas,
}));
vi.mock("@/lib/auth", () => ({
  exigirSessao: async () => ({
    supabase: {
      from: () => ({
        insert: async (linhas: unknown) => {
          insert(linhas);
          return resultado;
        },
        update: (dados: unknown) => {
          update(dados);
          return { eq: async () => resultado };
        },
        delete: () => ({
          eq: async (coluna: string, valor: string) => {
            remover(coluna, valor);
            return resultado;
          },
        }),
      }),
    },
  }),
}));

import {
  atualizarPeca,
  desfazerDesmembramento,
  desmembrarPeca,
  excluirPeca,
} from "./actions";

const MAE = "11111111-1111-4111-8111-111111111111";

function peca(extra: Partial<PecaExtensao> = {}): PecaExtensao {
  return {
    id: MAE,
    codigo: "1254",
    pecaMaeId: null,
    cor: "Castanho",
    textura: "Liso",
    gramas: 100,
    comprimentoCm: 55,
    precoCompra: 100,
    precoVenda: null,
    origem: null,
    numeroOrigem: null,
    dataEntrada: null,
    observacoes: null,
    ...extra,
  };
}

function parte(codigo: string, precoCompra: string, extra: Partial<Record<CampoPeca, string>> = {}) {
  return {
    ...Object.fromEntries(CAMPOS_PECA.map((campo) => [campo, ""])),
    codigo,
    preco_compra: precoCompra,
    ...extra,
  };
}

function formulario(campos: Partial<Record<CampoPeca, string>>) {
  const dados = new FormData();

  for (const campo of CAMPOS_PECA) dados.set(campo, campos[campo] ?? "");

  return dados;
}

beforeEach(() => {
  vi.clearAllMocks();
  resultado.error = null;
  obterPeca.mockResolvedValue(peca());
  pecaTemFilhas.mockResolvedValue(false);
  listarCodigos.mockResolvedValue([{ id: MAE, codigo: "1254" }]);
  listarPartes.mockResolvedValue([
    peca({ id: "a", codigo: "1254-a", pecaMaeId: MAE }),
    peca({ id: "b", codigo: "1254-b", pecaMaeId: MAE }),
  ]);
  algumaTemFilhas.mockResolvedValue(false);
  obterContaDaPeca.mockResolvedValue(null);
  listarContasDasPecas.mockResolvedValue({});
});

describe("desmembrarPeca", () => {
  it("grava todas as partes num insert só, apontando para a mãe", async () => {
    const saida = await desmembrarPeca(MAE, [
      parte("1254-a", "33,33"),
      parte("1254-b", "33,33"),
      parte("1254-c", "33,34"),
    ]);

    expect(saida).toEqual({});
    expect(insert).toHaveBeenCalledTimes(1);

    const linhas = insert.mock.calls[0][0] as { codigo: string; peca_mae_id: string; preco_compra: number }[];

    expect(linhas.map((l) => l.codigo)).toEqual(["1254-a", "1254-b", "1254-c"]);
    expect(linhas.every((l) => l.peca_mae_id === MAE)).toBe(true);
    expect(linhas.map((l) => l.preco_compra)).toEqual([33.33, 33.33, 33.34]);
  });

  it("recusa soma que não fecha, sem gravar nada", async () => {
    const saida = await desmembrarPeca(MAE, [
      parte("1254-a", "33,33"),
      parte("1254-b", "33,33"),
      parte("1254-c", "33,33"),
    ]);

    expect(saida.mensagem).toMatch(/faltam R\$\s0,01/);
    expect(insert).not.toHaveBeenCalled();
  });

  it("fecha em centavos: 0,10 + 0,20 com mãe de 0,30", async () => {
    obterPeca.mockResolvedValue(peca({ precoCompra: 0.3 }));

    expect(
      await desmembrarPeca(MAE, [parte("1254-a", "0,10"), parte("1254-b", "0,20")]),
    ).toEqual({});
  });

  it.each([[[]], [[parte("1254-a", "100,00")]], ["lixo"]])(
    "recusa quantidade fora de 2 a 10: %j",
    async (partes) => {
      expect((await desmembrarPeca(MAE, partes)).mensagem).toBe(
        MENSAGEM_QUANTIDADE_PARTES,
      );
      expect(insert).not.toHaveBeenCalled();
    },
  );

  it("recusa 11 partes", async () => {
    const partes = Array.from({ length: 11 }, (_, i) => parte(`p${i}`, i === 0 ? "100,00" : "0,00"));

    expect((await desmembrarPeca(MAE, partes)).mensagem).toBe(MENSAGEM_QUANTIDADE_PARTES);
  });

  it("recusa mãe já desmembrada", async () => {
    pecaTemFilhas.mockResolvedValue(true);

    expect(
      (await desmembrarPeca(MAE, [parte("a", "50,00"), parte("b", "50,00")])).mensagem,
    ).toBe(MENSAGEM_JA_DESMEMBRADA);
    expect(insert).not.toHaveBeenCalled();
  });

  it("recusa mãe sem custo", async () => {
    obterPeca.mockResolvedValue(peca({ precoCompra: null }));

    expect(
      (await desmembrarPeca(MAE, [parte("a", "50,00"), parte("b", "50,00")])).mensagem,
    ).toBe(MENSAGEM_DESMEMBRAR_SEM_CUSTO);
  });

  it("exige o preço de compra de cada parte", async () => {
    const saida = await desmembrarPeca(MAE, [parte("a", "100,00"), parte("b", "")]);

    expect(saida.erros?.[1]?.preco_compra).toBe(MENSAGEM_CUSTO_PARTE_OBRIGATORIO);
    expect(insert).not.toHaveBeenCalled();
  });

  it("recusa código repetido entre as partes, sem caixa e espaço", async () => {
    const saida = await desmembrarPeca(MAE, [
      parte("1254-a", "50,00"),
      parte(" 1254-A ", "50,00"),
    ]);

    expect(saida.erros?.[1]?.codigo).toBe(MENSAGEM_CODIGO_REPETIDO_PARTES);
    expect(saida.erros?.[0]?.codigo).toBeUndefined();
    expect(insert).not.toHaveBeenCalled();
  });

  it("recusa código que já existe no banco", async () => {
    listarCodigos.mockResolvedValue([
      { id: MAE, codigo: "1254" },
      { id: "x", codigo: "1254-B" },
    ]);

    const saida = await desmembrarPeca(MAE, [
      parte("1254-a", "50,00"),
      parte("1254-b", "50,00"),
    ]);

    expect(saida.erros?.[1]?.codigo).toBe("Já existe a peça 1254-B.");
    expect(insert).not.toHaveBeenCalled();
  });

  it("23505 no insert vira “Já existe a peça X”", async () => {
    resultado.error = {
      code: "23505",
      details: "Key (lower(TRIM(BOTH FROM codigo)))=(1254-b) already exists.",
      message: "duplicate key",
    };

    expect(
      (await desmembrarPeca(MAE, [parte("1254-a", "50,00"), parte("1254-B", "50,00")]))
        .mensagem,
    ).toBe("Já existe a peça 1254-B.");
  });
});

describe("atualizarPeca: preço de compra travado", () => {
  const ATUAL = { codigo: "1254", preco_compra: "100,00" };

  it("mãe desmembrada: recusa mudar o custo", async () => {
    pecaTemFilhas.mockResolvedValue(true);

    const saida = await atualizarPeca(
      MAE,
      {},
      formulario({ ...ATUAL, preco_compra: "120,00" }),
    );

    expect(saida.erros?.preco_compra).toBe(MENSAGEM_CUSTO_TRAVADO_MAE);
    expect(update).not.toHaveBeenCalled();
  });

  it("parte: recusa mudar o custo", async () => {
    obterPeca.mockResolvedValue(peca({ pecaMaeId: "mae" }));

    const saida = await atualizarPeca(
      MAE,
      {},
      formulario({ ...ATUAL, preco_compra: "99,99" }),
    );

    expect(saida.erros?.preco_compra).toBe(MENSAGEM_CUSTO_TRAVADO_PARTE);
    expect(update).not.toHaveBeenCalled();
  });

  it("parte: salva os outros campos, sem custo, código nem peca_mae_id no update", async () => {
    obterPeca.mockResolvedValue(peca({ pecaMaeId: "mae" }));

    await atualizarPeca(MAE, {}, formulario({ ...ATUAL, cor: "Loiro" }));

    const alteracao = update.mock.calls[0][0] as Record<string, unknown>;

    expect(alteracao.cor).toBe("Loiro");
    expect(alteracao).not.toHaveProperty("preco_compra");
    expect(alteracao).not.toHaveProperty("codigo");
    expect(alteracao).not.toHaveProperty("peca_mae_id");
  });

  it("peça sem partes: custo muda", async () => {
    await atualizarPeca(MAE, {}, formulario({ ...ATUAL, preco_compra: "120,00" }));

    expect(update.mock.calls[0][0]).toMatchObject({ preco_compra: 120 });
  });
});

describe("excluirPeca", () => {
  it("parte não sai sozinha", async () => {
    obterPeca.mockResolvedValue(peca({ pecaMaeId: "mae" }));

    expect(await excluirPeca(MAE)).toEqual({ erro: MENSAGEM_EXCLUSAO_PARTE });
    expect(remover).not.toHaveBeenCalled();
  });

  it("peça sem partes e que não é parte é excluída", async () => {
    expect(await excluirPeca(MAE)).toEqual({});
    expect(remover).toHaveBeenCalledWith("id", MAE);
  });
});

describe("desfazerDesmembramento", () => {
  it("apaga todas as partes num delete só, por peca_mae_id", async () => {
    expect(await desfazerDesmembramento(MAE)).toEqual({});
    expect(remover).toHaveBeenCalledTimes(1);
    expect(remover).toHaveBeenCalledWith("peca_mae_id", MAE);
    expect(algumaTemFilhas).toHaveBeenCalledWith(["a", "b"]);
  });

  it("recusa se alguma parte também foi desmembrada", async () => {
    algumaTemFilhas.mockResolvedValue(true);

    expect(await desfazerDesmembramento(MAE)).toEqual({
      erro: MENSAGEM_DESFAZER_TRAVADO,
    });
    expect(remover).not.toHaveBeenCalled();
  });

  it("23503 vira o mesmo recado", async () => {
    resultado.error = { code: "23503", message: "violates foreign key" };

    expect(await desfazerDesmembramento(MAE)).toEqual({
      erro: MENSAGEM_DESFAZER_TRAVADO,
    });
  });

  it("peça sem partes não tem o que desfazer", async () => {
    listarPartes.mockResolvedValue([]);

    expect(await desfazerDesmembramento(MAE)).toEqual({
      erro: MENSAGEM_SEM_PARTES,
    });
    expect(remover).not.toHaveBeenCalled();
  });
});

describe("peça numa conta (020)", () => {
  const CONTA = {
    atendimentoId: "at-1",
    clienteId: "cl-1",
    clienteNome: "Maria Souza",
    data: "2026-09-12",
    fechada: true,
  };

  const NA_CONTA = "Esta peça está na conta de Maria Souza em 12/09/2026";

  /** O 23503 da FK nova, como o PostgREST devolve. */
  const FK_DA_CONTA = {
    code: "23503",
    message:
      'update or delete on table "pecas_extensao" violates foreign key constraint "atendimento_itens_peca_extensao_id_fkey" on table "atendimento_itens"',
    details: `Key (id)=(${MAE}) is still referenced from table "atendimento_itens".`,
  };

  it("atualizarPeca: código não muda", async () => {
    obterContaDaPeca.mockResolvedValue(CONTA);

    const saida = await atualizarPeca(
      MAE,
      {},
      formulario({ codigo: "1254-x", preco_compra: "100,00" }),
    );

    expect(saida.erros?.codigo).toBe(`${NA_CONTA}: o código não muda.`);
    expect(update).not.toHaveBeenCalled();
  });

  it("atualizarPeca: o resto salva, sem o código no update", async () => {
    obterContaDaPeca.mockResolvedValue(CONTA);

    await atualizarPeca(
      MAE,
      {},
      formulario({ codigo: "1254", preco_compra: "100,00", cor: "Loiro" }),
    );

    const alteracao = update.mock.calls[0][0] as Record<string, unknown>;

    expect(alteracao.cor).toBe("Loiro");
    expect(alteracao).not.toHaveProperty("codigo");
  });

  it("excluirPeca: recusa sem tocar no banco", async () => {
    obterContaDaPeca.mockResolvedValue(CONTA);

    expect(await excluirPeca(MAE)).toEqual({
      erro: `${NA_CONTA} e não pode ser excluída.`,
    });
    expect(remover).not.toHaveBeenCalled();
  });

  it("excluirPeca: 23503 da FK nova vira o recado de peça em conta", async () => {
    // Livre na leitura, numa conta no delete.
    obterContaDaPeca.mockResolvedValueOnce(null).mockResolvedValueOnce(CONTA);
    resultado.error = FK_DA_CONTA;

    expect(await excluirPeca(MAE)).toEqual({
      erro: `${NA_CONTA} e não pode ser excluída.`,
    });
  });

  it("excluirPeca: 23503 da FK nova sem conta relida ainda diz que é conta", async () => {
    resultado.error = FK_DA_CONTA;

    expect(await excluirPeca(MAE)).toEqual({
      erro: "Esta peça está numa conta e não pode ser excluída.",
    });
  });

  it("excluirPeca: 23503 das partes continua com o recado de desmembrada", async () => {
    resultado.error = {
      code: "23503",
      message:
        'update or delete on table "pecas_extensao" violates foreign key constraint "pecas_extensao_peca_mae_id_fkey" on table "pecas_extensao"',
    };

    expect((await excluirPeca(MAE)).erro).toMatch(/^Peça desmembrada/);
  });

  it("desmembrarPeca: recusa sem gravar", async () => {
    obterContaDaPeca.mockResolvedValue({ ...CONTA, fechada: false });

    expect(
      (await desmembrarPeca(MAE, [parte("a", "50,00"), parte("b", "50,00")])).mensagem,
    ).toBe(`${NA_CONTA} e não pode ser desmembrada.`);
    expect(insert).not.toHaveBeenCalled();
  });

  it("desfazerDesmembramento: parte numa conta impede, sem delete", async () => {
    listarContasDasPecas.mockResolvedValue({ b: CONTA });

    expect(await desfazerDesmembramento(MAE)).toEqual({
      erro: "A parte 1254-b está numa conta: o desmembramento não pode ser desfeito.",
    });
    expect(listarContasDasPecas).toHaveBeenCalledWith(["a", "b"]);
    expect(remover).not.toHaveBeenCalled();
  });

  it("desfazerDesmembramento: 23503 da FK nova vira o recado de parte em conta", async () => {
    resultado.error = { ...FK_DA_CONTA, details: 'Key (id)=(b) is still referenced from table "atendimento_itens".' };

    expect(await desfazerDesmembramento(MAE)).toEqual({
      erro: "Uma das partes está numa conta: o desmembramento não pode ser desfeito.",
    });
  });
});
