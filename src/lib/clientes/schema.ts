import { z } from "zod";

import { apenasDigitos } from "@/lib/formatters";

/**
 * Campo de texto opcional: o formulário sempre manda string, e string
 * vazia precisa virar null no banco (não "").
 */
const textoOpcional = (max = 200) =>
  z
    .string()
    .trim()
    .max(max, `Máximo de ${max} caracteres`)
    // String vazia vira null: coluna opcional não guarda "".
    .transform((v) => (v === "" ? null : v));

export const clienteSchema = z.object({
  nome: z
    .string()
    .trim()
    .min(2, "Informe o nome da cliente")
    .max(120, "Máximo de 120 caracteres"),

  // Chega mascarado da UI e é guardado só com dígitos.
  telefone: z
    .string()
    .transform(apenasDigitos)
    .refine((d) => d.length >= 10 && d.length <= 11, {
      message: "Telefone com DDD, 10 ou 11 dígitos",
    }),

  email: z
    .string()
    .trim()
    .transform((v) => (v === "" ? null : v))
    .nullable()
    .refine((v) => v === null || z.email().safeParse(v).success, {
      message: "E-mail inválido",
    }),

  data_nascimento: z
    .string()
    .trim()
    .transform((v) => (v === "" ? null : v))
    .nullable()
    .refine((v) => v === null || z.iso.date().safeParse(v).success, {
      message: "Data inválida",
    }),

  municipio: textoOpcional(100),
  bairro: textoOpcional(100),
  profissao: textoOpcional(100),
  preferencias: textoOpcional(500),
  origem: textoOpcional(100),
  observacoes: textoOpcional(2000),
});

export type DadosCliente = z.infer<typeof clienteSchema>;

/** Os campos que o formulário conhece. `id_externo` nunca entra aqui. */
export const CAMPOS_CLIENTE = [
  "nome",
  "telefone",
  "email",
  "data_nascimento",
  "municipio",
  "bairro",
  "profissao",
  "preferencias",
  "origem",
  "observacoes",
] as const;

export type CampoCliente = (typeof CAMPOS_CLIENTE)[number];

/** FormData → objeto plano, só com os campos previstos. */
export function lerFormulario(formData: FormData) {
  return Object.fromEntries(
    CAMPOS_CLIENTE.map((campo) => [campo, String(formData.get(campo) ?? "")]),
  ) as Record<CampoCliente, string>;
}

/** Achata os erros do Zod em `campo → primeira mensagem`. */
export function errosPorCampo(erro: z.ZodError) {
  const erros: Partial<Record<CampoCliente, string>> = {};

  for (const problema of erro.issues) {
    const campo = problema.path[0] as CampoCliente | undefined;

    if (campo && !erros[campo]) {
      erros[campo] = problema.message;
    }
  }

  return erros;
}
