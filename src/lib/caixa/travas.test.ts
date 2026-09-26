import { describe, expect, it } from "vitest";

import { CAMPOS_LANCAMENTO, lancamentoSchema } from "./schema";
import {
  CAMPOS_EDITAVEIS_CONTA,
  CAMPOS_TRAVADOS_CONTA,
  camposTravadosAlterados,
  campoTravado,
  dadosParaAtualizar,
  exclusaoTravada,
  lancamentoDaConta,
  MENSAGEM_CAMPO_TRAVADO_CONTA,
  MENSAGEM_COMPETENCIA_TRAVADA,
  mensagemCampoTravado,
} from "./travas";

const CLIENTE = "44444444-4444-4444-8444-444444444444";
const OUTRA_CLIENTE = "66666666-6666-4666-8666-666666666666";
const ATENDIMENTO = "55555555-5555-4555-8555-555555555555";

/** A linha como está no banco: parcela 3/3 de uma conta no crédito. */
const gravado = (atendimento_id: string | null) => ({
  atendimento_id,
  tipo: "Entrada" as const,
  data_competencia: "2026-09-23",
  valor: 209.98,
  parcelamento: "3/3",
  cliente_id: CLIENTE,
  fornecedor: null,
});

/** O que o formulário manda, já pelo schema — como a action recebe. */
function enviado(mudancas: Record<string, string> = {}) {
  return lancamentoSchema.parse({
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
  });
}

describe("lançamento de conta × manual", () => {
  it("é de conta quando tem atendimento_id", () => {
    expect(lancamentoDaConta(gravado(ATENDIMENTO))).toBe(true);
    expect(lancamentoDaConta(gravado(null))).toBe(false);
  });

  it("exclusão: proibida na conta, livre no manual", () => {
    expect(exclusaoTravada(gravado(ATENDIMENTO))).toBe(true);
    expect(exclusaoTravada(gravado(null))).toBe(false);
  });

  it("nenhum campo é travado no manual", () => {
    for (const campo of CAMPOS_LANCAMENTO) {
      expect(campoTravado(gravado(null), campo)).toBe(false);
    }
  });

  it("na conta, só os campos da lista travada são somente leitura", () => {
    for (const campo of CAMPOS_LANCAMENTO) {
      expect(campoTravado(gravado(ATENDIMENTO), campo)).toBe(
        (CAMPOS_TRAVADOS_CONTA as readonly string[]).includes(campo),
      );
    }
  });

  it("todo campo do formulário está em exatamente uma das duas listas", () => {
    const todas = [...CAMPOS_TRAVADOS_CONTA, ...CAMPOS_EDITAVEIS_CONTA];

    expect(new Set(todas).size).toBe(todas.length);
    expect([...todas].sort()).toEqual([...CAMPOS_LANCAMENTO].sort());
  });
});

describe("camposTravadosAlterados", () => {
  it("manual: nada é recusado, mesmo mudando tudo", () => {
    expect(
      camposTravadosAlterados(
        gravado(null),
        enviado({
          valor: "1,00",
          data_competencia: "2026-10-01",
          parcelamento: "",
          cliente_id: OUTRA_CLIENTE,
        }),
      ),
    ).toEqual([]);
  });

  it("conta: tudo travado igual ao gravado é aceito", () => {
    expect(camposTravadosAlterados(gravado(ATENDIMENTO), enviado())).toEqual([]);
  });

  it("conta: 180 do banco e '180,00' da máscara são o mesmo valor", () => {
    expect(
      camposTravadosAlterados(
        { ...gravado(ATENDIMENTO), valor: 180 },
        enviado({ valor: "180,00" }),
      ),
    ).toEqual([]);
  });

  it("conta: parcelamento nulo no banco e vazio na tela são iguais", () => {
    expect(
      camposTravadosAlterados(
        { ...gravado(ATENDIMENTO), parcelamento: null },
        enviado({ parcelamento: "" }),
      ),
    ).toEqual([]);
  });

  it.each([
    ["valor", { valor: "210,00" }],
    ["data_competencia", { data_competencia: "2026-10-23" }],
    ["parcelamento", { parcelamento: "2/3" }],
    ["cliente_id", { cliente_id: OUTRA_CLIENTE }],
  ])("conta: recusa mudar %s", (campo, mudanca) => {
    expect(
      camposTravadosAlterados(gravado(ATENDIMENTO), enviado(mudanca)),
    ).toEqual([campo]);
  });

  it("conta: recusa virar Saída (e o fornecedor que vem junto)", () => {
    const alterados = camposTravadosAlterados(
      gravado(ATENDIMENTO),
      enviado({ tipo: "Saída", fornecedor: "WELLA" }),
    );

    // Saída perde a cliente no schema: três travas quebradas de uma vez.
    expect(alterados).toEqual(["tipo", "cliente_id", "fornecedor"]);
  });

  it("conta: campo editável mudado não é trava", () => {
    expect(
      camposTravadosAlterados(
        gravado(ATENDIMENTO),
        enviado({
          instituicao: "Nubank",
          titularidade: "PF",
          forma_pagamento: "Pix",
          categoria: "Serviço",
          descricao: "Outra",
          observacoes: "nota",
          status: "Pago",
          data_caixa: "2026-09-24",
          data_prevista: "2026-12-30",
        }),
      ),
    ).toEqual([]);
  });
});

describe("dadosParaAtualizar", () => {
  it("manual: grava tudo, como sempre", () => {
    const dados = enviado({ data_competencia: "2026-10-23" });

    expect(dadosParaAtualizar(gravado(null), dados)).toEqual(dados);
  });

  it("conta: só os editáveis entram no update", () => {
    const dados = dadosParaAtualizar(
      gravado(ATENDIMENTO),
      enviado({ instituicao: "Nubank" }),
    );

    expect(Object.keys(dados).sort()).toEqual([...CAMPOS_EDITAVEIS_CONTA].sort());
    expect(dados.instituicao).toBe("Nubank");
    expect(dados).not.toHaveProperty("valor");
    expect(dados).not.toHaveProperty("data_competencia");
    expect(dados).not.toHaveProperty("mes_competencia");
  });
});

describe("mensagens", () => {
  it("a competência mantém a frase de 25/09; o resto aponta para reabrir", () => {
    expect(mensagemCampoTravado("data_competencia")).toBe(
      MENSAGEM_COMPETENCIA_TRAVADA,
    );
    expect(mensagemCampoTravado("valor")).toBe(MENSAGEM_CAMPO_TRAVADO_CONTA);
  });
});
