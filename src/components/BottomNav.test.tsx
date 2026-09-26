import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import BottomNav from "./BottomNav";

const mockUsePathname = vi.fn(() => "/hoje");

vi.mock("next/navigation", () => ({
  usePathname: () => mockUsePathname(),
}));

describe("BottomNav", () => {
  it("mostra os 4 itens com seus destinos", () => {
    render(<BottomNav />);

    const itens = screen.getAllByRole("link");

    expect(itens).toHaveLength(4);
    expect(itens.map((item) => item.textContent)).toEqual([
      "Hoje",
      "Clientes",
      "Caixa",
      "Produtos",
    ]);
    expect(itens.map((item) => item.getAttribute("href"))).toEqual([
      "/hoje",
      "/clientes",
      "/caixa",
      "/produtos",
    ]);
  });

  it("destaca o item da rota atual", () => {
    mockUsePathname.mockReturnValue("/clientes");

    render(<BottomNav />);

    expect(screen.getByRole("link", { current: "page" })).toHaveTextContent(
      "Clientes",
    );
  });

  it("destaca a seção também em rotas filhas", () => {
    mockUsePathname.mockReturnValue("/clientes/123");

    render(<BottomNav />);

    expect(screen.getByRole("link", { current: "page" })).toHaveTextContent(
      "Clientes",
    );
  });
});
