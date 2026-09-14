import { z } from "zod";

import { moedaParaNumero } from "@/lib/formatters";
import { CATEGORIAS, type CategoriaServico } from "@/lib/servicos/schema";

/**
 * A conta do atendimento: o que foi feito, quanto custou e por onde o
 * dinheiro entrou.
 *
 * Tudo aqui é cálculo puro e validação — nada de Supabase, para a regra
 * poder ser testada sem banco. Quem grava é a action.
 *
 * Dinheiro é somado em CENTAVOS, inteiros. Em ponto flutuante
 * `0,1 + 0,2` não dá `0,3`, e a tela recusa fechar a conta quando a
 * diferença não é exatamente zero: um centavo de resto de binário
 * travaria o fechamento sem que ela tivesse como consertar.
 */

/**
 * As seis formas de pagamento dela, como instituição.
 *
 * Lista fechada de propósito. `lancamentos.instituicao` é text livre no
 * banco, e foi assim que o histórico importado ficou com "SumUp" com e
 * sem titularidade. A trava mora aqui.
 */
export const INSTITUICOES = [
  "SumUp",
  "Nubank",
  "PicPay",
  "Dinheiro",
  "Terceiro",
  "Cortesia",
] as const;

export type Instituicao = (typeof INSTITUICOES)[number];

/**
 * As duas que ela escolhe na tela. A coluna `titularidade` aceita um
 * terceiro valor, "Terceiro" (002), que não é opção aqui: aquilo é o
 * titular da conta no histórico da planilha, não quem pagou.
 */
export const TITULARIDADES_CONTA = ["PF", "PJ"] as const;

export type TitularidadeConta = (typeof TITULARIDADES_CONTA)[number];

/**
 * Instituições onde a mesma marca tem as duas contas, a dela e a do
 * CNPJ. Sem a resposta, o lançamento não diz de qual conta é o dinheiro.
 */
const COM_DUAS_CONTAS: readonly string[] = ["Nubank", "PicPay"];

/** SumUp é a maquininha do CNPJ: titularidade conhecida, não perguntada. */
const TITULARIDADE_FIXA: Partial<Record<Instituicao, TitularidadeConta>> = {
  SumUp: "PJ",
};

/** Se a tela precisa perguntar PF ou PJ. */
export function exigeTitularidade(instituicao: string) {
  return COM_DUAS_CONTAS.includes(instituicao);
}

/**
 * A titularidade que vai para o banco.
 *
 * Onde a tela não pergunta, grava null em vez de chutar: Dinheiro,
 * Terceiro e Cortesia não passam por conta bancária nenhuma.
 */
export function titularidadeDe(
  instituicao: string,
  escolhida: string | null,
): TitularidadeConta | null {
  const fixa = TITULARIDADE_FIXA[instituicao as Instituicao];

  if (fixa) return fixa;

  if (!exigeTitularidade(instituicao)) return null;

  return escolhida === "PF" || escolhida === "PJ" ? escolhida : null;
}

/**
 * Instituição para `lancamentos.forma_pagamento`, quando a instituição
 * determina a forma sem chute.
 *
 * São duas colunas diferentes e não sinônimas: `forma_pagamento` é como
 * o dinheiro andou ("Pix"), `instituicao` é onde ele caiu ("Nubank"). A
 * tela só pergunta a segunda, porque é o que ela sabe de cabeça na hora.
 *
 * Só Dinheiro e Cortesia se traduzem sozinhas. SumUp é maquininha e não
 * diz se foi débito ou crédito; Nubank e PicPay recebem Pix e
 * transferência; Terceiro não diz nada. Nas outras quatro a coluna fica
 * null — que é o "Não informada" que o próprio formulário do Caixa
 * oferece, e é melhor que inventar forma no meio de 413 lançamentos de
 * histórico que ela usa para conferir o mês.
 */
export const FORMA_POR_INSTITUICAO: Partial<Record<Instituicao, string>> = {
  Dinheiro: "Dinheiro",
  Cortesia: "Cortesia",
};

// ---------------------------------------------------------------------
// Soma
// ---------------------------------------------------------------------

export type LinhaValor = { quantidade: number; valorUnitario: number };

/** Reais para centavos, já arredondado. */
export function emCentavos(valor: number) {
  return Math.round(valor * 100);
}

/** Centavos para reais, que é o formato do banco e da UI. */
export function emReais(centavos: number) {
  return centavos / 100;
}

/**
 * Total de uma linha, em centavos. Arredonda a linha, não a soma: é o
 * que a calculadora dela faz, e o que ela confere item a item.
 */
export function totalLinha({ quantidade, valorUnitario }: LinhaValor) {
  return Math.round(quantidade * emCentavos(valorUnitario));
}

/** Total dos itens, em centavos. */
export function totalItens(itens: readonly LinhaValor[]) {
  return itens.reduce((soma, item) => soma + totalLinha(item), 0);
}

/** Total das formas de pagamento, em centavos. */
export function totalFormas(formas: readonly { valor: number }[]) {
  return formas.reduce((soma, forma) => soma + emCentavos(forma.valor), 0);
}

/**
 * Formas menos itens, em centavos.
 *
 * Negativo é o que falta receber; positivo é o que sobrou nas formas.
 * Zero é a única diferença que fecha conta.
 */
export function diferencaConta(
  itens: readonly LinhaValor[],
  formas: readonly { valor: number }[],
) {
  return totalFormas(formas) - totalItens(itens);
}

/** Centavos para "R$ 1.234,50". É o que as mensagens de diferença dizem. */
export function formatarCentavos(centavos: number) {
  return emReais(centavos).toLocaleString("pt-BR", {
    style: "currency",
    currency: "BRL",
  });
}

// ---------------------------------------------------------------------
// Categoria e descrição do lançamento
// ---------------------------------------------------------------------

/**
 * Categoria do serviço (catálogo) para categoria do lançamento (Caixa).
 *
 * São dois vocabulários, criados em migrations diferentes:
 * `servicos.categoria` (012) agrupa chips na tela; `lancamentos.categoria`
 * é o que ela já usava na planilha e está gravado nos 413 lançamentos
 * importados. Os nomes do lado direito são exatamente os de
 * `categorias_lancamento` (002) — mudar um aqui descola o relatório do
 * histórico.
 */
const CATEGORIA_LANCAMENTO: Record<CategoriaServico, string> = {
  coloracao: "Coloração",
  corte: "Corte",
  tratamento: "Tratamento",
  extensao: "Manutenção Extensão",
  servico: "Serviço",
};

export const CATEGORIA_PRODUTO = "Produto";

/**
 * Serviço sem categoria — estado normal, ver 012 — e serviço com
 * categoria fora da lista da aplicação caem aqui.
 */
export const CATEGORIA_PADRAO = "Serviço";

export type ItemClassificavel = LinhaValor & {
  tipo: "servico" | "produto";
  /** `servicos.categoria` crua; null e valor desconhecido são previstos. */
  categoria?: string | null;
};

function categoriaDoItem(item: ItemClassificavel) {
  if (item.tipo === "produto") return CATEGORIA_PRODUTO;

  const categoria = item.categoria;

  return categoria && CATEGORIAS.includes(categoria as CategoriaServico)
    ? CATEGORIA_LANCAMENTO[categoria as CategoriaServico]
    : CATEGORIA_PADRAO;
}

/**
 * A categoria que os lançamentos da conta recebem.
 *
 * `lancamentos.categoria` é `not null` e uma conta só tem uma, mas a
 * mesma conta mistura coloração, corte e produto. A escolhida é a de
 * maior valor — o que a conta foi, principalmente. Empate fica com o
 * item escolhido primeiro, e não com uma ordem fixa: numa conta de
 * cortesia todos os totais são zero, e aí o primeiro item é a única
 * pista do que ela veio fazer.
 */
export function categoriaDaConta(itens: readonly ItemClassificavel[]) {
  if (itens.length === 0) return CATEGORIA_PADRAO;

  const totais = new Map<string, number>();

  for (const item of itens) {
    const categoria = categoriaDoItem(item);

    totais.set(categoria, (totais.get(categoria) ?? 0) + totalLinha(item));
  }

  let escolhida = categoriaDoItem(itens[0]);

  for (const [categoria, total] of totais) {
    if (total > (totais.get(escolhida) ?? 0)) escolhida = categoria;
  }

  return escolhida;
}

/** Teto de `lancamentos.descricao` no schema do Caixa. */
const MAXIMO_DESCRICAO = 200;

/**
 * A descrição do lançamento: o que ela lê na lista do Caixa sem abrir o
 * atendimento. "Essenza Cut Hair, 2× Gloss Absolu Glaze drops".
 */
export function descricaoDaConta(
  itens: readonly { descricao: string; quantidade: number }[],
) {
  const texto = itens
    .map((item) =>
      item.quantidade > 1
        ? `${item.quantidade}× ${item.descricao}`
        : item.descricao,
    )
    .join(", ");

  if (!texto) return "Atendimento";

  if (texto.length <= MAXIMO_DESCRICAO) return texto;

  return `${texto.slice(0, MAXIMO_DESCRICAO - 1).trimEnd()}…`;
}

// ---------------------------------------------------------------------
// Validação do que a tela manda
// ---------------------------------------------------------------------

/** Teto de numeric(10,2). */
const VALOR_MAXIMO = 99_999_999.99;

/** Quantidade alta é dedo escorregado, não venda. */
const QUANTIDADE_MAXIMA = 99;

/**
 * Valor obrigatório, vindo mascarado ("1.234,50").
 *
 * Campo vazio é erro e zero é aceito: vazio é "sem preço" e zero é
 * cortesia, e as duas coisas não podem virar a mesma.
 */
const valorObrigatorio = z.string().transform((bruto, ctx) => {
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
});

export const itemContaSchema = z.object({
  tipo: z.enum(["servico", "produto"], { message: "Item inválido" }),

  // `chk_item_referencia` (001) exige a referência do lado certo: item
  // sem id de catálogo não existe.
  refId: z
    .string()
    .trim()
    .refine((v) => z.uuid().safeParse(v).success, {
      message: "Item fora do catálogo",
    }),

  quantidade: z.string().transform((bruto, ctx) => {
    const numero = Number(bruto.trim());

    if (!Number.isInteger(numero) || numero < 1 || numero > QUANTIDADE_MAXIMA) {
      ctx.addIssue({ code: "custom", message: "Quantidade inválida" });
      return z.NEVER;
    }

    return numero;
  }),

  valorUnitario: valorObrigatorio,
});

export type ItemConta = z.infer<typeof itemContaSchema>;

export const formaContaSchema = z
  .object({
    instituicao: z.enum(INSTITUICOES, {
      message: "Escolha por onde ela pagou",
    }),
    titularidade: z
      .string()
      .trim()
      .transform((v) => (v === "" ? null : v))
      .nullable(),
    valor: valorObrigatorio,
  })
  .superRefine((forma, ctx) => {
    if (
      exigeTitularidade(forma.instituicao) &&
      forma.titularidade !== "PF" &&
      forma.titularidade !== "PJ"
    ) {
      ctx.addIssue({
        code: "custom",
        path: ["titularidade"],
        message: `Diga se o ${forma.instituicao} é PF ou PJ.`,
      });
    }
  })
  .transform((forma) => ({
    ...forma,
    // O que a tela não perguntou não vai para o banco por acidente: a
    // titularidade é recalculada a partir da instituição.
    titularidade: titularidadeDe(forma.instituicao, forma.titularidade),
  }));

export type FormaConta = z.infer<typeof formaContaSchema>;

export const contaSchema = z
  .object({
    data_caixa: z
      .string()
      .trim()
      .refine((v) => z.iso.date().safeParse(v).success, {
        message: "Informe a data em que o dinheiro entrou",
      }),

    itens: z.array(itemContaSchema).min(1, "Escolha pelo menos um item"),

    formas: z.array(formaContaSchema).min(1, "Diga por onde ela pagou"),
  })
  .superRefine((conta, ctx) => {
    const resto = diferencaConta(
      conta.itens,
      conta.formas.map((forma) => ({ valor: forma.valor })),
    );

    if (resto !== 0) {
      ctx.addIssue({
        code: "custom",
        path: ["formas"],
        message:
          resto < 0
            ? `Faltam ${formatarCentavos(-resto)} nas formas de pagamento.`
            : `Sobram ${formatarCentavos(resto)} nas formas de pagamento.`,
      });
    }
  });

export type DadosConta = z.infer<typeof contaSchema>;

export type CampoConta = "data_caixa" | "itens" | "formas";

/** Achata os erros do Zod em `seção → primeira mensagem`. */
export function errosDaConta(erro: z.ZodError) {
  const erros: Partial<Record<CampoConta, string>> = {};

  for (const problema of erro.issues) {
    const campo = problema.path[0] as CampoConta | undefined;

    if (campo && !erros[campo]) {
      erros[campo] = problema.message;
    }
  }

  return erros;
}

/**
 * FormData para o que o schema espera.
 *
 * Listas paralelas, como no formulário de atendimento: cada linha da
 * tela vira uma posição em cada `getAll`. O formulário é controlado por
 * estado, então nenhum campo visível tem `name` — quem viaja são os
 * campos escondidos que o componente escreve.
 */
export function lerConta(formData: FormData) {
  const tipos = formData.getAll("item_tipo").map(String);
  const refs = formData.getAll("item_ref").map(String);
  const quantidades = formData.getAll("item_quantidade").map(String);
  const valores = formData.getAll("item_valor").map(String);

  const instituicoes = formData.getAll("forma_instituicao").map(String);
  const titularidades = formData.getAll("forma_titularidade").map(String);
  const valoresForma = formData.getAll("forma_valor").map(String);

  return {
    data_caixa: String(formData.get("data_caixa") ?? ""),
    itens: tipos.map((tipo, indice) => ({
      tipo,
      refId: refs[indice] ?? "",
      quantidade: quantidades[indice] ?? "",
      valorUnitario: valores[indice] ?? "",
    })),
    formas: instituicoes.map((instituicao, indice) => ({
      instituicao,
      titularidade: titularidades[indice] ?? "",
      valor: valoresForma[indice] ?? "",
    })),
  };
}
