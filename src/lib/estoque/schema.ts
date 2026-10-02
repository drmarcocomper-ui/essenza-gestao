import { z } from "zod";

import { hoje } from "@/lib/caixa/mes";
import {
  indicesProdutoRepetido,
  MENSAGEM_PRODUTO_REPETIDO,
} from "@/lib/estoque/regras";
import { moedaParaNumero } from "@/lib/formatters";

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

// ---------------------------------------------------------------------
// Compra
// ---------------------------------------------------------------------

/** Teto de numeric(12,2), o custo unitário da 021. */
const CUSTO_MAXIMO = 9_999_999_999.99;

/** Linhas por compra: uma nota de distribuidora não passa disso. */
export const MAXIMO_ITENS = 50;

export const MENSAGEM_SEM_ITENS = "Inclua pelo menos um produto.";

/** Mais casas do que a coluna guarda: o banco arredondaria calado. */
function casasDemais(numero: number, casas: number) {
  const escala = numero * 10 ** casas;

  return Math.abs(escala - Math.round(escala)) > 1e-6;
}

/** Custo unitário em reais: obrigatório, zero aceito (brinde é dado). */
const custo = z.string().transform((bruto, ctx) => {
  if (bruto.trim() === "") {
    ctx.addIssue({ code: "custom", message: "Informe o custo" });
    return z.NEVER;
  }

  const numero = moedaParaNumero(bruto);

  if (numero === null) {
    ctx.addIssue({ code: "custom", message: "Custo inválido" });
    return z.NEVER;
  }

  if (numero < 0) {
    ctx.addIssue({ code: "custom", message: "O custo não pode ser negativo" });
    return z.NEVER;
  }

  if (numero > CUSTO_MAXIMO) {
    ctx.addIssue({ code: "custom", message: "Custo alto demais" });
    return z.NEVER;
  }

  if (casasDemais(numero, 2)) {
    ctx.addIssue({ code: "custom", message: "Use no máximo 2 casas decimais" });
    return z.NEVER;
  }

  return numero;
});

export const cabecalhoCompraSchema = z.object({
  fornecedor: z
    .string()
    .trim()
    .min(1, "Informe o fornecedor")
    .max(120, "Máximo de 120 caracteres"),
  data: dataSemFuturo,
  observacoes: textoOpcional(1000),
});

export const itemCompraSchema = z.object({
  produto_id: z.string().trim().min(1, "Escolha o produto"),
  quantidade: quantidadeInteira(1),
  custo_unitario: custo,
});

export type CampoCompra = keyof z.input<typeof cabecalhoCompraSchema>;
export type CampoItemCompra = keyof z.input<typeof itemCompraSchema>;

export type ItemCompraBruto = Record<CampoItemCompra, string>;
export type CompraBruta = Record<CampoCompra, string> & {
  itens: ItemCompraBruto[];
};

export type DadosCompra = z.output<typeof cabecalhoCompraSchema> & {
  itens: z.output<typeof itemCompraSchema>[];
};

/** Texto ou "", nunca outra coisa: o servidor não confia na forma. */
function texto(valor: unknown) {
  return typeof valor === "string" ? valor : "";
}

/**
 * A compra como chega da tela → objeto plano, só com os campos
 * previstos. A tela manda objeto, não FormData (as linhas vivem em
 * estado), e o que não for texto vira "".
 */
export function lerCompra(valor: unknown): CompraBruta {
  const objeto =
    typeof valor === "object" && valor !== null
      ? (valor as Record<string, unknown>)
      : {};
  const itens = Array.isArray(objeto.itens) ? objeto.itens : [];

  return {
    fornecedor: texto(objeto.fornecedor),
    data: texto(objeto.data),
    observacoes: texto(objeto.observacoes),
    itens: itens.map((item) => {
      const linha =
        typeof item === "object" && item !== null
          ? (item as Record<string, unknown>)
          : {};

      return {
        produto_id: texto(linha.produto_id),
        quantidade: texto(linha.quantidade),
        custo_unitario: texto(linha.custo_unitario),
      };
    }),
  };
}

export type ValidacaoCompra =
  | { ok: true; dados: DadosCompra }
  | {
      ok: false;
      mensagem?: string;
      erros: Partial<Record<CampoCompra, string>>;
      /** Erros de cada linha, na ordem da tela. */
      errosItens: Partial<Record<CampoItemCompra, string>>[];
    };

/**
 * Cabeçalho, cada linha, e o mesmo produto duas vezes — que o banco
 * também recusa, mas aqui o recado sai na linha certa.
 */
export function validarCompra(bruta: CompraBruta): ValidacaoCompra {
  const cabecalho = cabecalhoCompraSchema.safeParse(bruta);
  const erros = cabecalho.success
    ? {}
    : errosPorCampo<CampoCompra>(cabecalho.error);

  const errosItens = bruta.itens.map(
    (): Partial<Record<CampoItemCompra, string>> => ({}),
  );
  const itens: z.output<typeof itemCompraSchema>[] = [];

  bruta.itens.forEach((item, indice) => {
    const validacao = itemCompraSchema.safeParse(item);

    if (validacao.success) itens.push(validacao.data);
    else errosItens[indice] = errosPorCampo<CampoItemCompra>(validacao.error);
  });

  for (const indice of indicesProdutoRepetido(
    bruta.itens.map((item) => item.produto_id.trim()),
  )) {
    errosItens[indice].produto_id ??= MENSAGEM_PRODUTO_REPETIDO;
  }

  const mensagem =
    bruta.itens.length === 0
      ? MENSAGEM_SEM_ITENS
      : bruta.itens.length > MAXIMO_ITENS
        ? `No máximo ${MAXIMO_ITENS} produtos por compra.`
        : undefined;

  const temErro =
    Object.keys(erros).length > 0 ||
    errosItens.some((erro) => Object.keys(erro).length > 0) ||
    mensagem !== undefined;

  if (!cabecalho.success || temErro) {
    return { ok: false, mensagem, erros, errosItens };
  }

  return { ok: true, dados: { ...cabecalho.data, itens } };
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
