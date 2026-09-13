import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import CardCliente from "./CardCliente";

const base = {
  id: "abc",
  nome: "Jéssica Conceição",
  telefone: "27999998888",
  ativo: true,
  ultimoAtendimento: "2026-03-14",
};

describe("CardCliente", () => {
  it("mostra nome, telefone com máscara e último atendimento", () => {
    render(<CardCliente cliente={base} />);

    expect(screen.getByText("Jéssica Conceição")).toBeInTheDocument();
    expect(screen.getByText("(27) 99999-8888")).toBeInTheDocument();
    expect(
      screen.getByText("Último atendimento em 14/03/2026"),
    ).toBeInTheDocument();
  });

  it("leva para o perfil", () => {
    render(<CardCliente cliente={base} />);

    expect(screen.getByRole("link")).toHaveAttribute("href", "/clientes/abc");
  });

  it("não mostra valores", () => {
    render(<CardCliente cliente={base} />);

    expect(screen.queryByText(/R\$/)).not.toBeInTheDocument();
  });

  it("avisa quando não há atendimento nem telefone", () => {
    render(
      <CardCliente
        cliente={{ ...base, telefone: null, ultimoAtendimento: null }}
      />,
    );

    expect(screen.getByText("Sem telefone")).toBeInTheDocument();
    expect(screen.getByText("Sem atendimento registrado")).toBeInTheDocument();
  });

  it("marca cliente inativa", () => {
    render(<CardCliente cliente={{ ...base, ativo: false }} />);

    expect(screen.getByText("Inativa")).toBeInTheDocument();
  });
});
