import { fireEvent, render, screen, within } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import type { ProdutoRevenda } from "@/lib/produtos/consultas";

import ListaProdutos from "./ListaProdutos";

function produto(
  nome: string,
  extra: Partial<ProdutoRevenda> = {},
): ProdutoRevenda {
  return {
    id: nome,
    nome,
    marca: null,
    preco: 50,
    ativo: true,
    origem: "catalogo",
    ...extra,
  };
}

const PRODUTOS = [
  produto("Shampoo"),
  produto("Óleo Elixir", { preco: null, origem: "atendimento" }),
  produto("Ampola", { ativo: false }),
  produto("Condicionador", { preco: null }),
];

/** Nomes dos cards, na ordem da tela, fora do bloco de inativos. */
function nomesAtivos() {
  const [lista] = screen.getAllByRole("list");

  return within(lista)
    .getAllByRole("link")
    .map((link) => link.querySelector("p")?.textContent);
}

describe("ListaProdutos", () => {
  it("põe os sem preço no topo dos ativos", () => {
    render(<ListaProdutos produtos={PRODUTOS} />);

    expect(nomesAtivos()).toEqual(["Condicionador", "Óleo Elixir", "Shampoo"]);
  });

  it("marca o criado na conta e leva à edição", () => {
    render(<ListaProdutos produtos={PRODUTOS} />);

    expect(screen.getByText(/criado na conta/)).toBeInTheDocument();
    expect(
      screen.getByText("Óleo Elixir").closest("a")?.getAttribute("href"),
    ).toBe("/produtos/Óleo Elixir/editar");
  });

  it("guarda os inativos num bloco recolhido", () => {
    render(<ListaProdutos produtos={PRODUTOS} />);

    const bloco = screen.getByText("Inativos (1)").closest("details");

    expect(bloco).not.toHaveAttribute("open");
    expect(within(bloco!).getByText("Ampola")).toBeInTheDocument();
  });

  it("busca ignorando acento e caixa", () => {
    render(<ListaProdutos produtos={PRODUTOS} />);

    fireEvent.change(screen.getByLabelText("Buscar produto"), {
      target: { value: "OLEO" },
    });

    expect(nomesAtivos()).toEqual(["Óleo Elixir"]);
    expect(screen.queryByText(/Inativos/)).not.toBeInTheDocument();
  });
});
