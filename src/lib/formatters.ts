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

/** "2026-03-14" → "14/03". Dia e mês bastam dentro de uma lista do mês. */
export function formatarDiaMes(data: string | null | undefined) {
  return formatarData(data).slice(0, 5);
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

/**
 * Máscara de moeda para digitação: os dígitos entram pela direita, em
 * centavos. "18" → "0,18"; "18000" → "180,00".
 *
 * É o que deixa o campo de valor funcionar com teclado numérico e uma
 * mão só: ela não digita vírgula nem ponto, só o número.
 */
export function mascararMoeda(valor: string) {
  // 10 dígitos é o teto de numeric(10,2) no banco.
  const digitos = apenasDigitos(valor).slice(0, 10);

  if (!digitos) return "";

  return (Number(digitos) / 100).toLocaleString("pt-BR", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}

/**
 * "1.234,50" → 1234.5. O que a máscara escreve, isto lê de volta.
 *
 * Devolve null quando não sobra número — o schema é quem decide se campo
 * vazio é erro.
 */
export function moedaParaNumero(valor: string | null | undefined) {
  const texto = (valor ?? "").trim();

  if (!texto) return null;

  // A vírgula é o separador decimal; o ponto é milhar. Sem vírgula, só
  // apaga o ponto que estiver separando grupos de três — assim "180.50",
  // digitado num teclado de computador, continua valendo cento e oitenta.
  const semMilhar = texto.includes(",")
    ? texto.replace(/\./g, "").replace(",", ".")
    : texto.replace(/\.(?=\d{3}(\D|$))/g, "");

  const limpo = semMilhar.replace(/[^\d.-]/g, "");

  // Sem nenhum dígito não há valor: "abc" não pode virar zero.
  if (!/\d/.test(limpo)) return null;

  const numero = Number(limpo);

  return Number.isFinite(numero) ? numero : null;
}

/**
 * 1234.5 → "1.234,50". É `formatarMoeda` sem o "R$ ": o que vai dentro
 * do campo de valor, que já mostra o símbolo por fora.
 *
 * O banco devolve numeric como número JSON — 180.00 chega como 180 —,
 * então o campo precisa desta forma completa, com as duas casas. Sem
 * isso a máscara leria "180" como cento e oitenta centavos.
 */
export function valorParaCampo(valor: number | string | null | undefined) {
  const numero = typeof valor === "string" ? Number(valor) : valor;

  if (numero == null || Number.isNaN(numero)) return "";

  return numero.toLocaleString("pt-BR", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}
