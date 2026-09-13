import { normalizar } from "@/lib/busca";

/**
 * Casamento de serviço pelo nome.
 *
 * O catálogo é digitado com pressa, entre um atendimento e outro:
 * "Coloração", "coloracao" e "Coloração " são a mesma coisa e não podem
 * virar três linhas. A comparação usa a mesma normalização da busca de
 * clientes — minúsculas, sem acento, sem espaço sobrando.
 *
 * O Postgres faria isso com `unaccent` e uma coluna normalizada, o que é
 * mudança de schema fora desta fase. Enquanto o catálogo cabe em uma
 * tela, comparar em memória é mais barato que migrar o banco.
 */

export type ServicoComparavel = { id: string; nome: string };

/** O serviço do catálogo com o mesmo nome, ou null. */
export function acharServicoPorNome<T extends ServicoComparavel>(
  catalogo: readonly T[],
  nome: string,
): T | null {
  const alvo = normalizar(nome);

  if (!alvo) return null;

  return catalogo.find((servico) => normalizar(servico.nome) === alvo) ?? null;
}

/** Se este nome já está entre os escolhidos da tela. */
export function jaEscolhido(
  escolhidos: readonly { nome: string }[],
  nome: string,
) {
  const alvo = normalizar(nome);

  if (!alvo) return false;

  return escolhidos.some((servico) => normalizar(servico.nome) === alvo);
}
