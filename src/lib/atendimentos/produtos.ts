import { normalizar } from "@/lib/busca";

/**
 * Produto digitado na hora, no fechamento da conta.
 *
 * Mesmo casamento de nome do serviço (`./servicos`): minúsculas, sem
 * acento, sem espaço sobrando. A diferença está no que se faz com o
 * que casou, porque `produtos` não é `servicos`:
 *
 * - Produto se REATIVA, nunca se recadastra. Um segundo id com o mesmo
 *   nome parte o histórico de venda em dois. Por isso a busca olha a
 *   tabela inteira, inativos e insumos incluídos.
 * - O índice da 011 é nome + marca. "Máscara" Wella e "Máscara"
 *   Kérastase convivem, e um insert com marca nula criaria a terceira.
 *   Com mais de um candidato, o app não escolhe: ela toca no chip certo.
 * - Insumo (tinta, oxidante...) mora na mesma tabela e nunca vira item
 *   vendido, mesmo que o nome bata.
 *
 * O servidor refaz esta decisão com a tabela relida — a tela só a
 * antecipa para ela não esbarrar no erro depois de preencher a conta.
 */

export type ProdutoConferivel = {
  id: string;
  nome: string;
  tipo: string;
  ativo: boolean;
};

export type DecisaoProduto<T extends ProdutoConferivel> =
  | { acao: "reaproveitar"; produto: T }
  | { acao: "inserir" }
  | { acao: "recusar"; mensagem: string };

/** O que fazer com o nome que ela digitou. */
export function decidirProdutoPorNome<T extends ProdutoConferivel>(
  todos: readonly T[],
  nome: string,
): DecisaoProduto<T> {
  const alvo = normalizar(nome);
  const exibido = nome.trim();

  if (!alvo) {
    return { acao: "recusar", mensagem: "Digite o nome do produto." };
  }

  const iguais = todos.filter((produto) => normalizar(produto.nome) === alvo);

  if (iguais.length === 0) return { acao: "inserir" };

  if (iguais.length > 1) {
    return {
      acao: "recusar",
      mensagem: `Existe mais de um produto chamado "${exibido}" — toque no chip certo.`,
    };
  }

  const [produto] = iguais;

  if (!produto.ativo) {
    return {
      acao: "recusar",
      mensagem: `"${produto.nome}" está desativado no catálogo.`,
    };
  }

  if (produto.tipo !== "revenda") {
    return {
      acao: "recusar",
      mensagem: `"${produto.nome}" está no catálogo como material de uso, não como produto de venda.`,
    };
  }

  return { acao: "reaproveitar", produto };
}

/**
 * A linha que o fechamento insere em `produtos`.
 *
 * `preco_venda` NULL, não zero: zero é "de graça" (ver
 * `ProdutoCatalogo.preco`), e o valor desta venda é digitado na conta.
 * `origem_registro` 'atendimento' (019) é como ela acha depois o que
 * falta precificar.
 */
export function novoProdutoDoAtendimento(nome: string) {
  return {
    nome: nome.trim(),
    tipo: "revenda",
    unidade: "un",
    marca: null,
    preco_venda: null,
    origem_registro: "atendimento",
  } as const;
}

/** Quantas sugestões a pergunta de cadastro mostra. */
export const LIMITE_SUGESTOES = 3;

/**
 * Produtos de venda com nome parecido, para a pergunta "Cadastrar X como
 * produto novo?". Parecido é só isto: um nome normalizado contém o
 * outro. "glaze drops" acha "Gloss Absolu Glaze drops". Sem busca
 * aproximada — errar a sugestão custa mais que não sugerir.
 */
export function sugerirProdutos<T extends ProdutoConferivel>(
  todos: readonly T[],
  nome: string,
): T[] {
  const alvo = normalizar(nome);

  if (alvo.length < 2) return [];

  return todos
    .filter((produto) => {
      if (!produto.ativo || produto.tipo !== "revenda") return false;

      const candidato = normalizar(produto.nome);

      return (
        candidato !== "" &&
        (candidato.includes(alvo) || alvo.includes(candidato))
      );
    })
    .slice(0, LIMITE_SUGESTOES);
}
