import { z } from "zod";

import { apenasDigitos, moedaParaNumero } from "@/lib/formatters";

/**
 * Listas espelhadas dos `check` das migrations 001 e 007. Mudou lá, muda
 * aqui — o banco é quem manda, isto existe para a UI errar antes do INSERT.
 */
export const TIPOS_FORMULA = [
  "coloracao",
  "retoque_raiz",
  "mechas",
  "tonalizante",
  "descoloracao",
  "alisamento",
  "tratamento",
  "outro",
] as const;

export const UNIDADES = ["g", "ml", "un"] as const;

export const MOMENTOS = ["antes", "depois"] as const;

export type TipoFormula = (typeof TIPOS_FORMULA)[number];
export type Unidade = (typeof UNIDADES)[number];
export type Momento = (typeof MOMENTOS)[number];

/** Como cada tipo aparece na tela. */
export const ROTULO_TIPO: Record<TipoFormula, string> = {
  coloracao: "Coloração",
  retoque_raiz: "Retoque de raiz",
  mechas: "Mechas",
  tonalizante: "Tonalizante",
  descoloracao: "Descoloração",
  alisamento: "Alisamento",
  tratamento: "Tratamento",
  outro: "Outro",
};

export const ROTULO_MOMENTO: Record<Momento, string> = {
  antes: "Antes",
  depois: "Depois",
};

/** Tetos dos `check` da 007. */
const VOLUME_MAXIMO = 60;
const PAUSA_MAXIMA = 600;
/** Teto de numeric(10,2) em quantidade de mistura — 4 dígitos bastam. */
const QUANTIDADE_MAXIMA = 9_999.99;

/** Campo de texto opcional: string vazia vira null, não "". */
const textoOpcional = (max: number) =>
  z
    .string()
    .trim()
    .max(max, `Máximo de ${max} caracteres`)
    .transform((v) => (v === "" ? null : v));

/**
 * Campo numérico inteiro e opcional. Vem de um input com teclado
 * numérico, então qualquer coisa que não seja dígito é descartada antes
 * de virar número.
 */
const inteiroOpcional = (maximo: number, mensagem: string) =>
  z.string().transform((bruto, ctx) => {
    if (bruto.trim() === "") return null;

    const digitos = apenasDigitos(bruto);
    const numero = Number(digitos);

    if (!digitos || numero <= 0 || numero > maximo) {
      ctx.addIssue({ code: "custom", message: mensagem });
      return z.NEVER;
    }

    return numero;
  });

export const formulaSchema = z.object({
  // Vem da tela de atendimento quando a fórmula nasce de um; fórmula
  // avulsa manda string vazia e fica sem vínculo.
  atendimento_id: z
    .string()
    .trim()
    .transform((v) => (v === "" ? null : v))
    .nullable()
    .refine((v) => v === null || z.uuid().safeParse(v).success, {
      message: "Atendimento inválido",
    }),

  data: z
    .string()
    .trim()
    .refine((v) => z.iso.date().safeParse(v).success, {
      message: "Informe a data",
    }),

  tipo: z.enum(TIPOS_FORMULA, { message: "Escolha o tipo" }),

  // '5', '6.0' — altura natural, texto curto e não número: ela escreve
  // como está acostumada na ficha de papel.
  base_natural: textoOpcional(20),
  resultado_alvo: textoOpcional(120),

  volume_oxidante: inteiroOpcional(
    VOLUME_MAXIMO,
    "Volume entre 1 e 60 (10, 20, 30, 40)",
  ),
  tempo_pausa_min: inteiroOpcional(
    PAUSA_MAXIMA,
    "Tempo em minutos, até 600",
  ),

  tecnica: textoOpcional(120),
  resultado: textoOpcional(1000),
  observacao: textoOpcional(1000),
});

export type DadosFormula = z.infer<typeof formulaSchema>;

const itemSchema = z.object({
  descricao: z
    .string()
    .trim()
    .min(1, "Descreva o produto")
    .max(120, "Máximo de 120 caracteres"),

  // Aceita "30" e "1,5": é o mesmo teclado decimal do campo de valor.
  quantidade: z.string().transform((bruto, ctx) => {
    const numero = moedaParaNumero(bruto);

    if (numero === null || numero <= 0) {
      ctx.addIssue({ code: "custom", message: "Informe a quantidade" });
      return z.NEVER;
    }

    if (numero > QUANTIDADE_MAXIMA) {
      ctx.addIssue({ code: "custom", message: "Quantidade alta demais" });
      return z.NEVER;
    }

    return numero;
  }),

  unidade: z.enum(UNIDADES, { message: "Unidade inválida" }),
});

export const itensSchema = z.array(itemSchema);

export type DadosItem = z.infer<typeof itemSchema>;

/** Os campos escalares que o formulário conhece. */
export const CAMPOS_FORMULA = [
  "atendimento_id",
  "data",
  "tipo",
  "base_natural",
  "resultado_alvo",
  "volume_oxidante",
  "tempo_pausa_min",
  "tecnica",
  "resultado",
  "observacao",
] as const;

export type CampoFormula = (typeof CAMPOS_FORMULA)[number];

/** Chaves de erro: os campos escalares mais a lista da mistura. */
export type CampoErroFormula = CampoFormula | "itens";

export type ItemBruto = {
  descricao: string;
  quantidade: string;
  unidade: string;
};

/** FormData → objeto plano, só com os campos previstos. */
export function lerFormulario(formData: FormData) {
  return Object.fromEntries(
    CAMPOS_FORMULA.map((campo) => [campo, String(formData.get(campo) ?? "")]),
  ) as Record<CampoFormula, string>;
}

/**
 * As linhas da mistura viajam como três listas paralelas — é o que um
 * `<form>` sabe mandar sem JavaScript no meio.
 *
 * Linha totalmente em branco é descartada: a usuária abriu uma a mais e
 * não preencheu, isso não é erro.
 */
export function lerItens(formData: FormData): ItemBruto[] {
  const descricoes = formData.getAll("item_descricao").map(String);
  const quantidades = formData.getAll("item_quantidade").map(String);
  const unidades = formData.getAll("item_unidade").map(String);

  return descricoes
    .map((descricao, indice) => ({
      descricao,
      quantidade: quantidades[indice] ?? "",
      unidade: unidades[indice] ?? "g",
    }))
    .filter(
      (item) =>
        item.descricao.trim() !== "" || item.quantidade.trim() !== "",
    );
}

/** Achata os erros do Zod em `campo → primeira mensagem`. */
export function errosPorCampo(erro: z.ZodError) {
  const erros: Partial<Record<CampoErroFormula, string>> = {};

  for (const problema of erro.issues) {
    const campo = problema.path[0] as CampoErroFormula | undefined;

    if (campo && !erros[campo]) {
      erros[campo] = problema.message;
    }
  }

  return erros;
}

/**
 * Erro da mistura, já com o número da linha: a lista é dinâmica e não
 * tem onde pendurar uma mensagem por campo sem poluir a tela.
 */
export function erroDosItens(erro: z.ZodError) {
  const problema = erro.issues[0];

  if (!problema) return "Confira os produtos da mistura";

  const linha = Number(problema.path[0]);

  return Number.isInteger(linha)
    ? `Linha ${linha + 1}: ${problema.message}`
    : problema.message;
}
