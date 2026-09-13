/**
 * Leitura de falha no envio da foto.
 *
 * A Kamylle não precisa do código do erro; precisa saber uma coisa só:
 * tentar de novo resolve, ou é para chamar o Marco? Tentar de novo em
 * cima de policy errada é ela perdendo tempo no meio do atendimento.
 *
 * O detalhe técnico vai para o console, fora de produção — o mesmo
 * arranjo do login.
 */

/** Onde o envio parou. Muda o que a mensagem pode afirmar. */
export type EtapaUpload = "preparar" | "enviar" | "registrar";

export type FalhaUpload = {
  /** O que aparece na tela. */
  texto: string;
  /**
   * true  = circunstância (rede, arquivo): tentar de novo faz sentido.
   * false = configuração (permissão, limite do bucket): tentar de novo
   *         vai falhar igual, e alguém precisa mexer no Supabase.
   */
  podeTentarDeNovo: boolean;
};

type Detalhes = { mensagem: string; status: number };

/**
 * O que der para extrair de um erro que pode ser Error, StorageApiError
 * ou qualquer coisa que o `catch` pegou.
 */
function detalhes(erro: unknown): Detalhes {
  if (typeof erro === "object" && erro !== null) {
    const bruto = erro as Record<string, unknown>;

    const textos = [bruto.message, bruto.error, bruto.name, bruto.code]
      .filter((valor): valor is string => typeof valor === "string")
      .join(" ");

    // StorageApiError traz `status` número e `statusCode` string.
    const status = Number(bruto.status ?? bruto.statusCode ?? Number.NaN);

    return { mensagem: textos, status };
  }

  return { mensagem: String(erro ?? ""), status: Number.NaN };
}

function casa(mensagem: string, padrao: RegExp) {
  return padrao.test(mensagem);
}

/**
 * Traduz a falha em uma frase e um veredito.
 *
 * `online` entra por parâmetro em vez de ler `navigator` aqui dentro
 * para a regra continuar testável fora do navegador.
 */
export function classificarFalhaUpload(
  etapa: EtapaUpload,
  erro: unknown,
  online = true,
): FalhaUpload {
  const { mensagem, status } = detalhes(erro);

  // Sem rede nenhuma: nada do resto importa, e o diagnóstico é certeiro.
  if (!online) {
    return {
      texto:
        "Sem internet agora. A fórmula está salva — mande a foto quando a conexão voltar.",
      podeTentarDeNovo: true,
    };
  }

  // Falhou antes de sair do celular: o arquivo é que não serve.
  if (etapa === "preparar") {
    // HEIC é o padrão da câmera do iPhone e não abre em Chrome, Firefox
    // nem Edge. Dizer só "tente outra foto" faria ela tentar a próxima
    // foto da câmera, que é HEIC também — e falhar de novo.
    if (casa(mensagem, /formatonaosuportado|heic|heif/i)) {
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
    casa(mensagem, /row-level security|unauthorized|not authorized|permission/i)
  ) {
    return {
      texto: "Sem permissão para guardar a foto. Avise o Marco.",
      podeTentarDeNovo: false,
    };
  }

  if (status === 413 || casa(mensagem, /maximum allowed size|too large/i)) {
    return {
      texto: "O servidor recusou o tamanho da foto. Avise o Marco.",
      podeTentarDeNovo: false,
    };
  }

  if (
    status === 415 ||
    casa(mensagem, /mime type|not supported|invalid_mime/i)
  ) {
    return {
      texto: "O servidor recusou o formato da foto. Avise o Marco.",
      podeTentarDeNovo: false,
    };
  }

  if (casa(mensagem, /failed to fetch|networkerror|network ?error|aborted/i)) {
    return {
      texto: "A conexão caiu no meio do envio. Tente de novo.",
      podeTentarDeNovo: true,
    };
  }

  // A fórmula já está gravada; só o vínculo da foto não entrou.
  if (etapa === "registrar") {
    return {
      texto: "A foto subiu, mas não consegui ligá-la à fórmula. Tente de novo.",
      podeTentarDeNovo: true,
    };
  }

  return {
    texto: "Não foi possível enviar a foto. Tente de novo.",
    podeTentarDeNovo: true,
  };
}
