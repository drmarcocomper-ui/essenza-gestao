import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import type { LancamentoLista } from "@/lib/caixa/consultas";

import LinhaLancamento from "./LinhaLancamento";

const base: LancamentoLista = {
  id: "abc",
  data_competencia: "2026-09-12",
  data_caixa: "2026-09-12",
  tipo: "Entrada",
  categoria: "Coloração",
  descricao: "Coloração + corte",
  valor: 180,
  status: "Pago",
  forma_pagamento: "Pix",
  fornecedor: null,
  cliente: { id: "cli-1", nome: "Jéssica Conceição" },
};

const saida: LancamentoLista = {
  ...base,
  id: "def",
  tipo: "Saída",
  categoria: "Custo Variável",
  descricao: "Boleto WELLA",
  valor: 420,
  status: "Pendente",
  forma_pagamento: "Boleto",
  data_caixa: null,
  cliente: null,
  fornecedor: "WELLA",
};

describe("LinhaLancamento", () => {
  it("mostra dia, descrição, cliente, valor e badges", () => {
    render(<LinhaLancamento lancamento={base} />);

    expect(screen.getByText("12/09")).toBeInTheDocument();
    expect(screen.getByText("Coloração + corte")).toBeInTheDocument();
    expect(screen.getByText("Jéssica Conceição")).toBeInTheDocument();
    expect(screen.getByText(/180,00/)).toBeInTheDocument();
    expect(screen.getByText("Coloração")).toBeInTheDocument();
    expect(screen.getByText("Pago")).toBeInTheDocument();
    expect(screen.getByText("Pix")).toBeInTheDocument();
  });

  it("mostra o fornecedor no lugar da cliente quando é saída", () => {
    render(<LinhaLancamento lancamento={saida} />);

    expect(screen.getByText("WELLA")).toBeInTheDocument();
    expect(screen.getByText("Pendente")).toBeInTheDocument();
  });

  it("distingue entrada de saída pelo sinal, não só pela cor", () => {
    const sinal = (container: HTMLElement) =>
      container.querySelector('span[aria-hidden="true"]');

    const recebido = render(<LinhaLancamento lancamento={base} />);

    expect(sinal(recebido.container)).toHaveTextContent("+");
    recebido.unmount();

    const gasto = render(<LinhaLancamento lancamento={saida} />);

    expect(sinal(gasto.container)).toHaveTextContent("−");
  });

  it("diz o tipo para quem não vê a cor", () => {
    render(<LinhaLancamento lancamento={base} />);

    expect(screen.getByText("Entrada de")).toBeInTheDocument();
  });

  it("a linha inteira abre a edição", () => {
    render(<LinhaLancamento lancamento={base} />);

    expect(screen.getByRole("link")).toHaveAttribute(
      "href",
      "/caixa/abc/editar",
    );
  });
});
