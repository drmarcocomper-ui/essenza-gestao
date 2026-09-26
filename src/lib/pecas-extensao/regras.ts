import { normalizar } from "@/lib/busca";

/**
 * Regras da seção Extensão da aba Produtos que não dependem do banco:
 * duplicidade de código, ordem da lista, busca e sugestões de cor e
 * textura.
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
