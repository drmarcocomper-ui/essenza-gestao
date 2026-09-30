import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import Voltar from "./Voltar";

describe("Voltar", () => {
  it("é um link para o destino fixo, com o destino no rótulo", () => {
    render(<Voltar href="/clientes" rotulo="Clientes" />);

    const link = screen.getByRole("link", { name: "Voltar para Clientes" });

    expect(link).toHaveAttribute("href", "/clientes");
    expect(link).toHaveTextContent("Clientes");
  });

  it("leva a query do destino junto", () => {
    render(
      <Voltar href="/caixa?mes=2026-09&visao=competencia" rotulo="Caixa" />,
    );

    expect(screen.getByRole("link")).toHaveAttribute(
      "href",
      "/caixa?mes=2026-09&visao=competencia",
    );
  });

  it("tem área de toque de pelo menos 44px", () => {
    render(<Voltar href="/produtos" rotulo="Produtos" />);

    expect(screen.getByRole("link").className).toMatch(/\bmin-h-11\b/);
  });
});
