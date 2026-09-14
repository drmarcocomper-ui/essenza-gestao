/**
 * As categorias do catálogo de serviços.
 *
 * Os valores são os que vão para o banco: minúsculos, sem acento. Os
 * rótulos são o que a Kamylle lê na tela; nada exibe o valor cru. Mesma
 * divisão do status da agenda — valor cru no banco, rótulo na tela.
 *
 * Ao contrário de `agenda/schema.ts` e `caixa/schema.ts`, esta lista não
 * espelha nenhum `check`: `servicos.categoria` é text puro, sem
 * constraint, de propósito (ver migration 012). A lista ainda vai mudar
 * conforme o catálogo assenta, e no banco cada categoria nova viraria uma
 * migration aplicada à mão. Aqui é uma linha. Quem manda é este arquivo.
 *
 * Consequência de não haver trava no banco: uma linha com categoria fora
 * desta lista é possível — importação antiga, edição no SQL Editor. Quem
 * ler `categoria` do banco trata o valor como texto que pode não estar
 * aqui, não como `CategoriaServico` garantido.
 *
 * `categoria` é nullable e null é normal: o serviço criado no ato de um
 * atendimento (`origem_registro = 'atendimento'`) nasce sem categoria.
 */
export const CATEGORIAS = [
  "coloracao",
  "corte",
  "tratamento",
  "extensao",
  "servico",
] as const;

export type CategoriaServico = (typeof CATEGORIAS)[number];

export const ROTULOS_CATEGORIA: Record<CategoriaServico, string> = {
  coloracao: "Coloração",
  corte: "Corte",
  tratamento: "Tratamento",
  extensao: "Extensão",
  servico: "Serviço",
};
