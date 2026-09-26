/**
 * Leitura de falha ao fechar a conta.
 *
 * Mesma regra das fotos de fórmula (`src/lib/formulas/erros.ts`): a
 * Kamylle não precisa do código do Postgres, precisa saber uma coisa só
 * — tentar de novo resolve, ou é para chamar o Marco? Tentar de novo em
 * cima de policy errada é ela perdendo tempo com a cliente na cadeira.
 *
 * "Não foi possível fechar a conta" sozinho já escondeu causa duas vezes
 * neste projeto; por isso o erro real vai para o console fora de
 * produção, e a frase da tela sempre diz qual dos dois caminhos seguir.
 */

import { mensagemPecaEmOutraConta } from "@/lib/pecas-extensao/regras";

/** Onde a gravação parou. Muda o que a mensagem pode afirmar. */
export type EtapaConta = "limpar" | "itens" | "lancamentos";

export type FalhaConta = {
  /** O que aparece na tela. */
  texto: string;
  /**
   * true  = circunstância (rede, concorrência): tentar de novo resolve.
   * false = configuração (policy, constraint, coluna): tentar de novo
   *         falha igual e alguém precisa mexer no Supabase.
   */
  podeTentarDeNovo: boolean;
};

/** O que dá para extrair de um PostgrestError, ou do que vier no lugar. */
function detalhes(erro: unknown) {
  if (typeof erro === "object" && erro !== null) {
    const bruto = erro as Record<string, unknown>;

    const textos = [bruto.message, bruto.details, bruto.hint, bruto.code]
      .filter((valor): valor is string => typeof valor === "string")
      .join(" ");

    const codigo = typeof bruto.code === "string" ? bruto.code : "";
    const detalhe = typeof bruto.details === "string" ? bruto.details : "";

    return { mensagem: textos, codigo, detalhe };
  }

  return { mensagem: String(erro ?? ""), codigo: "", detalhe: "" };
}

/** O índice da 020: uma peça, um item. */
const INDICE_PECA_UNICA = "uq_atendimento_itens_peca_extensao";

/**
 * O id da peça repetida, lido do `details` do Postgres —
 * `Key (peca_extensao_id)=(<uuid>) already exists.` —, ou null.
 */
function pecaDoDetalhe(detalhe: string) {
  return detalhe.match(/\(peca_extensao_id\)=\(([^)]+)\)/)?.[1] ?? null;
}

export type ContextoFalhaConta = {
  /** Código da peça pelo id, para o 23505 do índice da 020 nomeá-la. */
  codigoDaPeca?: (id: string) => string | null;
};

/**
 * O que sobra em cada etapa quando ela falha. A frase precisa dizer em
 * que estado o atendimento ficou: a sequência não é uma transação, e o
 * que a tela promete tem que bater com o que está gravado.
 */
const RESTO: Record<EtapaConta, string> = {
  limpar: "A conta segue aberta.",
  itens: "Os itens não foram gravados e a conta segue aberta.",
  lancamentos:
    "Os itens ficaram salvos, mas o pagamento não entrou no Caixa e a conta segue aberta.",
};

export function classificarFalhaConta(
  etapa: EtapaConta,
  erro: unknown,
  contexto: ContextoFalhaConta = {},
): FalhaConta {
  const { mensagem, codigo, detalhe } = detalhes(erro);
  const resto = RESTO[etapa];

  // 23505 unique_violation. O do índice da 020 é a peça que entrou em
  // outra conta entre a tela e o toque: tentar de novo recusa igual, e o
  // que resolve é tirar a peça. Pelo nome do índice na mensagem; o
  // código da peça sai do `details`, quando dá.
  if (codigo === "23505") {
    if (mensagem.includes(INDICE_PECA_UNICA)) {
      const id = pecaDoDetalhe(detalhe);
      const codigoPeca = id ? (contexto.codigoDaPeca?.(id) ?? null) : null;

      return {
        texto: `${mensagemPecaEmOutraConta(codigoPeca)} ${resto}`,
        podeTentarDeNovo: false,
      };
    }

    return {
      texto: `O banco recusou o que a tela mandou. ${resto} Avise o Marco.`,
      podeTentarDeNovo: false,
    };
  }

  // 42501 é insufficient_privilege; a mensagem de RLS vem sem código
  // próprio, dentro do texto.
  if (codigo === "42501" || /row-level security|permission denied/i.test(mensagem)) {
    return {
      texto: `Sem permissão para gravar. ${resto} Avise o Marco.`,
      podeTentarDeNovo: false,
    };
  }

  // 42703 coluna inexistente, 42P01 tabela inexistente, 22P02 tipo
  // errado: o app e o banco estão em versões diferentes.
  if (["42703", "42P01", "22P02"].includes(codigo)) {
    return {
      texto: `O banco não está como o app espera. ${resto} Avise o Marco.`,
      podeTentarDeNovo: false,
    };
  }

  // 23514 check, 23502 not null, 23503 chave estrangeira: o dado que a
  // tela montou não passa na trava. Repetir monta o mesmo dado.
  if (["23514", "23502", "23503"].includes(codigo)) {
    return {
      texto: `O banco recusou o que a tela mandou. ${resto} Avise o Marco.`,
      podeTentarDeNovo: false,
    };
  }

  if (/failed to fetch|network ?error|fetch failed|timeout|aborted/i.test(mensagem)) {
    return {
      texto: `A conexão caiu no meio da gravação. ${resto} Tente de novo.`,
      podeTentarDeNovo: true,
    };
  }

  return {
    texto: `Não consegui fechar a conta. ${resto} Tente de novo.`,
    podeTentarDeNovo: true,
  };
}

/**
 * O erro real no console, fora de produção. Em produção fica de fora,
 * para não expor configuração a quem abrir o DevTools no celular.
 */
export function registrarFalhaConta(etapa: EtapaConta, erro: unknown) {
  if (process.env.NODE_ENV === "production") return;

  console.error(`Falha ao fechar a conta (${etapa}):`, erro);
}
