import { z } from "zod";

import { hoje } from "@/lib/caixa/mes";
import { moedaParaNumero } from "@/lib/formatters";

/**
 * Listas espelhadas dos `check` da migration 002. Mudou lá, muda aqui —
 * o banco é quem manda, isto existe para a UI errar antes do INSERT.
 */
export const TIPOS = ["Entrada", "Saída"] as const;
export const STATUS = ["Pago", "Pendente"] as const;
export const TITULARIDADES = ["PF", "PJ", "Terceiro"] as const;
export const FORMAS_PAGAMENTO = [
  "Pix",
  "Dinheiro",
  "Cartão de crédito",
  "Cartão de débito",
  "Boleto",
  "Transferência",
  "Cortesia",
  "Confiança",
] as const;

export type TipoLancamento = (typeof TIPOS)[number];
export type StatusLancamento = (typeof STATUS)[number];

/** Teto de numeric(10,2). */
const VALOR_MAXIMO = 99_999_999.99;

export const MENSAGEM_DATA_FUTURA =
  "A data não pode ser no futuro. Informe o dia em que o dinheiro caiu.";

/**
 * Regra do projeto (20/09/2026): nenhum lançamento fica `Pago` com
 * `data_caixa` no futuro. Data de caixa é o dia em que o dinheiro andou,
 * e dinheiro não anda amanhã — enquanto não caiu, o lançamento é Pendente.
 *
 * A trava definitiva é no banco e precisa de trigger: `check` não aceita
 * `current_date`, que não é imutável. Enquanto ela não existe, quem
 * garante a regra é a aplicação — aqui e na action.
 *
 * As duas datas estão em 'AAAA-MM-DD': comparar como texto é comparar
 * como data, sem construir `Date`, que erraria o dia em fuso negativo.
 */
export function dataCaixaNoFuturo(data: string) {
  return data > hoje();
}

/** Campo de texto opcional: string vazia vira null, não "". */
const textoOpcional = (max: number) =>
  z
    .string()
    .trim()
    .max(max, `Máximo de ${max} caracteres`)
    .transform((v) => (v === "" ? null : v));

/** Select opcional: vazio é null; preenchido tem que estar na lista. */
const escolhaOpcional = (valores: readonly string[], mensagem: string) =>
  z
    .string()
    .trim()
    .transform((v) => (v === "" ? null : v))
    .nullable()
    .refine((v) => v === null || valores.includes(v), { message: mensagem });

const dataOpcional = z
  .string()
  .trim()
  .transform((v) => (v === "" ? null : v))
  .nullable()
  .refine((v) => v === null || z.iso.date().safeParse(v).success, {
    message: "Data inválida",
  });

export const lancamentoSchema = z
  .object({
    tipo: z.enum(TIPOS, { message: "Escolha entrada ou saída" }),

    data_competencia: z
      .string()
      .trim()
      .refine((v) => z.iso.date().safeParse(v).success, {
        message: "Informe a data",
      }),

    data_caixa: dataOpcional,

    categoria: z
      .string()
      .trim()
      .min(1, "Escolha a categoria")
      .max(60, "Máximo de 60 caracteres"),

    descricao: z
      .string()
      .trim()
      .min(2, "Descreva o lançamento")
      .max(200, "Máximo de 200 caracteres"),

    cliente_id: z
      .string()
      .trim()
      .transform((v) => (v === "" ? null : v))
      .nullable()
      .refine((v) => v === null || z.uuid().safeParse(v).success, {
        message: "Escolha a cliente na busca",
      }),

    fornecedor: textoOpcional(120),

    forma_pagamento: escolhaOpcional(
      FORMAS_PAGAMENTO,
      "Forma de pagamento inválida",
    ),
    instituicao: textoOpcional(100),
    titularidade: escolhaOpcional(TITULARIDADES, "Titularidade inválida"),
    parcelamento: textoOpcional(20),

    // Chega mascarado ("1.234,50") e sai número. Zero é válido: cortesia
    // e atendimento em confiança entram com 0,00 para ficar no histórico.
    valor: z.string().transform((bruto, ctx) => {
      const numero = moedaParaNumero(bruto);

      if (numero === null) {
        ctx.addIssue({ code: "custom", message: "Informe o valor" });
        return z.NEVER;
      }

      if (numero < 0) {
        ctx.addIssue({ code: "custom", message: "O valor não pode ser negativo" });
        return z.NEVER;
      }

      if (numero > VALOR_MAXIMO) {
        ctx.addIssue({ code: "custom", message: "Valor alto demais" });
        return z.NEVER;
      }

      return numero;
    }),

    status: z.enum(STATUS, { message: "Escolha o status" }),

    observacoes: textoOpcional(1000),
  })
  .superRefine((dados, ctx) => {
    // Entrada é de cliente (chk_lancamento_contraparte).
    if (dados.tipo === "Entrada" && !dados.cliente_id) {
      ctx.addIssue({
        code: "custom",
        path: ["cliente_id"],
        message: "Escolha a cliente",
      });
    }

    // Pago exige data de caixa (chk_lancamento_caixa).
    if (dados.status === "Pago" && !dados.data_caixa) {
      ctx.addIssue({
        code: "custom",
        path: ["data_caixa"],
        message: "Lançamento pago precisa da data em que o dinheiro entrou",
      });
    }

    // Pago é dinheiro que já andou: a data não pode ser no futuro.
    if (
      dados.status === "Pago" &&
      dados.data_caixa &&
      dataCaixaNoFuturo(dados.data_caixa)
    ) {
      ctx.addIssue({
        code: "custom",
        path: ["data_caixa"],
        message: MENSAGEM_DATA_FUTURA,
      });
    }
  })
  .transform((dados) => ({
    ...dados,
    // A contraparte do lado errado é apagada, não recusada: o formulário
    // esconde o campo ao trocar o tipo, e o valor antigo não pode vazar
    // para o INSERT e esbarrar na constraint.
    cliente_id: dados.tipo === "Entrada" ? dados.cliente_id : null,
    fornecedor: dados.tipo === "Saída" ? dados.fornecedor : null,
    // Pendente não tem data de caixa: o dinheiro ainda não andou.
    data_caixa: dados.status === "Pago" ? dados.data_caixa : null,
    // Mesma coluna que a planilha preenchia, mantida para os relatórios
    // por mês continuarem batendo com o histórico importado.
    mes_competencia: dados.data_competencia.slice(0, 7),
  }));

export type DadosLancamento = z.infer<typeof lancamentoSchema>;

/**
 * Confirmação de recebimento: a parcela caiu, e ela informa em que dia.
 *
 * O app NUNCA prevê data de compensação — não calcula, não sugere, não
 * deriva da venda. Este schema só confere o que ela digitou.
 */
export const confirmacaoRecebimentoSchema = z.object({
  id: z.uuid({ message: "Lançamento inválido" }),

  data_caixa: z
    .string()
    .trim()
    .refine((v) => z.iso.date().safeParse(v).success, {
      message: "Informe o dia em que o dinheiro caiu",
    })
    .refine((v) => !dataCaixaNoFuturo(v), { message: MENSAGEM_DATA_FUTURA }),
});

/** Os campos que o formulário conhece. `origem_registro` nunca entra. */
export const CAMPOS_LANCAMENTO = [
  "tipo",
  "data_competencia",
  "data_caixa",
  "categoria",
  "descricao",
  "cliente_id",
  "fornecedor",
  "forma_pagamento",
  "instituicao",
  "titularidade",
  "parcelamento",
  "valor",
  "status",
  "observacoes",
] as const;

export type CampoLancamento = (typeof CAMPOS_LANCAMENTO)[number];

/** FormData → objeto plano, só com os campos previstos. */
export function lerFormulario(formData: FormData) {
  return Object.fromEntries(
    CAMPOS_LANCAMENTO.map((campo) => [
      campo,
      String(formData.get(campo) ?? ""),
    ]),
  ) as Record<CampoLancamento, string>;
}

/** Achata os erros do Zod em `campo → primeira mensagem`. */
export function errosPorCampo(erro: z.ZodError) {
  const erros: Partial<Record<CampoLancamento, string>> = {};

  for (const problema of erro.issues) {
    const campo = problema.path[0] as CampoLancamento | undefined;

    if (campo && !erros[campo]) {
      erros[campo] = problema.message;
    }
  }

  return erros;
}
