import { normalizar } from "@/lib/busca";

/**
 * Regras da tela de Produtos que não dependem do banco: duplicidade por
 * nome + marca, ordem da lista e busca.
 */

export type ProdutoIdentificavel = {
  id: string;
  nome: string;
  marca: string | null;
  tipo: string;
};

/** Nome + marca como o app compara: sem acento, caixa ou espaço sobrando. */
export function chaveProduto(nome: string, marca: string | null) {
  return `${normalizar(nome)}|${normalizar(marca)}`;
}

/**
 * O produto ativo que já ocupa este nome + marca, se houver.
 *
 * `ativos` precisa vir de TODOS os tipos: o índice da 011 não olha o
 * tipo, então um insumo com o mesmo nome e marca também bloqueia o
 * insert. `ignorarId` é o próprio produto, na edição e na reativação.
 *
 * O app é mais rígido que o índice: "Máscara" e "Mascara" colidem aqui
 * e passariam lá (a 011 não usa unaccent). Para quem digita, é o mesmo
 * produto.
 */
export function encontrarDuplicado<T extends ProdutoIdentificavel>(
  ativos: readonly T[],
  nome: string,
  marca: string | null,
  ignorarId?: string,
): T | null {
  const alvo = chaveProduto(nome, marca);

  return (
    ativos.find(
      (produto) =>
        produto.id !== ignorarId &&
        chaveProduto(produto.nome, produto.marca) === alvo,
    ) ?? null
  );
}

/** A frase que nomeia o produto que já existe. */
export function mensagemDuplicado(existente: ProdutoIdentificavel) {
  const marca = existente.marca ? ` (${existente.marca})` : " (sem marca)";
  const comoInsumo =
    existente.tipo === "revenda" ? "" : ", cadastrado como material de uso";

  return `Já existe o produto "${existente.nome}"${marca}${comoInsumo}. Use outro nome ou outra marca.`;
}

/** Rede de baixo: o índice da 011 barrou o que a conferência não viu. */
export const MENSAGEM_DUPLICADO_BANCO =
  "Já existe um produto ativo com esse nome e essa marca.";

export type ProdutoOrdenavel = {
  nome: string;
  preco: number | null;
};

/**
 * Sem preço no topo — é o que ela precisa resolver —, depois por nome
 * em ordem alfabética do português.
 */
export function ordenarProdutos<T extends ProdutoOrdenavel>(
  produtos: readonly T[],
): T[] {
  return [...produtos].sort((a, b) => {
    const semPrecoA = a.preco === null ? 0 : 1;
    const semPrecoB = b.preco === null ? 0 : 1;

    if (semPrecoA !== semPrecoB) return semPrecoA - semPrecoB;

    return a.nome.localeCompare(b.nome, "pt-BR", { sensitivity: "base" });
  });
}

/** Busca pelo nome, com a mesma normalização do resto do app. */
export function produtoCasaComTermo(
  produto: { nome: string },
  termo: string,
) {
  const alvo = normalizar(termo);

  if (!alvo) return true;

  return normalizar(produto.nome).includes(alvo);
}
