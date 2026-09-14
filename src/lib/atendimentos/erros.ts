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

    return { mensagem: textos, codigo };
  }

  return { mensagem: String(erro ?? ""), codigo: "" };
}

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
): FalhaConta {
  const { mensagem, codigo } = detalhes(erro);
  const resto = RESTO[etapa];

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
