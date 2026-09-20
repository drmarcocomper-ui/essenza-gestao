import { describe, expect, it } from "vitest";

import { hoje } from "./mes";
import {
  confirmacaoRecebimentoSchema,
  errosPorCampo,
  lancamentoSchema,
  lerFormulario,
  MENSAGEM_DATA_FUTURA,
} from "./schema";

/**
 * As datas destes casos são relativas a hoje, não fixas: a regra do
 * futuro só se testa contra o relógio, e um "2026-09-21" cravado no
 * arquivo deixaria de ser futuro amanhã.
 */
function somarDias(data: string, dias: number) {
  const [ano, mes, dia] = data.split("-").map(Number);

  return new Date(Date.UTC(ano, mes - 1, dia + dias))
    .toISOString()
    .slice(0, 10);
}

const AMANHA = somarDias(hoje(), 1);

/** Simula o que o `<form>` manda: todo campo chega como string. */
function formulario(campos: Record<string, string>) {
  const dados = new FormData();

  for (const [chave, valor] of Object.entries(campos)) {
    dados.set(chave, valor);
  }

  return dados;
}

const CLIENTE = "6f3d9a1e-6b5c-4c2a-9f0e-1a2b3c4d5e6f";

const entrada = {
  tipo: "Entrada",
  data_competencia: "2026-09-12",
  data_caixa: "2026-09-12",
  categoria: "Coloração",
  descricao: "Coloração + corte",
  cliente_id: CLIENTE,
  valor: "180,00",
  status: "Pago",
};

const saida = {
  tipo: "Saída",
  data_competencia: "2026-09-10",
  data_caixa: "",
  categoria: "Custo Variável",
  descricao: "Boleto WELLA",
  fornecedor: "WELLA",
  valor: "420,00",
  status: "Pendente",
};

function analisar(campos: Record<string, string>) {
  return lancamentoSchema.safeParse(lerFormulario(formulario(campos)));
}

describe("lancamentoSchema", () => {
  it("aceita a entrada paga e converte o valor mascarado", () => {
    const { success, data } = analisar(entrada);

    expect(success).toBe(true);
    expect(data?.valor).toBe(180);
    expect(data?.cliente_id).toBe(CLIENTE);
    expect(data?.data_caixa).toBe("2026-09-12");
  });

  it("aceita a saída pendente com fornecedor em texto livre", () => {
    const { success, data } = analisar(saida);

    expect(success).toBe(true);
    expect(data?.fornecedor).toBe("WELLA");
    expect(data?.cliente_id).toBeNull();
  });

  it("preenche mes_competencia a partir da competência", () => {
    expect(analisar(entrada).data?.mes_competencia).toBe("2026-09");
  });

  it("aceita valor zero — cortesia continua no histórico", () => {
    const { success, data } = analisar({
      ...entrada,
      valor: "0,00",
      categoria: "Serviço",
    });

    expect(success).toBe(true);
    expect(data?.valor).toBe(0);
  });

  it("exige cliente na entrada", () => {
    const { error } = analisar({ ...entrada, cliente_id: "" });

    expect(errosPorCampo(error!).cliente_id).toBe("Escolha a cliente");
  });

  it("exige data de caixa quando está pago", () => {
    const { error } = analisar({ ...entrada, data_caixa: "" });

    expect(errosPorCampo(error!).data_caixa).toContain("data");
  });

  it("apaga a data de caixa quando está pendente", () => {
    const { data } = analisar({
      ...entrada,
      status: "Pendente",
      data_caixa: "2026-09-12",
    });

    expect(data?.data_caixa).toBeNull();
  });

  it("apaga a contraparte do lado errado ao trocar o tipo", () => {
    // O formulário esconde o campo, mas o valor antigo não pode chegar ao
    // banco e esbarrar em chk_lancamento_contraparte.
    const comoSaida = analisar({
      ...entrada,
      tipo: "Saída",
      categoria: "Curso",
      fornecedor: "Curso de mechas",
    });

    expect(comoSaida.data?.cliente_id).toBeNull();
    expect(comoSaida.data?.fornecedor).toBe("Curso de mechas");

    const comoEntrada = analisar({ ...saida, ...entrada, fornecedor: "WELLA" });

    expect(comoEntrada.data?.fornecedor).toBeNull();
  });

  it("recusa valor vazio, negativo e absurdo", () => {
    expect(errosPorCampo(analisar({ ...entrada, valor: "" }).error!).valor).toBe(
      "Informe o valor",
    );
    expect(analisar({ ...entrada, valor: "-10,00" }).success).toBe(false);
    expect(analisar({ ...entrada, valor: "999.999.999,00" }).success).toBe(
      false,
    );
  });

  it("exige categoria e descrição", () => {
    const erros = errosPorCampo(
      analisar({ ...entrada, categoria: " ", descricao: "a" }).error!,
    );

    expect(erros.categoria).toBe("Escolha a categoria");
    expect(erros.descricao).toBe("Descreva o lançamento");
  });

  it("recusa forma de pagamento e titularidade fora da lista do banco", () => {
    expect(
      analisar({ ...entrada, forma_pagamento: "Cheque" }).success,
    ).toBe(false);
    expect(analisar({ ...entrada, titularidade: "MEI" }).success).toBe(false);
  });

  it("aceita os campos opcionais vazios, guardando null", () => {
    const { data } = analisar(entrada);

    expect(data?.forma_pagamento).toBeNull();
    expect(data?.instituicao).toBeNull();
    expect(data?.titularidade).toBeNull();
    expect(data?.parcelamento).toBeNull();
    expect(data?.observacoes).toBeNull();
  });

  it("guarda o parcelamento como texto, do jeito da planilha", () => {
    expect(analisar({ ...entrada, parcelamento: "2/3" }).data?.parcelamento).toBe(
      "2/3",
    );
  });

  /**
   * Regra de 20/09/2026: nada fica Pago com data_caixa no futuro. A
   * trava do banco precisa de trigger e ainda não existe; por enquanto
   * quem segura é isto aqui.
   */
  it("recusa pago com data de caixa no futuro", () => {
    const erros = errosPorCampo(
      analisar({ ...entrada, data_caixa: AMANHA }).error!,
    );

    expect(erros.data_caixa).toBe(MENSAGEM_DATA_FUTURA);
  });

  it("aceita pago com a data de hoje", () => {
    expect(analisar({ ...entrada, data_caixa: hoje() }).success).toBe(true);
  });

  it("não barra competência no futuro — só a data de caixa", () => {
    // Agendou e já lançou: a venda pode ser de amanhã, o dinheiro não.
    const { success } = analisar({
      ...entrada,
      data_competencia: AMANHA,
      status: "Pendente",
      data_caixa: "",
    });

    expect(success).toBe(true);
  });

  it("recusa data de competência inválida", () => {
    const erros = errosPorCampo(
      analisar({ ...entrada, data_competencia: "12/09/2026" }).error!,
    );

    expect(erros.data_competencia).toBe("Informe a data");
  });
});

describe("confirmacaoRecebimentoSchema", () => {
  const ID = CLIENTE;

  it("aceita a data de hoje", () => {
    const { success, data } = confirmacaoRecebimentoSchema.safeParse({
      id: ID,
      data_caixa: hoje(),
    });

    expect(success).toBe(true);
    expect(data?.data_caixa).toBe(hoje());
  });

  it("aceita data passada — a parcela caiu e ela só viu depois", () => {
    const ontem = somarDias(hoje(), -1);

    expect(
      confirmacaoRecebimentoSchema.safeParse({ id: ID, data_caixa: ontem })
        .success,
    ).toBe(true);
  });

  it("recusa data no futuro, com mensagem em português", () => {
    const { error } = confirmacaoRecebimentoSchema.safeParse({
      id: ID,
      data_caixa: AMANHA,
    });

    expect(error?.issues[0]?.message).toBe(MENSAGEM_DATA_FUTURA);
  });

  it("recusa data vazia — confirmar sem dizer o dia não existe", () => {
    const { error } = confirmacaoRecebimentoSchema.safeParse({
      id: ID,
      data_caixa: "",
    });

    expect(error?.issues[0]?.message).toBe("Informe o dia em que o dinheiro caiu");
  });

  it("recusa id que não é uuid", () => {
    expect(
      confirmacaoRecebimentoSchema.safeParse({ id: "abc", data_caixa: hoje() })
        .success,
    ).toBe(false);
  });
});
