/**
 * Formatação para a UI: pt-BR em tudo, moeda R$ e datas dd/MM/yyyy.
 *
 * Regra do telefone: o banco guarda só dígitos; a máscara existe apenas
 * na exibição e nos campos de entrada.
 */

const MOEDA = new Intl.NumberFormat("pt-BR", {
  style: "currency",
  currency: "BRL",
});

/** 1234.5 → "R$ 1.234,50". Aceita a string que o Supabase devolve em numeric. */
export function formatarMoeda(valor: number | string | null | undefined) {
  const numero = typeof valor === "string" ? Number(valor) : valor;

  if (numero == null || Number.isNaN(numero)) {
    return MOEDA.format(0);
  }

  return MOEDA.format(numero);
}

/** Tudo que não for dígito some. É o formato que vai para o banco. */
export function apenasDigitos(valor: string | null | undefined) {
  return (valor ?? "").replace(/\D/g, "");
}

/**
 * 27999998888 → "(27) 99999-8888"; 2733334444 → "(27) 3333-4444".
 * Fora desses dois tamanhos devolve o que veio, sem inventar máscara —
 * é melhor ver um número estranho do que um número errado.
 */
export function formatarTelefone(telefone: string | null | undefined) {
  const digitos = apenasDigitos(telefone);

  if (digitos.length === 11) {
    return `(${digitos.slice(0, 2)}) ${digitos.slice(2, 7)}-${digitos.slice(7)}`;
  }

  if (digitos.length === 10) {
    return `(${digitos.slice(0, 2)}) ${digitos.slice(2, 6)}-${digitos.slice(6)}`;
  }

  return telefone ?? "";
}

/** Máscara progressiva, para aplicar enquanto a usuária digita. */
export function mascararTelefone(valor: string) {
  const d = apenasDigitos(valor).slice(0, 11);

  if (d.length <= 2) return d;
  if (d.length <= 6) return `(${d.slice(0, 2)}) ${d.slice(2)}`;
  if (d.length <= 10) return `(${d.slice(0, 2)}) ${d.slice(2, 6)}-${d.slice(6)}`;

  return `(${d.slice(0, 2)}) ${d.slice(2, 7)}-${d.slice(7)}`;
}

/**
 * "2026-03-14" → "14/03/2026".
 *
 * Recorte manual em vez de `new Date(...)`: uma coluna `date` sem hora é
 * lida como UTC pelo construtor e volta um dia atrás em fuso negativo.
 */
export function formatarData(data: string | null | undefined) {
  if (!data) return "";

  const [ano, mes, dia] = data.slice(0, 10).split("-");

  if (!ano || !mes || !dia) return "";

  return `${dia}/${mes}/${ano}`;
}

/**
 * Link do WhatsApp. Só dígitos, com o 55 na frente — e sem duplicar o 55
 * quando o número já vier com o código do país.
 *
 * Devolve null para telefone ausente ou curto demais, para a UI poder
 * simplesmente não mostrar o botão.
 */
export function linkWhatsApp(telefone: string | null | undefined) {
  const digitos = apenasDigitos(telefone);

  if (digitos.length < 10) return null;

  const comPais =
    digitos.length >= 12 && digitos.startsWith("55") ? digitos : `55${digitos}`;

  return `https://wa.me/${comPais}`;
}
