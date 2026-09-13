/**
 * Convenção do bucket privado das fotos de fórmula.
 *
 * Módulo neutro de propósito: é importado tanto pelo servidor (que
 * assina as URLs) quanto pelo navegador (que sobe o arquivo), então não
 * pode puxar nada de `next/headers` nem do cliente Supabase de servidor.
 */

/** Bucket privado. Exibição só por URL assinada — nunca getPublicUrl. */
export const BUCKET_FORMULAS = "formulas";

/**
 * Validade da URL assinada, em segundos.
 *
 * Cinco minutos: tempo de sobra para a página abrir e ela olhar a foto,
 * e curto o bastante para um link copiado por engano não virar um
 * endereço público da foto da cliente.
 */
export const SEGUNDOS_URL_ASSINADA = 300;

/**
 * Caminho do objeto DENTRO do bucket `formulas`:
 *   {cliente_id}/{formula_id}/{antes|depois}.jpg
 *
 * Sem o nome do bucket na frente — `from('formulas')` já o define, e
 * repetir 'formulas/' criaria uma pasta a mais dentro do próprio bucket.
 *
 * O caminho é determinístico de propósito: refazer a foto sobrescreve a
 * anterior, e o servidor consegue recalculá-lo sem confiar no navegador.
 */
export function caminhoFoto(
  clienteId: string,
  formulaId: string,
  momento: string,
) {
  return `${clienteId}/${formulaId}/${momento}.jpg`;
}
