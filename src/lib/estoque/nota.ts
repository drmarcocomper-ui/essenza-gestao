import { ehHeic, ERRO_FORMATO, reduzirImagem } from "@/lib/formulas/imagem";

/**
 * Convenção do bucket privado das notas fiscais de compra (021).
 *
 * Módulo neutro, como `@/lib/formulas/storage`: o servidor assina as
 * URLs e apaga; o navegador prepara e sobe o arquivo.
 */

/** Bucket privado. Exibição só por URL assinada — nunca getPublicUrl. */
export const BUCKET_NOTAS = "notas-fiscais";

/** Cinco minutos, como as fotos de fórmula: abrir e olhar. */
export const SEGUNDOS_URL_NOTA = 300;

/** Teto do bucket. Foto é reduzida antes e não chega perto disso. */
export const LIMITE_PDF_BYTES = 10 * 1024 * 1024;

export const EXTENSOES_NOTA = ["pdf", "jpg"] as const;

export type ExtensaoNota = (typeof EXTENSOES_NOTA)[number];

export function ehExtensaoNota(valor: unknown): valor is ExtensaoNota {
  return (EXTENSOES_NOTA as readonly unknown[]).includes(valor);
}

/**
 * Caminho DENTRO do bucket: {compra_id}/nota.<ext>. Determinístico: trocar
 * a nota de mesmo formato sobrescreve, e o servidor recalcula o caminho
 * sem confiar no navegador.
 */
export function caminhoNota(compraId: string, extensao: ExtensaoNota) {
  return `${compraId}/nota.${extensao}`;
}

/** 'abc/nota.pdf' → 'pdf'. Null para qualquer coisa fora da convenção. */
export function extensaoDoCaminho(caminho: string): ExtensaoNota | null {
  const extensao = /\/nota\.([a-z]+)$/.exec(caminho)?.[1];

  return ehExtensaoNota(extensao) ? extensao : null;
}

export function ehPdf(arquivo: { name: string; type: string }) {
  return arquivo.type === "application/pdf" || /\.pdf$/i.test(arquivo.name);
}

const ERRO_PDF_GRANDE = "PdfGrande";
const ERRO_NAO_E_NOTA = "NaoEhNota";

function erroNomeado(nome: string, mensagem: string) {
  const erro = new Error(mensagem);
  erro.name = nome;

  return erro;
}

export type NotaPreparada = {
  arquivo: Blob;
  extensao: ExtensaoNota;
  contentType: string;
};

/**
 * PDF sobe como está (até 10 MB). Foto passa pela mesma redução das
 * fotos de fórmula — 1600px, JPEG 0.8, EXIF respeitado, HEIC tratado.
 * Só roda no navegador.
 */
export async function prepararNota(arquivo: File): Promise<NotaPreparada> {
  if (ehPdf(arquivo)) {
    if (arquivo.size > LIMITE_PDF_BYTES) {
      throw erroNomeado(ERRO_PDF_GRANDE, "PDF acima de 10 MB.");
    }

    return { arquivo, extensao: "pdf", contentType: "application/pdf" };
  }

  // `type` vazio acontece no iOS (app Arquivos): a extensão desempata.
  const imagem =
    arquivo.type.startsWith("image/") ||
    ehHeic(arquivo) ||
    /\.(jpe?g|png|webp)$/i.test(arquivo.name);

  if (!imagem) {
    throw erroNomeado(ERRO_NAO_E_NOTA, "Nem PDF nem imagem.");
  }

  return {
    arquivo: await reduzirImagem(arquivo),
    extensao: "jpg",
    contentType: "image/jpeg",
  };
}

export type EtapaNota = "preparar" | "enviar" | "registrar";

export type FalhaNota = {
  texto: string;
  /** false = configuração do Supabase; tentar de novo falha igual. */
  podeTentarDeNovo: boolean;
};

function textoDoErro(erro: unknown) {
  if (typeof erro !== "object" || erro === null) return String(erro ?? "");

  const bruto = erro as Record<string, unknown>;

  return [bruto.name, bruto.message, bruto.error]
    .filter((valor): valor is string => typeof valor === "string")
    .join(" ");
}

function statusDoErro(erro: unknown) {
  if (typeof erro !== "object" || erro === null) return Number.NaN;

  const bruto = erro as Record<string, unknown>;

  return Number(bruto.status ?? bruto.statusCode ?? Number.NaN);
}

/**
 * A frase da falha, no mesmo espírito de `classificarFalhaUpload` das
 * fórmulas: tentar de novo resolve, ou é para chamar o Marco. A compra já
 * está salva quando a nota sobe — a frase diz isso.
 */
export function falhaDaNota(
  etapa: EtapaNota,
  erro: unknown,
  online = true,
): FalhaNota {
  const mensagem = textoDoErro(erro);
  const status = statusDoErro(erro);

  if (!online) {
    return {
      texto: "Sem internet agora. A compra está salva — mande a nota quando a conexão voltar.",
      podeTentarDeNovo: true,
    };
  }

  if (etapa === "preparar") {
    if (mensagem.includes(ERRO_PDF_GRANDE)) {
      return {
        texto: "PDF maior que 10 MB. Mande uma foto da nota no lugar.",
        podeTentarDeNovo: true,
      };
    }

    if (mensagem.includes(ERRO_NAO_E_NOTA)) {
      return {
        texto: "Mande uma foto ou um PDF da nota.",
        podeTentarDeNovo: true,
      };
    }

    if (mensagem.includes(ERRO_FORMATO) || /heic|heif/i.test(mensagem)) {
      return {
        texto:
          "Foto em HEIC, que este navegador não abre. No iPhone: Ajustes › Câmera › Formatos › Mais compatível.",
        podeTentarDeNovo: true,
      };
    }

    return {
      texto: "Não consegui ler essa imagem. Tente outra foto.",
      podeTentarDeNovo: true,
    };
  }

  if (
    status === 401 ||
    status === 403 ||
    /row-level security|unauthorized|not authorized|permission/i.test(mensagem)
  ) {
    return {
      texto: "Sem permissão para guardar a nota. Avise o Marco.",
      podeTentarDeNovo: false,
    };
  }

  if (status === 413 || /maximum allowed size|too large/i.test(mensagem)) {
    return {
      texto: "O servidor recusou o tamanho da nota. Avise o Marco.",
      podeTentarDeNovo: false,
    };
  }

  if (status === 415 || /mime type|not supported|invalid_mime/i.test(mensagem)) {
    return {
      texto: "O servidor recusou o formato da nota. Avise o Marco.",
      podeTentarDeNovo: false,
    };
  }

  if (/failed to fetch|networkerror|network ?error|aborted/i.test(mensagem)) {
    return {
      texto: "A conexão caiu no meio do envio. Tente de novo.",
      podeTentarDeNovo: true,
    };
  }

  if (etapa === "registrar") {
    return {
      texto: "A nota subiu, mas não consegui ligá-la à compra. Tente de novo.",
      podeTentarDeNovo: true,
    };
  }

  return {
    texto: "Não foi possível enviar a nota. Tente de novo.",
    podeTentarDeNovo: true,
  };
}
