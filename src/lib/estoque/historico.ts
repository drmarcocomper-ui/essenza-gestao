import type {
  ContagemRegistrada,
  EntradaRegistrada,
  Movimentos,
  SaidaRegistrada,
} from "@/lib/estoque/consultas";
import {
  entradaConta,
  registradoDepois,
  saidaConta,
  ultimaContagem,
} from "@/lib/estoque/saldo";

/**
 * O histórico da página do produto: contagens, compras e vendas numa
 * lista só, do mais recente para o mais antigo. Cada linha diz se ficou
 * fora do saldo e por quê — é o que explica o número lá de cima.
 */

export type EventoHistorico =
  | ({ tipo: "contagem"; vigente: boolean } & ContagemRegistrada)
  | ({ tipo: "compra"; foraDoSaldo: string | null } & EntradaRegistrada)
  | ({ tipo: "venda"; foraDoSaldo: string | null } & SaidaRegistrada);

/** Data e hora do registro; venda em conta aberta só tem a data. */
function momento(evento: EventoHistorico): [string, string | null] {
  if (evento.tipo === "venda") return [evento.data, evento.fechadaEm];

  return [evento.data, evento.registradoEm];
}

/** Mais recente primeiro. No mesmo dia, o registrado por último em cima. */
function maisRecentePrimeiro(a: EventoHistorico, b: EventoHistorico) {
  const [dataA, horaA] = momento(a);
  const [dataB, horaB] = momento(b);

  if (dataA !== dataB) return dataA > dataB ? -1 : 1;

  // Conta aberta ainda não aconteceu de fato: fica no topo do dia.
  if (horaA === null || horaB === null) {
    return horaA === horaB ? 0 : horaA === null ? -1 : 1;
  }

  if (registradoDepois(horaA, horaB)) return -1;
  if (registradoDepois(horaB, horaA)) return 1;

  return 0;
}

export function montarHistorico(movimentos: Movimentos): EventoHistorico[] {
  const vigente = ultimaContagem(movimentos.contagens);

  /** Sem contagem não há saldo — nada a explicar linha a linha. */
  function motivoEntrada(entrada: EntradaRegistrada) {
    if (!vigente || entradaConta(vigente, entrada)) return null;

    return "Antes da contagem";
  }

  function motivoSaida(saida: SaidaRegistrada) {
    if (saida.fechadaEm === null) return "Conta aberta";
    if (!vigente || saidaConta(vigente, saida)) return null;

    return "Antes da contagem";
  }

  const eventos: EventoHistorico[] = [
    ...movimentos.contagens.map((contagem) => ({
      ...contagem,
      tipo: "contagem" as const,
      vigente: contagem === vigente,
    })),
    ...movimentos.entradas.map((entrada) => ({
      ...entrada,
      tipo: "compra" as const,
      foraDoSaldo: motivoEntrada(entrada),
    })),
    ...movimentos.saidas.map((saida) => ({
      ...saida,
      tipo: "venda" as const,
      foraDoSaldo: motivoSaida(saida),
    })),
  ];

  return eventos.sort(maisRecentePrimeiro);
}

/**
 * Quanto ela pagou da última vez: o custo da compra mais recente (data,
 * e no empate a registrada por último). Null se nunca comprou.
 */
export function ultimoCustoPago(
  entradas: readonly EntradaRegistrada[],
): number | null {
  let ultima: EntradaRegistrada | null = null;

  for (const entrada of entradas) {
    if (
      !ultima ||
      entrada.data > ultima.data ||
      (entrada.data === ultima.data &&
        registradoDepois(entrada.registradoEm, ultima.registradoEm))
    ) {
      ultima = entrada;
    }
  }

  return ultima?.custoUnitario ?? null;
}
