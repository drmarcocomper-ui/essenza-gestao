/**
 * Preparo da foto antes de subir para o Storage.
 *
 * A foto sai do celular com 3 a 12 MB; o bucket aceita 10 MB e a rede do
 * salão é a do celular dela. Reduzir no navegador é o que faz o envio
 * caber em segundos — e nada disso precisa de biblioteca: `createImageBitmap`
 * + `<canvas>` resolvem os dois problemas de uma vez.
 */

/** Lado maior da imagem enviada. Acima disso não se ganha detalhe de cor. */
export const LADO_MAXIMO = 1600;

/** Qualidade do JPEG. 0.8 é o ponto em que o arquivo cai sem manchar o tom. */
export const QUALIDADE = 0.8;

export type Dimensoes = { largura: number; altura: number };

/**
 * Dimensões finais mantendo a proporção, com o lado maior limitado.
 *
 * Imagem menor que o teto passa intacta: ampliar só inventaria pixel e
 * engordaria o arquivo.
 */
export function calcularDimensoes(
  largura: number,
  altura: number,
  ladoMaximo: number = LADO_MAXIMO,
): Dimensoes {
  const maior = Math.max(largura, altura);

  if (maior <= ladoMaximo || maior === 0) {
    return { largura, altura };
  }

  const escala = ladoMaximo / maior;

  // O lado menor pode arredondar para 0 numa imagem muito alongada;
  // canvas com dimensão 0 não desenha nada.
  return {
    largura: Math.max(1, Math.round(largura * escala)),
    altura: Math.max(1, Math.round(altura * escala)),
  };
}

/**
 * Reduz e recomprime a foto. Só roda no navegador.
 *
 * `imageOrientation: 'from-image'` é obrigatório: foto de iPhone vem em
 * paisagem com a rotação no EXIF, e o canvas ignora EXIF. Sem esta opção
 * o "antes" sobe deitado, e não há como consertar depois do upload.
 */
export async function reduzirImagem(arquivo: File): Promise<Blob> {
  const bitmap = await createImageBitmap(arquivo, {
    imageOrientation: "from-image",
  });

  try {
    const { largura, altura } = calcularDimensoes(bitmap.width, bitmap.height);

    const canvas = document.createElement("canvas");
    canvas.width = largura;
    canvas.height = altura;

    const contexto = canvas.getContext("2d");

    if (!contexto) {
      throw new Error("O navegador não conseguiu preparar a foto.");
    }

    contexto.drawImage(bitmap, 0, 0, largura, altura);

    const blob = await new Promise<Blob | null>((resolve) =>
      canvas.toBlob(resolve, "image/jpeg", QUALIDADE),
    );

    if (!blob || blob.size === 0) {
      throw new Error("O navegador não conseguiu preparar a foto.");
    }

    // `toBlob` cai para PNG em silêncio quando o navegador não codifica o
    // tipo pedido. Passar isso adiante subiria bytes PNG com o nome
    // .jpg e o contentType image/jpeg — mentira que só apareceria muito
    // depois, num bucket que valida MIME.
    if (blob.type !== "image/jpeg") {
      throw new Error(
        `O navegador gerou ${blob.type || "um tipo desconhecido"} em vez de JPEG.`,
      );
    }

    return blob;
  } finally {
    // Libera a memória do bitmap mesmo quando o canvas falha — são
    // dezenas de MB descomprimidos.
    bitmap.close();
  }
}
