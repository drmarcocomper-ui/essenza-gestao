import { z } from "zod";

import { hoje } from "@/lib/caixa/mes";

/**
 * Formulários do estoque de frascos (021): contagem e compra.
 *
 * Frasco se conta inteiro. As colunas de quantidade são `numeric` e
 * aceitariam 1,5 — quem recusa a fração é este schema.
 */

/** Teto de bom senso: frasco de revenda não chega a cem mil. */
const QUANTIDADE_MAXIMA = 99_999;

export const MENSAGEM_DATA_FUTURA = "A data não pode ser no futuro.";
export const MENSAGEM_QUANTIDADE_INTEIRA = "Use um número inteiro de frascos.";

/** Campo de texto opcional: string vazia vira null, não "". */
const textoOpcional = (max: number) =>
  z
    .string()
    .trim()
    .max(max, `Máximo de ${max} caracteres`)
    .transform((v) => (v === "" ? null : v));

/**
 * Data obrigatória e nunca no futuro. "Hoje" é o do fuso do salão
 * (`hoje()`); as duas em 'AAAA-MM-DD', então comparar texto é comparar data.
 */
export const dataSemFuturo = z
  .string()
  .trim()
  .min(1, "Informe a data")
  .refine((v) => z.iso.date().safeParse(v).success, { message: "Data inválida" })
  .refine((v) => v <= hoje(), { message: MENSAGEM_DATA_FUTURA });

/**
 * Quantidade inteira a partir de `minimo`. Só dígitos: "1,5", "1.5" e
 * "-1" são recusados com o recado certo, em vez de arredondados.
 */
export const quantidadeInteira = (minimo: 0 | 1) =>
  z.string().transform((bruto, ctx) => {
    const texto = bruto.trim();

    if (texto === "") {
      ctx.addIssue({ code: "custom", message: "Informe a quantidade" });
      return z.NEVER;
    }

    if (texto.startsWith("-")) {
      ctx.addIssue({ code: "custom", message: "Não pode ser negativa" });
      return z.NEVER;
    }

    if (!/^\d+$/.test(texto)) {
      ctx.addIssue({
        code: "custom",
        message: /^\d*[.,]\d*$/.test(texto)
          ? MENSAGEM_QUANTIDADE_INTEIRA
          : "Quantidade inválida",
      });
      return z.NEVER;
    }

    const numero = Number(texto);

    if (numero < minimo) {
      ctx.addIssue({
        code: "custom",
        message: minimo === 1 ? "Tem que ser pelo menos 1" : "Não pode ser negativa",
      });
      return z.NEVER;
    }

    if (numero > QUANTIDADE_MAXIMA) {
      ctx.addIssue({ code: "custom", message: "Quantidade alta demais" });
      return z.NEVER;
    }

    return numero;
  });

// ---------------------------------------------------------------------
// Contagem
// ---------------------------------------------------------------------

/** "Contei e tinha N": zero é dado (acabou), como no `check` da 021. */
export const contagemSchema = z.object({
  data: dataSemFuturo,
  quantidade: quantidadeInteira(0),
  observacao: textoOpcional(500),
});

export const CAMPOS_CONTAGEM = ["data", "quantidade", "observacao"] as const;

export type CampoContagem = (typeof CAMPOS_CONTAGEM)[number];

/** FormData → objeto plano, só com os campos previstos. */
export function lerContagem(formData: FormData) {
  return Object.fromEntries(
    CAMPOS_CONTAGEM.map((campo) => [campo, String(formData.get(campo) ?? "")]),
  ) as Record<CampoContagem, string>;
}

/** Achata os erros do Zod em `campo → primeira mensagem`. */
export function errosPorCampo<C extends string>(erro: z.ZodError) {
  const erros: Partial<Record<C, string>> = {};

  for (const problema of erro.issues) {
    const campo = problema.path[0] as C | undefined;

    if (campo !== undefined && !erros[campo]) {
      erros[campo] = problema.message;
    }
  }

  return erros;
}
