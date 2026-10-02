/**
 * Saldo de um frasco de revenda (021). Calculado, nunca gravado:
 *
 *   saldo = última contagem
 *         + compras DEPOIS dela
 *         − itens de produto em contas FECHADAS DEPOIS dela
 *
 * "Depois" é pela data do fato (a da compra, a do atendimento). No MESMO
 * dia da contagem, decide a hora do registro: a compra conta se
 * `compras.criado_em` é posterior ao `criado_em` da contagem; a venda, se
 * a conta foi fechada depois — o primeiro `lancamentos.criado_em` da
 * conta, que é a hora do fechamento desde a trava do Caixa.
 *
 * Toda a regra mora aqui, sem banco: as consultas só entregam os fatos.
 * `produtos.estoque_atual` e `estoque_minimo` não entram em conta nenhuma.
 */

/** "Contei e tinha N" num dia. */
export type Contagem = {
  /** 'AAAA-MM-DD'. */
  data: string;
  /** `criado_em` da linha, timestamptz como o PostgREST devolve. */
  registradoEm: string;
  quantidade: number;
};

/** Uma linha de compra deste produto. */
export type Entrada = {
  /** `compras.data`. */
  data: string;
  /** `compras.criado_em`. */
  registradoEm: string;
  quantidade: number;
};

/** Um item de produto numa conta. */
export type Saida = {
  /** `atendimentos.data`. */
  data: string;
  /**
   * Primeiro `lancamentos.criado_em` da conta: a hora do fechamento.
   * Null é conta ABERTA — não desconta nada.
   */
  fechadaEm: string | null;
  quantidade: number;
};

export type Saldo =
  | { situacao: "sem_contagem" }
  | {
      situacao: "contado";
      quantidade: number;
      /** A contagem de partida. */
      contagem: Contagem;
    };

/**
 * Instante de um timestamptz, com os microssegundos que o Postgres grava.
 * `Date.parse` corta em milissegundo; no mesmo milissegundo, o resto da
 * fração desempata.
 */
function instante(valor: string): [number, number] {
  const milissegundos = Date.parse(valor);
  const fracao = /T[\d:]+\.(\d+)/.exec(valor)?.[1] ?? "";
  const micro = Number(fracao.padEnd(6, "0").slice(3, 6));

  return [milissegundos, micro];
}

/** a > b, entre dois timestamptz. */
export function registradoDepois(a: string, b: string) {
  const [msA, microA] = instante(a);
  const [msB, microB] = instante(b);

  return msA !== msB ? msA > msB : microA > microB;
}

/**
 * A contagem que vale: a de data mais recente e, no mesmo dia, a
 * registrada por último. Null se o produto nunca foi contado.
 */
export function ultimaContagem(contagens: readonly Contagem[]): Contagem | null {
  let atual: Contagem | null = null;

  for (const contagem of contagens) {
    if (
      !atual ||
      contagem.data > atual.data ||
      (contagem.data === atual.data &&
        registradoDepois(contagem.registradoEm, atual.registradoEm))
    ) {
      atual = contagem;
    }
  }

  return atual;
}

/**
 * Um fato (data + hora do registro) aconteceu depois da contagem?
 * Datas 'AAAA-MM-DD' comparam como texto.
 */
export function depoisDaContagem(
  contagem: Contagem,
  data: string,
  registradoEm: string,
) {
  if (data !== contagem.data) return data > contagem.data;

  return registradoDepois(registradoEm, contagem.registradoEm);
}

export function entradaConta(contagem: Contagem, entrada: Entrada) {
  return depoisDaContagem(contagem, entrada.data, entrada.registradoEm);
}

export function saidaConta(contagem: Contagem, saida: Saida) {
  return (
    saida.fechadaEm !== null &&
    depoisDaContagem(contagem, saida.data, saida.fechadaEm)
  );
}

export function calcularSaldo(
  contagens: readonly Contagem[],
  entradas: readonly Entrada[],
  saidas: readonly Saida[],
): Saldo {
  const contagem = ultimaContagem(contagens);

  if (!contagem) return { situacao: "sem_contagem" };

  let quantidade = contagem.quantidade;

  for (const entrada of entradas) {
    if (entradaConta(contagem, entrada)) quantidade += entrada.quantidade;
  }

  for (const saida of saidas) {
    if (saidaConta(contagem, saida)) quantidade -= saida.quantidade;
  }

  return { situacao: "contado", quantidade, contagem };
}
