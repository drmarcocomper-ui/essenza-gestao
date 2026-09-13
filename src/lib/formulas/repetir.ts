import {
  TIPOS_FORMULA,
  UNIDADES,
  type TipoFormula,
  type Unidade,
} from "./schema";

/**
 * "Repetir a última fórmula" — o botão que justifica o app inteiro.
 *
 * O que se repete é a RECEITA: tipo, base, tom alvo, volume, tempo,
 * técnica e a mistura. O que NÃO se repete é o que aconteceu da última
 * vez — `resultado`, `observacao` e `data` ficam de fora de propósito.
 * Copiar o resultado anterior para o campo de resultado da fórmula nova
 * gravaria como fato de hoje uma observação de meses atrás, e ninguém
 * perceberia a diferença lendo a ficha depois.
 *
 * A tela mostra o resultado e a observação da fórmula anterior ao lado,
 * como leitura — é assim que ela decide o que mudar antes de salvar.
 */

export type ItemParaRepetir = {
  descricao: string;
  quantidade: number | string | null;
  unidade: string | null;
};

export type FormulaParaRepetir = {
  tipo: string;
  base_natural: string | null;
  resultado_alvo: string | null;
  volume_oxidante: number | null;
  tempo_pausa_min: number | null;
  tecnica: string | null;
  itens: ItemParaRepetir[];
};

export type ValoresItem = {
  descricao: string;
  quantidade: string;
  unidade: Unidade;
};

export type ValoresFormula = {
  tipo: TipoFormula;
  base_natural: string;
  resultado_alvo: string;
  volume_oxidante: string;
  tempo_pausa_min: string;
  tecnica: string;
  itens: ValoresItem[];
};

const TIPO_PADRAO: TipoFormula = "coloracao";
const UNIDADE_PADRAO: Unidade = "g";

/**
 * numeric do Postgres chega como string ("30.00"). No campo ela precisa
 * ver "30", e "1,5" quando houver fração — nunca "30.00".
 */
export function formatarQuantidade(valor: number | string | null | undefined) {
  const numero = typeof valor === "string" ? Number(valor) : valor;

  if (numero == null || Number.isNaN(numero)) return "";

  return numero.toLocaleString("pt-BR", { maximumFractionDigits: 2 });
}

/** Campo numérico opcional → string do input. Zero e null viram "". */
function numeroParaCampo(valor: number | null | undefined) {
  return valor == null ? "" : String(valor);
}

function ehTipoConhecido(tipo: string): tipo is TipoFormula {
  return (TIPOS_FORMULA as readonly string[]).includes(tipo);
}

function ehUnidadeConhecida(unidade: string): unidade is Unidade {
  return (UNIDADES as readonly string[]).includes(unidade);
}

/**
 * Monta os valores iniciais do formulário a partir de uma fórmula
 * existente. Devolve null quando não há o que repetir — a tela então
 * abre o formulário em branco em vez de errar.
 */
export function valoresParaRepetir(
  formula: FormulaParaRepetir | null | undefined,
): ValoresFormula | null {
  if (!formula) return null;

  return {
    tipo: ehTipoConhecido(formula.tipo) ? formula.tipo : TIPO_PADRAO,
    base_natural: formula.base_natural ?? "",
    resultado_alvo: formula.resultado_alvo ?? "",
    volume_oxidante: numeroParaCampo(formula.volume_oxidante),
    tempo_pausa_min: numeroParaCampo(formula.tempo_pausa_min),
    tecnica: formula.tecnica ?? "",
    itens: formula.itens.map((item) => ({
      descricao: item.descricao,
      quantidade: formatarQuantidade(item.quantidade),
      unidade:
        item.unidade && ehUnidadeConhecida(item.unidade)
          ? item.unidade
          : UNIDADE_PADRAO,
    })),
  };
}
