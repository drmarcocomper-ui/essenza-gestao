import { normalizar } from "@/lib/busca";
import { formatarMoeda } from "@/lib/formatters";

/**
 * Regras da seção Extensão da aba Produtos que não dependem do banco:
 * duplicidade de código, ordem da lista, busca, sugestões de cor e
 * textura, e o desmembramento (travas, soma dos custos, códigos das
 * partes).
 */

/**
 * O código como o índice da 018 compara: `lower(trim(codigo))`.
 *
 * De propósito NÃO é a `normalizar()` da busca: ela tira acento e junta
 * espaços do meio, e o índice não faz nenhum dos dois. Conferir mais
 * rígido que o banco recusaria códigos que ele aceita.
 */
export function chaveCodigo(codigo: string) {
  return codigo.trim().toLowerCase();
}

export type PecaIdentificavel = {
  id: string;
  codigo: string;
};

/**
 * A peça da lista que já ocupa este código, se houver.
 *
 * A lista precisa ser a tabela INTEIRA: o índice da 018 é total, e o
 * código de uma peça vendida ou desmembrada continua ocupado para
 * sempre. `ignorarId` é a própria peça, na edição.
 */
export function encontrarCodigoDuplicado<T extends PecaIdentificavel>(
  pecas: readonly T[],
  codigo: string,
  ignorarId?: string,
): T | null {
  const alvo = chaveCodigo(codigo);

  return (
    pecas.find(
      (peca) => peca.id !== ignorarId && chaveCodigo(peca.codigo) === alvo,
    ) ?? null
  );
}

/** A frase que nomeia a peça que já existe, como ela a escreveu. */
export function mensagemCodigoDuplicado(codigo: string) {
  return `Já existe a peça ${codigo.trim()}.`;
}

/**
 * Peça desmembrada fica presa: o código não muda e a peça não é
 * excluída. A tela mostra o motivo; a action recusa com o mesmo texto.
 */
export const MENSAGEM_CODIGO_TRAVADO =
  "Peça desmembrada: o código não muda, porque as partes nasceram dele.";

export const MENSAGEM_EXCLUSAO_TRAVADA =
  "Peça desmembrada não pode ser excluída: as partes apontam para ela.";

/**
 * Parte não sai sozinha nem muda de custo: a soma das partes é o custo
 * da mãe. Para corrigir, desfaz-se o desmembramento inteiro.
 */
export const MENSAGEM_EXCLUSAO_PARTE =
  "Parte não pode ser excluída sozinha: a soma das partes tem de fechar com o custo da mãe; use Desfazer desmembramento na peça mãe.";

export const MENSAGEM_CUSTO_TRAVADO_MAE =
  "Peça desmembrada: o preço de compra não muda, porque as partes somam ele.";

export const MENSAGEM_CUSTO_TRAVADO_PARTE =
  "Parte de peça desmembrada: o preço de compra não muda, porque a soma das partes tem de fechar com o custo da mãe; use Desfazer desmembramento na peça mãe.";

export const MENSAGEM_JA_DESMEMBRADA =
  "Esta peça já foi desmembrada. Para refazer, use Desfazer desmembramento.";

export const MENSAGEM_DESMEMBRAR_SEM_CUSTO =
  "Para desmembrar, informe primeiro o preço de compra da peça.";

export const MENSAGEM_SEM_PARTES = "Esta peça não tem partes.";

export const MENSAGEM_PECA_NAO_ENCONTRADA = "Peça não encontrada.";

export const MENSAGEM_DESFAZER_TRAVADO =
  "Uma das partes também foi desmembrada: desfaça o desmembramento dela primeiro.";

export const MENSAGEM_CODIGO_REPETIDO_PARTES = "Código repetido entre as partes.";

export const MENSAGEM_CUSTO_PARTE_OBRIGATORIO =
  "Informe o preço de compra da parte.";

export const MINIMO_PARTES = 2;
export const MAXIMO_PARTES = 10;

export const MENSAGEM_QUANTIDADE_PARTES = `Desmembre em ${MINIMO_PARTES} a ${MAXIMO_PARTES} partes.`;

/** O que decide as travas de uma peça: é mãe? é parte? tem custo? */
export type SituacaoPeca = {
  pecaMaeId: string | null;
  precoCompra: number | null;
  temFilhas: boolean;
};

export type TravasPeca = {
  codigoTravado: boolean;
  /** null = o preço de compra é editável. */
  motivoCustoTravado: string | null;
  /** null = a peça pode ser excluída. */
  motivoExclusaoTravada: string | null;
  /** null = a peça pode ser desmembrada. */
  motivoNaoDesmembra: string | null;
};

/**
 * Todas as travas numa função só, usada pela tela (o que mostrar) e pela
 * action (o que recusar) — as duas não podem discordar.
 *
 * Parte com filhas ganha as duas travas; o motivo de exclusão mostrado é
 * o de ter filhas, porque o Desfazer da mãe também a recusaria.
 */
export function travasDaPeca({
  pecaMaeId,
  precoCompra,
  temFilhas,
}: SituacaoPeca): TravasPeca {
  const ehParte = pecaMaeId !== null;

  return {
    codigoTravado: temFilhas,
    motivoCustoTravado: temFilhas
      ? MENSAGEM_CUSTO_TRAVADO_MAE
      : ehParte
        ? MENSAGEM_CUSTO_TRAVADO_PARTE
        : null,
    motivoExclusaoTravada: temFilhas
      ? MENSAGEM_EXCLUSAO_TRAVADA
      : ehParte
        ? MENSAGEM_EXCLUSAO_PARTE
        : null,
    motivoNaoDesmembra: temFilhas
      ? MENSAGEM_JA_DESMEMBRADA
      : precoCompra === null
        ? MENSAGEM_DESMEMBRAR_SEM_CUSTO
        : null,
  };
}

/**
 * Reais → centavos inteiros. Toda conta de custo passa por aqui: somar
 * float (0,1 + 0,2 = 0,30000000000000004) e comparar daria "não fecha"
 * numa conta que fecha.
 */
export function paraCentavos(valor: number) {
  return Math.round(valor * 100);
}

/** Mesmo preço, em centavos; null ("não informado") só é igual a null. */
export function mesmoPreco(a: number | null, b: number | null) {
  if (a === null || b === null) return a === b;

  return paraCentavos(a) === paraCentavos(b);
}

export function somarCentavos(valores: readonly number[]) {
  return valores.reduce((soma, valor) => soma + paraCentavos(valor), 0);
}

export type ConferenciaCustos = {
  somaCentavos: number;
  maeCentavos: number;
  /** Custo da mãe menos a soma: positivo falta, negativo sobra. */
  diferencaCentavos: number;
  situacao: "fecha" | "faltam" | "sobram";
};

/** Custo em branco não entra na soma — quem exige o custo é o schema. */
export function conferirCustos(
  custosPartes: readonly (number | null)[],
  custoMae: number,
): ConferenciaCustos {
  const somaCentavos = somarCentavos(
    custosPartes.filter((custo): custo is number => custo !== null),
  );
  const maeCentavos = paraCentavos(custoMae);
  const diferencaCentavos = maeCentavos - somaCentavos;

  return {
    somaCentavos,
    maeCentavos,
    diferencaCentavos,
    situacao:
      diferencaCentavos === 0 ? "fecha" : diferencaCentavos > 0 ? "faltam" : "sobram",
  };
}

function reais(centavos: number) {
  return formatarMoeda(centavos / 100);
}

/** "fecha", "faltam R$ 10,00" ou "sobram R$ 10,00". */
export function textoConferencia({ diferencaCentavos, situacao }: ConferenciaCustos) {
  if (situacao === "fecha") return "fecha";

  return `${situacao} ${reais(Math.abs(diferencaCentavos))}`;
}

export function mensagemSomaNaoFecha(conferencia: ConferenciaCustos) {
  return `A soma dos custos das partes (${reais(conferencia.somaCentavos)}) não fecha com o custo da peça (${reais(conferencia.maeCentavos)}): ${textoConferencia(conferencia)}.`;
}

const LETRAS = "abcdefghijklmnopqrstuvwxyz";

/**
 * Códigos sugeridos para as partes, na caixa da mãe:
 *   termina em dígito → 1254-a, 1254-b, 1254-c…
 *   termina em letra  → 1254-a1, 1254-a2, 1254-a3…
 * Qualquer outro fim (1254-) ganha a letra direto: 1254-a. É só
 * sugestão — ela edita.
 */
export function sugerirCodigos(codigoMae: string, quantidade: number) {
  const base = codigoMae.trim();

  return Array.from({ length: quantidade }, (_, indice) => {
    if (/\p{L}$/u.test(base)) return `${base}${indice + 1}`;
    if (/\d$/.test(base)) return `${base}-${LETRAS[indice]}`;

    return `${base}${LETRAS[indice]}`;
  });
}

/**
 * Posições das partes cujo código repete o de uma parte anterior, com a
 * mesma chave do índice (trim + lower). A primeira ocorrência fica livre;
 * código em branco é assunto do schema.
 */
export function indicesCodigoRepetido(codigos: readonly string[]) {
  const vistos = new Set<string>();
  const repetidos: number[] = [];

  codigos.forEach((codigo, indice) => {
    const chave = chaveCodigo(codigo);

    if (!chave) return;

    if (vistos.has(chave)) repetidos.push(indice);
    else vistos.add(chave);
  });

  return repetidos;
}

/**
 * Qual código o 23505 recusou, lido do `details` do Postgres —
 * `Key (lower(TRIM(BOTH FROM codigo)))=(1254-a) already exists.` —, e
 * devolvido como ela escreveu, se for de uma das partes. null se o
 * formato não for reconhecido.
 */
export function codigoDoDuplicado(
  detalhe: string | null | undefined,
  codigos: readonly string[],
) {
  const chave = detalhe?.match(/=\((.*)\) already exists/)?.[1];

  if (!chave) return null;

  return codigos.find((codigo) => chaveCodigo(codigo) === chave) ?? chave;
}

/** Ordem natural: 999 < 1254 < 1254-a < 1254-a1 < 1254-b. */
export function compararCodigos(a: string, b: string) {
  return a.localeCompare(b, "pt-BR", { numeric: true, sensitivity: "base" });
}

export type PecaOrdenavel = PecaIdentificavel & {
  pecaMaeId: string | null;
};

export type PecaNaLista<T> = {
  peca: T;
  /** 0 = peça inteira; 1 = parte; 2 = parte de parte. */
  nivel: number;
};

/**
 * Ordem da lista: por código, em ordem natural, com cada parte logo
 * abaixo da mãe (e as partes dela, abaixo dela).
 *
 * Peça cuja mãe não está na lista — filtrada pela busca — sobe para o
 * primeiro nível. Ciclo (A→B, B→A) não nasce pelo app, que nunca
 * atualiza `peca_mae_id`, mas se existir no banco as peças presas nele
 * ainda aparecem, no fim, em vez de sumirem ou travarem a tela.
 */
export function ordenarPecas<T extends PecaOrdenavel>(
  pecas: readonly T[],
): PecaNaLista<T>[] {
  const ids = new Set(pecas.map((peca) => peca.id));
  const filhasDe = new Map<string | null, T[]>();

  for (const peca of pecas) {
    const mae =
      peca.pecaMaeId && peca.pecaMaeId !== peca.id && ids.has(peca.pecaMaeId)
        ? peca.pecaMaeId
        : null;

    filhasDe.set(mae, [...(filhasDe.get(mae) ?? []), peca]);
  }

  for (const grupo of filhasDe.values()) {
    grupo.sort((a, b) => compararCodigos(a.codigo, b.codigo));
  }

  const saida: PecaNaLista<T>[] = [];
  const vistas = new Set<string>();

  function visitar(maeId: string | null, nivel: number) {
    for (const peca of filhasDe.get(maeId) ?? []) {
      if (vistas.has(peca.id)) continue;

      vistas.add(peca.id);
      saida.push({ peca, nivel });
      visitar(peca.id, nivel + 1);
    }
  }

  visitar(null, 0);

  const presasEmCiclo = [...pecas]
    .filter((peca) => !vistas.has(peca.id))
    .sort((a, b) => compararCodigos(a.codigo, b.codigo));

  for (const peca of presasEmCiclo) {
    if (vistas.has(peca.id)) continue;

    vistas.add(peca.id);
    saida.push({ peca, nivel: 0 });
    visitar(peca.id, 1);
  }

  return saida;
}

/** Busca pelo código, com a mesma normalização do resto do app. */
export function pecaCasaComTermo(peca: { codigo: string }, termo: string) {
  const alvo = normalizar(termo);

  if (!alvo) return true;

  return normalizar(peca.codigo).includes(alvo);
}

/**
 * Sugestões do `<datalist>` de cor e textura: o que ela já gravou, uma
 * vez cada, na primeira grafia encontrada. "Castanho" e "castanho " são
 * a mesma sugestão.
 */
export function valoresDistintos(valores: readonly (string | null)[]) {
  const porChave = new Map<string, string>();

  for (const valor of valores) {
    const texto = valor?.trim();

    if (!texto) continue;

    const chave = normalizar(texto);

    if (!porChave.has(chave)) porChave.set(chave, texto);
  }

  return [...porChave.values()].sort((a, b) => a.localeCompare(b, "pt-BR"));
}
