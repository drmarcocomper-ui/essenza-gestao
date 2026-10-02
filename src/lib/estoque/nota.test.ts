import { describe, expect, it } from "vitest";

import {
  caminhoNota,
  ehPdf,
  extensaoDoCaminho,
  falhaDaNota,
  LIMITE_PDF_BYTES,
  prepararNota,
} from "./nota";

describe("caminho da nota", () => {
  it("é {compra_id}/nota.<ext>, sem o bucket na frente", () => {
    expect(caminhoNota("abc", "pdf")).toBe("abc/nota.pdf");
    expect(caminhoNota("abc", "jpg")).toBe("abc/nota.jpg");
  });

  it("lê a extensão de volta só dentro da convenção", () => {
    expect(extensaoDoCaminho("abc/nota.pdf")).toBe("pdf");
    expect(extensaoDoCaminho("abc/nota.jpg")).toBe("jpg");
    expect(extensaoDoCaminho("abc/nota.exe")).toBeNull();
    expect(extensaoDoCaminho("nota.pdf")).toBeNull();
  });
});

describe("prepararNota", () => {
  it("PDF sobe como está", async () => {
    const pdf = new File(["%PDF"], "nota.pdf", { type: "application/pdf" });
    const preparada = await prepararNota(pdf);

    expect(preparada).toEqual({
      arquivo: pdf,
      extensao: "pdf",
      contentType: "application/pdf",
    });
  });

  it("PDF acima de 10 MB é recusado com o recado de mandar foto", async () => {
    const grande = new File(["x"], "nota.pdf", { type: "application/pdf" });
    Object.defineProperty(grande, "size", { value: LIMITE_PDF_BYTES + 1 });

    const falha = await prepararNota(grande).catch((erro) => erro);

    expect(falhaDaNota("preparar", falha).texto).toContain("10 MB");
  });

  it("nem PDF nem imagem é recusado", async () => {
    const planilha = new File(["x"], "nota.xlsx", { type: "application/vnd.ms-excel" });
    const falha = await prepararNota(planilha).catch((erro) => erro);

    expect(falhaDaNota("preparar", falha).texto).toBe(
      "Mande uma foto ou um PDF da nota.",
    );
  });

  it("reconhece PDF pela extensão quando o tipo vem vazio", () => {
    expect(ehPdf({ name: "NOTA.PDF", type: "" })).toBe(true);
    expect(ehPdf({ name: "nota.jpg", type: "image/jpeg" })).toBe(false);
  });
});

describe("falhaDaNota", () => {
  it("offline diz que a compra está salva", () => {
    expect(falhaDaNota("enviar", new Error("x"), false).texto).toContain(
      "compra está salva",
    );
  });

  it("permissão é para chamar o Marco", () => {
    expect(
      falhaDaNota("enviar", { message: "new row violates row-level security policy", status: 403 }),
    ).toEqual({
      texto: "Sem permissão para guardar a nota. Avise o Marco.",
      podeTentarDeNovo: false,
    });
  });

  it("HEIC que o navegador não abre ganha o caminho do iPhone", () => {
    const erro = new Error("O navegador não decodifica HEIC.");
    erro.name = "FormatoNaoSuportado";

    expect(falhaDaNota("preparar", erro).texto).toContain("Mais compatível");
  });
});
