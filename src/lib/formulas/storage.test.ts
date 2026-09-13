import { describe, expect, it } from "vitest";

import { BUCKET_FORMULAS, caminhoFoto } from "./storage";

describe("caminhoFoto", () => {
  it("segue a convenção {cliente}/{formula}/{momento}.jpg", () => {
    expect(
      caminhoFoto(
        "11111111-1111-1111-1111-111111111111",
        "22222222-2222-2222-2222-222222222222",
        "antes",
      ),
    ).toBe(
      "11111111-1111-1111-1111-111111111111/22222222-2222-2222-2222-222222222222/antes.jpg",
    );
  });

  it("não repete o nome do bucket dentro do caminho", () => {
    // `from('formulas')` já aponta o bucket; um 'formulas/' aqui criaria
    // uma pasta a mais e quebraria a URL assinada.
    expect(caminhoFoto("c", "f", "antes").startsWith(BUCKET_FORMULAS)).toBe(
      false,
    );
  });

  it("separa antes e depois em arquivos diferentes", () => {
    expect(caminhoFoto("c", "f", "antes")).not.toBe(
      caminhoFoto("c", "f", "depois"),
    );
  });

  it("separa as fórmulas da mesma cliente em pastas diferentes", () => {
    expect(caminhoFoto("c", "f1", "antes")).not.toBe(
      caminhoFoto("c", "f2", "antes"),
    );
  });
});
