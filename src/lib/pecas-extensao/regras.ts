import { normalizar } from "@/lib/busca";
import { formatarData, formatarMoeda } from "@/lib/formatters";

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

/**
 * A conta em que a peça entrou, quando entrou: o item de
 * `atendimento_itens` com `peca_extensao_id` = esta peça (020). Uma peça,
 * um item — então no máximo uma conta.
 */
export type ContaDaPeca = {
  atendimentoId: string;
  clienteId: string;
  clienteNome: string;
  /** Data do atendimento, 'AAAA-MM-DD'. */
  data: string;
  /** Existe lançamento com este `atendimento_id`. */
  fechada: boolean;
};

/**
 * Estado da peça. Nenhum é coluna (ver 018 e 020): tudo sai de "tem
 * partes?" e "tem item? a conta dele tem lançamento?".
 */
export type EstadoPeca =
  | "disponivel"
  | "desmembrada"
  | "na_conta_aberta"
  | "vendida";

/**
 * Peça com partes nunca ganha item (`pecaVendavelNaConta`) e peça com
 * item nunca é desmembrada (`travasDaPeca`), então as duas coisas não
 * convivem. Se um dia conviverem no banco, a conta ganha: o que foi
 * vendido é o fato que não se pode esconder.
 */
export function estadoDaPeca({
  temFilhas,
  conta,
}: {
  temFilhas: boolean;
  conta: Pick<ContaDaPeca, "fechada"> | null;
}): EstadoPeca {
  if (conta) return conta.fechada ? "vendida" : "na_conta_aberta";

  return temFilhas ? "desmembrada" : "disponivel";
}

/**
 * Se a peça pode entrar na conta do atendimento `atendimentoId`: inteira
 * (sem partes — a mãe desmembrada já virou as partes) e livre, ou já
 * nesta mesma conta (conta reaberta, ou fechamento que falhou no meio).
 *
 * `atendimentoDoItem` é o atendimento do item que já aponta para a
 * peça, ou null se não há item.
 */
export function pecaVendavelNaConta(
  {
    temFilhas,
    atendimentoDoItem,
  }: { temFilhas: boolean; atendimentoDoItem: string | null },
  atendimentoId: string,
) {
  if (temFilhas) return false;

  return atendimentoDoItem === null || atendimentoDoItem === atendimentoId;
}

/** "Esta peça está na conta de Maria em 12/09/2026" — sem ponto final. */
function naContaDe(conta: ContaDaPeca) {
  return `Esta peça está na conta de ${conta.clienteNome} em ${formatarData(conta.data)}`;
}

export function mensagemCodigoEmConta(conta: ContaDaPeca) {
  return `${naContaDe(conta)}: o código não muda.`;
}

export function mensagemExclusaoEmConta(conta: ContaDaPeca) {
  return `${naContaDe(conta)} e não pode ser excluída.`;
}

export function mensagemDesmembrarEmConta(conta: ContaDaPeca) {
  return `${naContaDe(conta)} e não pode ser desmembrada.`;
}

/**
 * O 23503 da FK da 020 quando a conta não pôde ser relida para dizer de
 * quem é (a peça entrou e saiu da conta entre o toque e a releitura).
 */
export const MENSAGEM_EXCLUSAO_EM_CONTA =
  "Esta peça está numa conta e não pode ser excluída.";

/**
 * Se o 23503 veio da FK de `atendimento_itens.peca_extensao_id` (020) —
 * "is still referenced from table atendimento_itens" — e não da
 * `peca_mae_id` da 018. As duas recusas pedem recados diferentes.
 */
export function referenciadaPorConta(
  erro: { code?: string; message?: string; details?: string } | null,
) {
  if (erro?.code !== "23503") return false;

  return /atendimento_itens/.test(`${erro.message ?? ""} ${erro.details ?? ""}`);
}

/**
 * Desfazer apaga as partes, e parte que está numa conta não sai (o
 * `on delete restrict` da 020 recusaria de qualquer jeito).
 */
export function mensagemDesfazerParteEmConta(codigoParte: string | null) {
  return codigoParte
    ? `A parte ${codigoParte} está numa conta: o desmembramento não pode ser desfeito.`
    : "Uma das partes está numa conta: o desmembramento não pode ser desfeito.";
}

/**
 * A peça escolhida na conta já é item de outro atendimento. A action
 * recusa com esta frase, e o 23505 do índice único da 020 vira a mesma.
 */
export function mensagemPecaEmOutraConta(codigo: string | null) {
  return codigo
    ? `A peça ${codigo} já está em outra conta.`
    : "A peça já está em outra conta.";
}

export function mensagemPecaDesmembradaNaConta(codigo: string) {
  return `A peça ${codigo} foi desmembrada: escolha uma das partes.`;
}

export const MENSAGEM_PECA_SUMIU_DA_CONTA =
  "Uma das peças de extensão não existe mais.";

export const MENSAGEM_PECA_REPETIDA_NA_CONTA =
  "A mesma peça de extensão entrou duas vezes na conta.";

/** O que decide as travas de uma peça: é mãe? é parte? tem custo? está numa conta? */
export type SituacaoPeca = {
  pecaMaeId: string | null;
  precoCompra: number | null;
  temFilhas: boolean;
  /** A conta em que a peça entrou, aberta ou fechada; null se nenhuma. */
  conta: ContaDaPeca | null;
};

export type TravasPeca = {
  codigoTravado: boolean;
  /** null = o código é editável. */
  motivoCodigoTravado: string | null;
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
 *
 * Peça numa conta — aberta ou fechada — não desmembra, não é excluída e
 * não muda de código: o item da conta aponta para ela, e o código é o
 * que a descrição do item ("Extensão 1254") diz. O motivo da conta vem
 * antes dos outros, porque é o primeiro a resolver (reabrir a conta e
 * tirar a peça). O preço de compra segue as regras de antes: o item
 * grava o valor de venda, não o custo.
 */
export function travasDaPeca({
  pecaMaeId,
  precoCompra,
  temFilhas,
  conta,
}: SituacaoPeca): TravasPeca {
  const ehParte = pecaMaeId !== null;

  const motivoCodigoTravado = conta
    ? mensagemCodigoEmConta(conta)
    : temFilhas
      ? MENSAGEM_CODIGO_TRAVADO
      : null;

  return {
    codigoTravado: motivoCodigoTravado !== null,
    motivoCodigoTravado,
    motivoCustoTravado: temFilhas
      ? MENSAGEM_CUSTO_TRAVADO_MAE
      : ehParte
        ? MENSAGEM_CUSTO_TRAVADO_PARTE
        : null,
    motivoExclusaoTravada: conta
      ? mensagemExclusaoEmConta(conta)
      : temFilhas
        ? MENSAGEM_EXCLUSAO_TRAVADA
        : ehParte
          ? MENSAGEM_EXCLUSAO_PARTE
          : null,
    motivoNaoDesmembra: conta
      ? mensagemDesmembrarEmConta(conta)
      : temFilhas
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

/**
 * Ids das peças desmembradas: as que alguma peça da lista aponta como
 * mãe. Consulta, não coluna (ver 018). Recebe a lista inteira, não a
 * filtrada pela busca — a mãe continua desmembrada mesmo com as partes
 * fora da tela.
 */
export function idsDesmembradas(pecas: readonly { pecaMaeId: string | null }[]) {
  return new Set(
    pecas.flatMap((peca) => (peca.pecaMaeId ? [peca.pecaMaeId] : [])),
  );
}

/** Busca pelo código, com a mesma normalização do resto do app. */
export function pecaCasaComTermo(peca: { codigo: string }, termo: string) {
  const alvo = normalizar(termo);

  if (!alvo) return true;

  return normalizar(peca.codigo).includes(alvo);
}

/**
 * Busca da peça na conta: a chave do índice da 018 (`chaveCodigo`, trim
 * + lower), "contém". Termo vazio casa com tudo.
 */
export function codigoContemTermo(codigo: string, termo: string) {
  const alvo = chaveCodigo(termo);

  return !alvo || chaveCodigo(codigo).includes(alvo);
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
