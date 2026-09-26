import { z } from "zod";

import { moedaParaNumero } from "@/lib/formatters";

/** Teto de numeric(10,2). */
const PRECO_MAXIMO = 99_999_999.99;

export const MENSAGEM_PRECO_ZERO =
  "Deixe em branco se ainda não tem preço.";

/**
 * Produto de revenda, como a tela de Produtos cadastra e edita.
 *
 * Só nome, marca e preço. `tipo`, `unidade` e `origem_registro` não são
 * campo de formulário: o cadastro grava os valores fixos
 * (`novoProdutoDoCatalogo`) e a edição nunca toca neles.
 */
export const produtoSchema = z.object({
  nome: z
    .string()
    .trim()
    .min(1, "Informe o nome do produto")
    .max(120, "Máximo de 120 caracteres"),

  // Vazia vira null: o índice da 011 trata null e "" igual, mas a coluna
  // opcional não guarda "".
  marca: z
    .string()
    .trim()
    .max(80, "Máximo de 80 caracteres")
    .transform((v) => (v === "" ? null : v)),

  // Vazio é "ainda sem preço" e grava NULL. Zero é recusado: na conta,
  // zero seria "de graça" (ver `ProdutoCatalogo.preco`), e não é isso
  // que ela quer dizer quando não sabe o preço.
  preco_venda: z.string().transform((bruto, ctx) => {
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

    if (numero === 0) {
      ctx.addIssue({ code: "custom", message: MENSAGEM_PRECO_ZERO });
      return z.NEVER;
    }

    if (numero > PRECO_MAXIMO) {
      ctx.addIssue({ code: "custom", message: "Preço alto demais" });
      return z.NEVER;
    }

    return numero;
  }),
});

export type DadosProduto = z.infer<typeof produtoSchema>;

export const CAMPOS_PRODUTO = ["nome", "marca", "preco_venda"] as const;

export type CampoProduto = (typeof CAMPOS_PRODUTO)[number];

/** FormData → objeto plano, só com os campos previstos. */
export function lerFormulario(formData: FormData) {
  return Object.fromEntries(
    CAMPOS_PRODUTO.map((campo) => [campo, String(formData.get(campo) ?? "")]),
  ) as Record<CampoProduto, string>;
}

/** Achata os erros do Zod em `campo → primeira mensagem`. */
export function errosPorCampo(erro: z.ZodError) {
  const erros: Partial<Record<CampoProduto, string>> = {};

  for (const problema of erro.issues) {
    const campo = problema.path[0] as CampoProduto | undefined;

    if (campo && !erros[campo]) {
      erros[campo] = problema.message;
    }
  }

  return erros;
}

/**
 * A linha que o cadastro da tela de Produtos insere. Irmã de
 * `novoProdutoDoAtendimento` (`@/lib/atendimentos/produtos`), com a
 * origem que distingue as duas.
 */
export function novoProdutoDoCatalogo(dados: DadosProduto) {
  return {
    ...dados,
    tipo: "revenda",
    unidade: "un",
    origem_registro: "catalogo",
  } as const;
}
