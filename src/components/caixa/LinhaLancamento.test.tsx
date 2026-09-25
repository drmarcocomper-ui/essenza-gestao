import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import type { LancamentoLista } from "@/lib/caixa/consultas";

import LinhaLancamento from "./LinhaLancamento";

const base: LancamentoLista = {
  id: "abc",
  data_competencia: "2026-09-12",
  data_caixa: "2026-09-12",
  data_prevista: null,
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

// Parcela 1/3 de um atendimento de 23/09 no crédito.
const parcela: LancamentoLista = {
  ...base,
  id: "ghi",
  data_competencia: "2026-09-23",
  data_caixa: null,
  data_prevista: "2026-10-23",
  status: "Pendente",
  forma_pagamento: "Cartão de crédito",
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

  it("na Competência, parcela pendente mostra a data da venda, sem selo", () => {
    render(<LinhaLancamento lancamento={parcela} visao="competencia" />);

    expect(screen.getByText("23/09")).toBeInTheDocument();
    expect(screen.getByText("Pendente")).toBeInTheDocument();
    expect(screen.queryByText("Previsto")).not.toBeInTheDocument();
  });

  it("no Caixa, Pago mostra a data de caixa e o status, sem selo", () => {
    render(
      <LinhaLancamento
        lancamento={{ ...base, data_competencia: "2026-09-28", data_caixa: "2026-10-02" }}
        visao="caixa"
      />,
    );

    expect(screen.getByText("02/10")).toBeInTheDocument();
    expect(screen.getByText("Pago")).toBeInTheDocument();
    expect(screen.queryByText("Previsto")).not.toBeInTheDocument();
  });

  it("no Caixa, Pendente com previsão mostra a data prevista e o selo Previsto", () => {
    render(<LinhaLancamento lancamento={parcela} visao="caixa" />);

    expect(screen.getByText("23/10")).toBeInTheDocument();
    expect(screen.getByText("Previsto")).toBeInTheDocument();
    expect(screen.queryByText("Pendente")).not.toBeInTheDocument();
  });

  it("no Caixa, Pendente sem previsão mostra a competência e o selo Pendente", () => {
    render(<LinhaLancamento lancamento={saida} visao="caixa" />);

    expect(screen.getByText("12/09")).toBeInTheDocument();
    // Um selo só: o de status dá lugar ao da visão Caixa.
    expect(screen.getAllByText("Pendente")).toHaveLength(1);
  });

  it("a linha inteira abre a edição", () => {
    render(<LinhaLancamento lancamento={base} />);

    expect(screen.getByRole("link")).toHaveAttribute(
      "href",
      "/caixa/abc/editar",
    );
  });
});
