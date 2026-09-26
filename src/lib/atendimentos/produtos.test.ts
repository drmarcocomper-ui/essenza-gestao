import { describe, expect, it } from "vitest";

import {
  decidirProdutoPorNome,
  novoProdutoDoAtendimento,
  sugerirProdutos,
} from "./produtos";

const revenda = (id: string, nome: string) => ({
  id,
  nome,
  tipo: "revenda",
  ativo: true,
});

const CATALOGO = [
  revenda("1", "Gloss Absolu Glaze drops"),
  revenda("2", "Máscara Reconstrução"),
  revenda("3", "Ultimate Luxe Oil — 100 ml — Wella"),
  { id: "4", nome: "Vitaamino", tipo: "revenda", ativo: false },
  { id: "5", nome: "Oxidante 20 vol", tipo: "oxidante", ativo: true },
];

describe("decidirProdutoPorNome", () => {
  it("nome novo → inserir", () => {
    expect(decidirProdutoPorNome(CATALOGO, "Color Spectrum")).toEqual({
      acao: "inserir",
    });
  });

  it("1 ativo de revenda → reaproveita, ignorando caixa, acento e espaço", () => {
    for (const digitado of [
      "Máscara Reconstrução",
      "mascara reconstrucao",
      "MÁSCARA RECONSTRUÇÃO",
      "  Mascara   Reconstrucao ",
    ]) {
      const decisao = decidirProdutoPorNome(CATALOGO, digitado);

      expect(decisao.acao).toBe("reaproveitar");
      expect(decisao.acao === "reaproveitar" && decisao.produto.id).toBe("2");
    }
  });

  it("1 inativo → recusa, não recadastra", () => {
    expect(decidirProdutoPorNome(CATALOGO, "vitaamino")).toEqual({
      acao: "recusar",
      mensagem: '"Vitaamino" está desativado no catálogo.',
    });
  });

  it("1 ativo de outro tipo → recusa, nunca vira item vendido", () => {
    const decisao = decidirProdutoPorNome(CATALOGO, "oxidante 20 VOL");

    expect(decisao.acao).toBe("recusar");
  });

  it("2 com o mesmo nome e marcas diferentes → recusa", () => {
    const comMarcas = [
      { ...revenda("a", "Máscara"), marca: "Wella" },
      { ...revenda("b", "Mascara"), marca: "Kérastase" },
    ];

    expect(decidirProdutoPorNome(comMarcas, "máscara")).toEqual({
      acao: "recusar",
      mensagem: 'Existe mais de um produto chamado "máscara" — toque no chip certo.',
    });
  });

  it("um ativo e um inativo com o mesmo nome também é ambíguo", () => {
    const dois = [
      revenda("a", "Bain Terrapist"),
      { ...revenda("b", "Bain Terrapist"), ativo: false },
    ];

    expect(decidirProdutoPorNome(dois, "bain terrapist").acao).toBe("recusar");
  });

  it("nome vazio → recusa", () => {
    expect(decidirProdutoPorNome(CATALOGO, "   ").acao).toBe("recusar");
  });
});

describe("novoProdutoDoAtendimento", () => {
  it("nasce de revenda, sem preço (NULL, não 0), sem marca e com origem 'atendimento'", () => {
    expect(novoProdutoDoAtendimento("  Color Spectrum ")).toEqual({
      nome: "Color Spectrum",
      tipo: "revenda",
      unidade: "un",
      marca: null,
      preco_venda: null,
      origem_registro: "atendimento",
    });
  });
});

describe("sugerirProdutos", () => {
  it('"glaze drops" sugere "Gloss Absolu Glaze drops"', () => {
    expect(sugerirProdutos(CATALOGO, "glaze drops").map((p) => p.id)).toEqual([
      "1",
    ]);
  });

  it("sugere quando o nome do catálogo está contido no digitado", () => {
    expect(
      sugerirProdutos(CATALOGO, "Gloss Absolu Glaze Drops 60ml").map(
        (p) => p.id,
      ),
    ).toEqual(["1"]);
  });

  it("no máximo 3 resultados", () => {
    const muitos = ["A", "B", "C", "D", "E"].map((letra) =>
      revenda(letra, `Óleo ${letra}`),
    );

    expect(sugerirProdutos(muitos, "oleo")).toHaveLength(3);
  });

  it("inativo não aparece como sugestão", () => {
    expect(sugerirProdutos(CATALOGO, "vitaa")).toEqual([]);
  });

  it("insumo não aparece como sugestão", () => {
    expect(sugerirProdutos(CATALOGO, "oxidante")).toEqual([]);
  });

  it("nada com menos de 2 letras", () => {
    expect(sugerirProdutos(CATALOGO, "o")).toEqual([]);
  });
});
