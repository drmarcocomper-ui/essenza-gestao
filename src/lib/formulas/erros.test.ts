import { describe, expect, it } from "vitest";

import { classificarFalhaUpload } from "./erros";

/** Como o supabase-js entrega um erro do Storage. */
function erroStorage(mensagem: string, status?: number) {
  return { name: "StorageApiError", message: mensagem, status, statusCode: status ? String(status) : undefined };
}

describe("classificarFalhaUpload", () => {
  it("sem internet, diz que a fórmula está salva e manda tentar depois", () => {
    const falha = classificarFalhaUpload("enviar", erroStorage("qualquer"), false);

    expect(falha.podeTentarDeNovo).toBe(true);
    expect(falha.texto).toMatch(/sem internet/i);
    // O medo real dela é ter perdido o que digitou.
    expect(falha.texto).toMatch(/fórmula está salva/i);
  });

  it("falha ao preparar é problema do arquivo, não do servidor", () => {
    const falha = classificarFalhaUpload(
      "preparar",
      new Error("The source image cannot be decoded."),
    );

    expect(falha.podeTentarDeNovo).toBe(true);
    expect(falha.texto).toMatch(/outra foto/i);
  });

  describe("HEIC do iPhone", () => {
    /** O erro que `reduzirImagem` levanta quando o HEIC não decodifica. */
    function erroHeic() {
      const erro = new Error("O navegador não decodifica HEIC.");
      erro.name = "FormatoNaoSuportado";
      return erro;
    }

    it("nomeia o formato em vez de mandar tentar outra foto", () => {
      // "Tente outra foto" faria ela ir na próxima foto da câmera, que é
      // HEIC também, e falhar de novo.
      const falha = classificarFalhaUpload("preparar", erroHeic());

      expect(falha.texto).toMatch(/heic/i);
      expect(falha.texto).not.toMatch(/outra foto/i);
    });

    it("diz onde mudar o ajuste no iPhone", () => {
      const falha = classificarFalhaUpload("preparar", erroHeic());

      expect(falha.texto).toMatch(/mais compatível/i);
      expect(falha.podeTentarDeNovo).toBe(true);
    });

    it("também pega o InvalidStateError cru do navegador", () => {
      // Se o erro chegar sem o nome marcado, a palavra HEIC na mensagem
      // ainda resolve.
      const falha = classificarFalhaUpload(
        "preparar",
        new Error("InvalidStateError ao ler heic"),
      );

      expect(falha.texto).toMatch(/heic/i);
    });
  });

  describe("manda chamar o Marco quando é configuração", () => {
    it("policy faltando (RLS)", () => {
      const falha = classificarFalhaUpload(
        "enviar",
        erroStorage("new row violates row-level security policy", 403),
      );

      expect(falha.podeTentarDeNovo).toBe(false);
      expect(falha.texto).toMatch(/permissão/i);
      expect(falha.texto).toMatch(/marco/i);
    });

    it("401 sem mensagem reconhecível", () => {
      const falha = classificarFalhaUpload("enviar", erroStorage("", 401));

      expect(falha.podeTentarDeNovo).toBe(false);
      expect(falha.texto).toMatch(/permissão/i);
    });

    it("limite de tamanho do bucket", () => {
      const falha = classificarFalhaUpload(
        "enviar",
        erroStorage("The object exceeded the maximum allowed size", 413),
      );

      expect(falha.podeTentarDeNovo).toBe(false);
      expect(falha.texto).toMatch(/tamanho/i);
    });

    it("MIME recusado pelo bucket", () => {
      const falha = classificarFalhaUpload(
        "enviar",
        erroStorage("mime type image/jpeg is not supported", 415),
      );

      expect(falha.podeTentarDeNovo).toBe(false);
      expect(falha.texto).toMatch(/formato/i);
    });
  });

  it("queda de rede no meio do envio manda tentar de novo", () => {
    const falha = classificarFalhaUpload(
      "enviar",
      new TypeError("Failed to fetch"),
    );

    expect(falha.podeTentarDeNovo).toBe(true);
    expect(falha.texto).toMatch(/conexão caiu/i);
  });

  it("falha só ao registrar avisa que a foto subiu", () => {
    const falha = classificarFalhaUpload(
      "registrar",
      new Error("duplicate key value violates unique constraint"),
    );

    expect(falha.podeTentarDeNovo).toBe(true);
    expect(falha.texto).toMatch(/subiu/i);
  });

  it("erro desconhecido cai na mensagem genérica, mas tentável", () => {
    const falha = classificarFalhaUpload("enviar", erroStorage("boom", 500));

    expect(falha.podeTentarDeNovo).toBe(true);
    expect(falha.texto).toMatch(/não foi possível enviar/i);
  });

  it("aguenta erro que não é objeto", () => {
    expect(() => classificarFalhaUpload("enviar", "quebrou")).not.toThrow();
    expect(() => classificarFalhaUpload("enviar", null)).not.toThrow();
    expect(() => classificarFalhaUpload("enviar", undefined)).not.toThrow();
  });

  it("permissão ganha de rede quando os dois casam", () => {
    // 403 com texto de rede: o veredito tem que ser o que impede a
    // repetição inútil.
    const falha = classificarFalhaUpload(
      "enviar",
      erroStorage("network error: unauthorized", 403),
    );

    expect(falha.podeTentarDeNovo).toBe(false);
  });
});
