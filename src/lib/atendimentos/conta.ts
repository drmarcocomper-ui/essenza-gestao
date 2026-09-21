import { z } from "zod";

import { dataCaixaNoFuturo, MENSAGEM_DATA_FUTURA } from "@/lib/caixa/schema";
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
// A maquininha
// ---------------------------------------------------------------------

/**
 * A SumUp é a única instituição que não diz sozinha como o dinheiro
 * andou: é maquininha, e passa crédito e débito. Nas outras cinco a
 * pergunta não existe e nada é gravado por acidente.
 */
export const INSTITUICAO_MAQUININHA = "SumUp";

export const MODALIDADES_CARTAO = ["credito", "debito"] as const;

export type ModalidadeCartao = (typeof MODALIDADES_CARTAO)[number];

/** O rótulo de cada modalidade na tela. */
export const ROTULO_MODALIDADE: Record<ModalidadeCartao, string> = {
  credito: "Crédito",
  debito: "Débito",
};

/**
 * Modalidade para `lancamentos.forma_pagamento`. Os dois textos já
 * existem no `check` da coluna (002) e no histórico importado — nenhum
 * valor novo é inventado aqui.
 */
export const FORMA_POR_MODALIDADE: Record<ModalidadeCartao, string> = {
  credito: "Cartão de crédito",
  debito: "Cartão de débito",
};

/**
 * Teto de parcelas. O histórico dela vai até 4; 12 é o que a maquininha
 * oferece, e recusar 6x por falta de opção seria a tela mentindo sobre
 * o que aconteceu no balcão.
 */
export const PARCELAS_MAXIMO = 12;

/** Se a tela precisa perguntar crédito ou débito. */
export function exigeModalidade(instituicao: string) {
  return instituicao === INSTITUICAO_MAQUININHA;
}

/** A modalidade que vai para o banco. Fora da maquininha é sempre null. */
export function modalidadeDe(
  instituicao: string,
  escolhida: string | null,
): ModalidadeCartao | null {
  if (!exigeModalidade(instituicao)) return null;

  return MODALIDADES_CARTAO.includes(escolhida as ModalidadeCartao)
    ? (escolhida as ModalidadeCartao)
    : null;
}

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
// Parcelamento
// ---------------------------------------------------------------------

/**
 * O valor de uma forma dividido em N parcelas, em REAIS, na ordem.
 *
 * Partes iguais, e A SOBRA DE CENTAVO VAI NA ÚLTIMA. A soma das N
 * parcelas bate exatamente com o valor da forma — é o que mantém o
 * Caixa fechando com o que ela cobrou, e o que impede a própria
 * validação de total de recusar depois uma conta legítima.
 *
 * 629,90 em 3x sai 209,96 + 209,96 + 209,98. Dividir "certinho" daria
 * 209,9666… e três parcelas de 209,97 somariam 629,91 — um centavo a
 * mais do que passou na maquininha.
 *
 * A divisão é feita em centavos inteiros: 629,90 / 3 em ponto flutuante
 * não tem resposta exata, e a sobra não seria contável.
 */
export function dividirEmParcelas(valor: number, parcelas: number) {
  const vezes = Math.max(1, Math.trunc(parcelas));
  const total = emCentavos(valor);
  const base = Math.trunc(total / vezes);
  const sobra = total - base * vezes;

  return Array.from({ length: vezes }, (_, indice) =>
    emReais(indice === vezes - 1 ? base + sobra : base),
  );
}

/** O rótulo da parcela. Null em 1x: "1/1" afirmaria parcelamento que não houve. */
export function rotuloParcela(indice: number, parcelas: number) {
  return parcelas > 1 ? `${indice + 1}/${parcelas}` : null;
}

/** Uma linha de `lancamentos`, na parte que o parcelamento decide. */
export type ParcelaConta = {
  forma_pagamento: string | null;
  status: "Pago" | "Pendente";
  data_caixa: string | null;
  parcelamento: string | null;
  valor: number;
};

/**
 * As linhas de `lancamentos` que uma forma de pagamento gera.
 *
 * Uma por parcela, todas do mesmo atendimento — é o `atendimento_id`
 * que amarra as parcelas entre si, não existe coluna de vínculo.
 *
 * CRÉDITO NASCE PENDENTE E SEM DATA DE CAIXA, inclusive a primeira
 * parcela e inclusive em 1x: o crédito cai em torno de trinta dias, não
 * hoje. Dizer o contrário encheria o resumo de caixa de dinheiro que
 * ainda não existe na conta dela. A data de cada parcela entra depois,
 * em "A receber", no dia em que ela vê o dinheiro cair — o app NUNCA
 * prevê data de compensação.
 *
 * Débito e as demais instituições continuam nascendo Pagas, com a data
 * que a tela perguntou.
 */
export function parcelasDaForma(
  forma: {
    instituicao: string;
    modalidade: ModalidadeCartao | null;
    parcelas: number;
    valor: number;
  },
  dataCaixa: string,
): ParcelaConta[] {
  const credito = forma.modalidade === "credito";
  const vezes = credito
    ? Math.min(Math.max(1, Math.trunc(forma.parcelas)), PARCELAS_MAXIMO)
    : 1;

  const forma_pagamento = forma.modalidade
    ? FORMA_POR_MODALIDADE[forma.modalidade]
    : (FORMA_POR_INSTITUICAO[forma.instituicao as Instituicao] ?? null);

  return dividirEmParcelas(forma.valor, vezes).map((valor, indice) => ({
    forma_pagamento,
    status: credito ? "Pendente" : "Pago",
    // `chk_lancamento_caixa` (002) só exige data quando o status é Pago.
    data_caixa: credito ? null : dataCaixa,
    parcelamento: rotuloParcela(indice, vezes),
    valor,
  }));
}

/**
 * Se a conta precisa da "Data do pagamento".
 *
 * A data só vira `data_caixa` de linha que nasce Paga — tudo menos
 * crédito (ver `parcelasDaForma`). Conta 100% crédito não tem linha
 * nenhuma que a use: perguntar faria ela preencher achando que está
 * dizendo quando o dinheiro entrou, e não está.
 *
 * Forma ainda sem instituição, ou maquininha sem crédito/débito
 * escolhido, conta como "entra hoje": a pergunta só some quando TODAS as
 * formas estão confirmadas como crédito. Lista vazia também exige — não
 * há o que afirmar, e o schema recusa conta sem forma de qualquer jeito.
 *
 * A tela e o schema chamam esta mesma função.
 */
export function exigeDataDePagamento(
  formas: readonly { instituicao: string; modalidade: string | null }[],
) {
  if (formas.length === 0) return true;

  return formas.some(
    (forma) => modalidadeDe(forma.instituicao, forma.modalidade) !== "credito",
  );
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
 * O valor vago, e o que a conta recebe quando mistura categorias.
 * Serviço sem categoria — estado normal, ver 012 — e serviço com
 * categoria fora da lista da aplicação também caem aqui.
 *
 * É a ordem 1 de `categorias_lancamento` (002).
 */
export const CATEGORIA_PADRAO = "Serviço";

export type ItemClassificavel = {
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
 * A categoria que os lançamentos da conta recebem, POR UNANIMIDADE.
 *
 * `lancamentos.categoria` é `not null` e a conta tem uma só, mas a mesma
 * conta mistura coloração, corte e produto. Quando todos os itens caem
 * na mesma categoria traduzida, é ela; quando a conta mistura, é
 * "Serviço".
 *
 * Escolher a categoria de maior valor mentiria: corte de 350 com produto
 * de 650 lançaria os 1.000 inteiros como Produto, e a view de resumo
 * passaria a afirmar uma venda de revenda que não houve. "Serviço" é
 * vago; "Produto" é errado.
 *
 * A composição verdadeira da conta está em `atendimento_itens`, item a
 * item, com valor e quantidade. A categoria do lançamento é resumo com
 * perda, não fonte — quem precisar do detalhe lê os itens.
 */
export function categoriaDaConta(itens: readonly ItemClassificavel[]) {
  if (itens.length === 0) return CATEGORIA_PADRAO;

  const primeira = categoriaDoItem(itens[0]);

  return itens.every((item) => categoriaDoItem(item) === primeira)
    ? primeira
    : CATEGORIA_PADRAO;
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

    /** Crédito ou débito. Só a maquininha manda isto preenchido. */
    modalidade: z
      .string()
      .trim()
      .transform((v) => (v === "" ? null : v))
      .nullable(),

    /**
     * Vezes na maquininha. Chega como texto do campo escondido; vazio é
     * 1, que é a conta da maioria das vezes.
     */
    parcelas: z.string().transform((bruto, ctx) => {
      const texto = bruto.trim();

      if (texto === "") return 1;

      const numero = Number(texto);

      if (!Number.isInteger(numero) || numero < 1 || numero > PARCELAS_MAXIMO) {
        ctx.addIssue({
          code: "custom",
          message: `Parcele em até ${PARCELAS_MAXIMO} vezes.`,
        });

        return z.NEVER;
      }

      return numero;
    }),

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

    if (
      exigeModalidade(forma.instituicao) &&
      modalidadeDe(forma.instituicao, forma.modalidade) === null
    ) {
      ctx.addIssue({
        code: "custom",
        path: ["modalidade"],
        message: `Diga se o ${forma.instituicao} foi crédito ou débito.`,
      });
    }
  })
  .transform((forma) => {
    const modalidade = modalidadeDe(forma.instituicao, forma.modalidade);

    return {
      ...forma,
      // O que a tela não perguntou não vai para o banco por acidente: a
      // titularidade e a modalidade são recalculadas a partir da
      // instituição.
      titularidade: titularidadeDe(forma.instituicao, forma.titularidade),
      modalidade,
      // Parcela só existe em crédito. Débito, Pix e dinheiro são uma
      // linha só, e o número que ficou na tela não pode vazar para lá.
      parcelas: modalidade === "credito" ? forma.parcelas : 1,
    };
  });

export type FormaConta = z.infer<typeof formaContaSchema>;

export const contaSchema = z
  .object({
    /**
     * Obrigatória só quando alguma forma nasce Paga — a regra é
     * `exigeDataDePagamento`, conferida no `superRefine` porque depende
     * das formas. Em conta 100% crédito a tela nem mostra o campo, e o
     * que chegar aqui não alimenta linha nenhuma.
     */
    data_caixa: z.string().trim(),

    itens: z.array(itemContaSchema).min(1, "Escolha pelo menos um item"),

    formas: z.array(formaContaSchema).min(1, "Diga por onde ela pagou"),
  })
  .superRefine((conta, ctx) => {
    if (exigeDataDePagamento(conta.formas)) {
      if (!z.iso.date().safeParse(conta.data_caixa).success) {
        ctx.addIssue({
          code: "custom",
          path: ["data_caixa"],
          message: "Informe a data em que o dinheiro entrou",
        });
      } else if (dataCaixaNoFuturo(conta.data_caixa)) {
        // A mesma regra do Caixa: nenhum lançamento Pago com data de
        // caixa no futuro. O `max` do campo é só a primeira camada.
        ctx.addIssue({
          code: "custom",
          path: ["data_caixa"],
          message: MENSAGEM_DATA_FUTURA,
        });
      }
    }

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
  const modalidades = formData.getAll("forma_modalidade").map(String);
  const parcelas = formData.getAll("forma_parcelas").map(String);
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
      modalidade: modalidades[indice] ?? "",
      parcelas: parcelas[indice] ?? "",
      valor: valoresForma[indice] ?? "",
    })),
  };
}
