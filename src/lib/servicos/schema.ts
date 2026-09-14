/**
 * As categorias do catálogo de serviços.
 *
 * Ao contrário de `agenda/schema.ts` e `caixa/schema.ts`, esta lista não
 * espelha nenhum `check` do banco: `servicos.categoria` é text puro, sem
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
  "Coloração",
  "Corte",
  "Tratamento",
  "Extensão",
  "Serviço",
] as const;

export type CategoriaServico = (typeof CATEGORIAS)[number];

/**
 * O que a Kamylle lê na tela. Hoje é igual ao valor gravado — os valores
 * já nasceram em português, com acento e maiúscula, como em
 * `caixa/schema.ts`. O mapa existe para o rótulo poder mudar sem obrigar
 * um UPDATE no catálogo inteiro.
 */
export const ROTULOS_CATEGORIA: Record<CategoriaServico, string> = {
  Coloração: "Coloração",
  Corte: "Corte",
  Tratamento: "Tratamento",
  Extensão: "Extensão",
  Serviço: "Serviço",
};
