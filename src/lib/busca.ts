/**
 * Normalização de texto para busca: sem acento, sem maiúscula, sem
 * espaço sobrando. "Jéssica" e "jessica" viram a mesma coisa.
 *
 * O banco guarda o nome como ela digitou; a comparação é sempre feita
 * sobre a forma normalizada.
 */
export function normalizar(valor: string | null | undefined) {
  return (valor ?? "")
    .normalize("NFD")
    // Remove os diacríticos que o NFD separou das letras.
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .trim()
    .replace(/\s+/g, " ");
}

/**
 * O termo casa se aparecer no nome (ignorando acento e caixa) ou nos
 * dígitos do telefone. Termo com dígitos serve para procurar por número
 * mesmo que a usuária digite "(27) 99999" com máscara.
 */
export function clienteCasaComTermo(
  cliente: { nome: string; telefone: string | null },
  termo: string,
) {
  const alvo = normalizar(termo);

  if (!alvo) return true;

  if (normalizar(cliente.nome).includes(alvo)) return true;

  const digitosTermo = alvo.replace(/\D/g, "");

  if (digitosTermo && cliente.telefone) {
    return cliente.telefone.replace(/\D/g, "").includes(digitosTermo);
  }

  return false;
}
