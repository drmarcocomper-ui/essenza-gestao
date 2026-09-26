import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import type { PecaExtensao } from "@/lib/pecas-extensao/consultas";

import ListaPecas from "./ListaPecas";

function peca(codigo: string, extra: Partial<PecaExtensao> = {}): PecaExtensao {
  return {
    id: codigo,
    codigo,
    pecaMaeId: null,
    cor: "Castanho",
    textura: "Liso",
    gramas: 100,
    comprimentoCm: 55,
    precoCompra: 300,
    precoVenda: 600,
    origem: null,
    numeroOrigem: null,
    dataEntrada: null,
    observacoes: null,
    ...extra,
  };
}

/** Códigos dos cards, na ordem da tela. */
function codigosNaTela() {
  return screen
    .getAllByRole("link")
    .filter((link) => link.getAttribute("href")?.startsWith("/produtos/"))
    .map((link) => link.querySelector("p")?.textContent);
}

describe("ListaPecas", () => {
  it("ordena pelo código em ordem natural", () => {
    render(
      <ListaPecas
        pecas={[peca("1254-b"), peca("1254"), peca("999"), peca("1254-a")]}
      />,
    );

    expect(codigosNaTela()).toEqual(["999", "1254", "1254-a", "1254-b"]);
  });

  it("mostra — no que não foi informado, e R$ 0,00 no preço zero", () => {
    render(
      <ListaPecas
        pecas={[
          peca("1254", {
            cor: null,
            textura: null,
            gramas: null,
            comprimentoCm: null,
            precoCompra: 0,
            precoVenda: null,
          }),
        ]}
      />,
    );

    const card = screen.getByRole("link");

    expect(card).toHaveTextContent("— · —");
    expect(card).toHaveTextContent("— g · — cm");
    expect(card).toHaveTextContent(/venda\s*—/);
    expect(card).toHaveTextContent(/compra\s*R\$\s*0,00/);
  });

  it("põe a parte logo abaixo da mãe, recuada", () => {
    render(
      <ListaPecas
        pecas={[peca("2000"), peca("1254-a", { pecaMaeId: "1254" }), peca("1254")]}
      />,
    );

    expect(codigosNaTela()).toEqual(["1254", "1254-a", "2000"]);
    expect(
      screen.getByText("1254-a").closest("li")?.getAttribute("style"),
    ).toContain("margin-left");
  });

  it("marca a mãe desmembrada, e só ela, mesmo com as partes fora da busca", () => {
    render(
      <ListaPecas
        pecas={[peca("1254"), peca("parte-x", { pecaMaeId: "1254" }), peca("999")]}
      />,
    );

    expect(screen.getAllByText("Desmembrada")).toHaveLength(1);
    expect(screen.getByText("1254").closest("a")).toHaveTextContent("Desmembrada");

    fireEvent.change(screen.getByLabelText("Buscar peça pelo código"), {
      target: { value: "1254" },
    });

    expect(codigosNaTela()).toEqual(["1254"]);
    expect(screen.getByText("Desmembrada")).toBeInTheDocument();
  });

  it("leva à edição da peça", () => {
    render(<ListaPecas pecas={[peca("1254")]} />);

    expect(screen.getByRole("link")).toHaveAttribute(
      "href",
      "/produtos/extensao/1254",
    );
  });

  it("busca pelo código", () => {
    render(<ListaPecas pecas={[peca("1254"), peca("999")]} />);

    fireEvent.change(screen.getByLabelText("Buscar peça pelo código"), {
      target: { value: "99" },
    });

    expect(codigosNaTela()).toEqual(["999"]);
  });

  it("tabela vazia: sem busca, com o recado", () => {
    render(<ListaPecas pecas={[]} />);

    expect(screen.queryByLabelText("Buscar peça pelo código")).toBeNull();
    expect(screen.getByText("Nenhuma peça cadastrada ainda.")).toBeInTheDocument();
  });

  describe("selo de estado", () => {
    const CONTA = {
      atendimentoId: "at-1",
      clienteId: "cl-1",
      clienteNome: "Maria Souza",
      data: "2026-09-12",
      fechada: false,
    };

    it("disponível e desmembrada, sem link", () => {
      render(
        <ListaPecas pecas={[peca("1254"), peca("1254-a", { pecaMaeId: "1254" })]} />,
      );

      expect(screen.getByText("1254").closest("a")).toHaveTextContent("Desmembrada");
      expect(screen.getByText("1254-a").closest("a")).toHaveTextContent("Disponível");
    });

    it("na conta aberta: cliente, e link para o atendimento", () => {
      render(<ListaPecas pecas={[peca("1254")]} contas={{ "1254": CONTA }} />);

      const selo = screen.getByRole("link", { name: /Na conta aberta · Maria Souza/ });

      expect(selo).toHaveAttribute("href", "/clientes/cl-1/atendimentos/at-1");
      // Fora do link da peça: link dentro de link não existe.
      expect(selo.closest("a")).toBe(selo);
      expect(screen.getByText("1254").closest("a")).not.toHaveTextContent("Disponível");
    });

    it("vendida: cliente e dd/mm, com link para o atendimento", () => {
      render(
        <ListaPecas
          pecas={[peca("1254")]}
          contas={{ "1254": { ...CONTA, fechada: true } }}
        />,
      );

      expect(
        screen.getByRole("link", { name: /Vendida · Maria Souza · 12\/09/ }),
      ).toHaveAttribute("href", "/clientes/cl-1/atendimentos/at-1");
    });
  });
});
