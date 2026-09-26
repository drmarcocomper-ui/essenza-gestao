import { z } from "zod";

import { moedaParaNumero } from "@/lib/formatters";

/** Teto de numeric(10,2): preços e gramas. */
const MAXIMO_10_2 = 99_999_999.99;

/** Teto de numeric(6,1): comprimento. */
const MAXIMO_6_1 = 99_999.9;

/** Campo de texto opcional: string vazia vira null, não "". */
const textoOpcional = (max: number) =>
  z
    .string()
    .trim()
    .max(max, `Máximo de ${max} caracteres`)
    .transform((v) => (v === "" ? null : v));

/** Mais casas do que a coluna guarda: o banco arredondaria calado. */
function casasDemais(numero: number, casas: number) {
  const escala = numero * 10 ** casas;

  return Math.abs(escala - Math.round(escala)) > 1e-6;
}

/**
 * Gramas e comprimento. Vazio é "não informado" e grava NULL; zero é
 * recusado, como no `check` da 018 — peça de 0 g não existe.
 *
 * Lido pelo mesmo `moedaParaNumero` dos preços: é o parse de número
 * pt-BR do app (vírgula decimal, ponto de milhar), não há outro.
 */
const medida = (casas: number, maximo: number, unidade: string) =>
  z.string().transform((bruto, ctx) => {
    if (bruto.trim() === "") return null;

    const numero = moedaParaNumero(bruto);

    if (numero === null) {
      ctx.addIssue({ code: "custom", message: "Número inválido" });
      return z.NEVER;
    }

    if (numero <= 0) {
      ctx.addIssue({
        code: "custom",
        message: "Tem que ser maior que zero. Deixe em branco se não sabe.",
      });
      return z.NEVER;
    }

    if (numero > maximo) {
      ctx.addIssue({ code: "custom", message: `Valor alto demais (${unidade})` });
      return z.NEVER;
    }

    if (casasDemais(numero, casas)) {
      ctx.addIssue({
        code: "custom",
        message:
          casas === 1
            ? "Use no máximo 1 casa decimal"
            : `Use no máximo ${casas} casas decimais`,
      });
      return z.NEVER;
    }

    return numero;
  });

/**
 * Preço de compra e de venda. Vazio grava NULL ("não informado"); zero
 * é aceito e é outro dado — cortesia, peça ganha —, como no `check` da
 * 018. Diferente do preço de revenda, que recusa zero.
 */
const preco = z.string().transform((bruto, ctx) => {
  if (bruto.trim() === "") return null;

  const numero = moedaParaNumero(bruto);

  if (numero === null) {
    ctx.addIssue({ code: "custom", message: "Preço inválido" });
    return z.NEVER;
  }

  if (numero < 0) {
    ctx.addIssue({ code: "custom", message: "O preço não pode ser negativo" });
    return z.NEVER;
  }

  if (numero > MAXIMO_10_2) {
    ctx.addIssue({ code: "custom", message: "Preço alto demais" });
    return z.NEVER;
  }

  if (casasDemais(numero, 2)) {
    ctx.addIssue({ code: "custom", message: "Use no máximo 2 casas decimais" });
    return z.NEVER;
  }

  return numero;
});

/**
 * Peça de extensão, como a seção Extensão cadastra e edita.
 *
 * `peca_mae_id` não é campo de formulário: o cadastro grava NULL e a
 * edição nunca toca nele (ver 018). `numero_origem`, `origem`,
 * `data_entrada` e `observacoes` existem na tabela, mas não estão nesta
 * tela.
 */
export const pecaSchema = z.object({
  // Trim nas pontas e nada mais: 1254-B fica 1254-B, como ela digitou.
  codigo: z
    .string()
    .trim()
    .min(1, "Informe o código da peça")
    .max(30, "Máximo de 30 caracteres"),

  cor: textoOpcional(60),
  textura: textoOpcional(60),
  gramas: medida(2, MAXIMO_10_2, "g"),
  comprimento_cm: medida(1, MAXIMO_6_1, "cm"),
  preco_compra: preco,
  preco_venda: preco,
});

export type DadosPeca = z.infer<typeof pecaSchema>;

export const CAMPOS_PECA = [
  "codigo",
  "cor",
  "textura",
  "gramas",
  "comprimento_cm",
  "preco_compra",
  "preco_venda",
] as const;

export type CampoPeca = (typeof CAMPOS_PECA)[number];

/** FormData → objeto plano, só com os campos previstos. */
export function lerFormulario(formData: FormData) {
  return Object.fromEntries(
    CAMPOS_PECA.map((campo) => [campo, String(formData.get(campo) ?? "")]),
  ) as Record<CampoPeca, string>;
}

/** Achata os erros do Zod em `campo → primeira mensagem`. */
export function errosPorCampo(erro: z.ZodError) {
  const erros: Partial<Record<CampoPeca, string>> = {};

  for (const problema of erro.issues) {
    const campo = problema.path[0] as CampoPeca | undefined;

    if (campo && !erros[campo]) {
      erros[campo] = problema.message;
    }
  }

  return erros;
}

/** A linha que o cadastro insere: peça inteira, sem mãe. */
export function novaPeca(dados: DadosPeca) {
  return { ...dados, peca_mae_id: null };
}
