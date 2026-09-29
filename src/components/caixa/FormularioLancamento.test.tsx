import { fireEvent, render, screen, within } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import type { Lancamento } from "@/lib/caixa/consultas";
import { MENSAGEM_CAMPO_TRAVADO_CONTA } from "@/lib/caixa/travas";

import FormularioLancamento from "./FormularioLancamento";

vi.mock("next/link", () => ({
  default: ({ href, children, ...resto }: { href: string; children: React.ReactNode }) => (
    <a href={href} {...resto}>
      {children}
    </a>
  ),
}));
vi.mock("@/app/(app)/caixa/actions", () => ({ buscarClientes: vi.fn() }));

const CLIENTE = "44444444-4444-4444-8444-444444444444";

const linha = (atendimento_id: string | null): Lancamento => ({
  id: "33333333-3333-4333-8333-333333333333",
  data_competencia: "2026-09-23",
  data_caixa: null,
  tipo: "Entrada",
  categoria: "Coloração",
  descricao: "Coloração",
  cliente_id: CLIENTE,
  atendimento_id,
  data_prevista: "2026-12-22",
  fornecedor: null,
  forma_pagamento: "Cartão de crédito",
  instituicao: "SumUp",
  titularidade: "PJ",
  parcelamento: "3/3",
  valor: 209.98,
  status: "Pendente",
  observacoes: null,
  origem_registro: "app",
  cliente: { id: CLIENTE, nome: "Ana" },
});

function abrir(lancamento: Lancamento) {
  return render(
    <FormularioLancamento
      acao={async () => ({})}
      lancamento={lancamento}
      tipoInicial={lancamento.tipo}
      categorias={[{ id: "1", tipo: "Entrada", nome: "Coloração" }]}
      instituicoes={[]}
      rotuloEnviar="Salvar"
      cancelarHref="/caixa"
    />,
  );
}

describe("FormularioLancamento: entrada de conta", () => {
  it("valor, tipo, cliente, competência e parcela ficam só leitura", () => {
    const { container } = abrir(linha("55555555-5555-4555-8555-555555555555"));

    expect(screen.getByLabelText(/Valor/)).toHaveAttribute("readonly");
    expect(screen.getByRole("button", { name: "Entrada" })).toBeDisabled();
    expect(screen.getByRole("button", { name: "Saída" })).toBeDisabled();
    expect(screen.queryByRole("button", { name: "Trocar" })).toBeNull();
    expect(screen.getByLabelText(/Data de competência/)).toBeDisabled();
    expect(screen.getByLabelText("Parcelamento")).toBeDisabled();

    // O gravado segue no FormData para a action conferir.
    const form = container.querySelector("form")!;
    const dados = new FormData(form);
    expect(dados.get("valor")).toBe("209,98");
    expect(dados.get("parcelamento")).toBe("3/3");
    expect(dados.get("cliente_id")).toBe(CLIENTE);

    expect(screen.getAllByText(MENSAGEM_CAMPO_TRAVADO_CONTA).length).toBeGreaterThan(0);
  });

  it("o resto continua editável", () => {
    abrir(linha("55555555-5555-4555-8555-555555555555"));

    expect(screen.getByLabelText("Instituição")).toBeEnabled();
    expect(screen.getByLabelText("Titularidade")).toBeEnabled();
    expect(screen.getByLabelText("Forma de pagamento")).toBeEnabled();
    expect(screen.getByLabelText(/Descrição/)).toBeEnabled();
    expect(screen.getByRole("button", { name: "Pago" })).toBeEnabled();
  });
});

describe("FormularioLancamento: lançamento manual", () => {
  it("nada é travado, como antes", () => {
    abrir(linha(null));

    expect(screen.getByLabelText(/Valor/)).not.toHaveAttribute("readonly");
    expect(screen.getByRole("button", { name: "Saída" })).toBeEnabled();
    expect(screen.getByRole("button", { name: "Trocar" })).toBeInTheDocument();
    expect(screen.getByLabelText(/Data de competência/)).toBeEnabled();
    expect(screen.getByLabelText("Parcelamento")).toBeEnabled();
    expect(screen.getByText("Cortesia? Deixe 0,00.")).toBeInTheDocument();
    expect(screen.queryByText(MENSAGEM_CAMPO_TRAVADO_CONTA)).toBeNull();
  });
});

describe("FormularioLancamento: titularidade do PicPay", () => {
  it("PicPay antigo abre sem o campo de titularidade", () => {
    const { container } = abrir({
      ...linha(null),
      instituicao: "PicPay",
      titularidade: "PJ",
    });

    expect(screen.queryByLabelText("Titularidade")).toBeNull();
    // Nada de PJ no POST: a action grava PF.
    expect(new FormData(container.querySelector("form")!).get("titularidade")).toBeNull();
  });

  it("digitar PicPay esconde o campo, trocar de volta mostra", () => {
    abrir(linha(null));

    const instituicao = screen.getByLabelText("Instituição");

    fireEvent.change(instituicao, { target: { value: "picpay " } });
    expect(screen.queryByLabelText("Titularidade")).toBeNull();

    fireEvent.change(instituicao, { target: { value: "Nubank" } });
    expect(screen.getByLabelText("Titularidade")).toBeEnabled();
  });

  it("SumUp segue com o campo, como antes", () => {
    abrir(linha(null));

    expect(screen.getByLabelText("Titularidade")).toHaveValue("PJ");
  });
});

describe("FormularioLancamento: titularidade do Nubank", () => {
  function novo() {
    return render(
      <FormularioLancamento
        acao={async () => ({})}
        tipoInicial="Entrada"
        categorias={[{ id: "1", tipo: "Entrada", nome: "Coloração" }]}
        instituicoes={["Nubank", "PicPay", "SumUp"]}
        rotuloEnviar="Lançar"
        cancelarHref="/caixa"
      />,
    );
  }

  it("novo: escolher Nubank mostra o campo PF/PJ", () => {
    novo();

    fireEvent.change(screen.getByLabelText("Instituição"), {
      target: { value: "Nubank" },
    });

    const campo = screen.getByLabelText("Titularidade");
    expect(campo).toBeEnabled();
    expect(within(campo).getByRole("option", { name: "PF" })).toBeInTheDocument();
    expect(within(campo).getByRole("option", { name: "PJ" })).toBeInTheDocument();
  });

  it("novo: escolher PicPay esconde o campo", () => {
    novo();

    fireEvent.change(screen.getByLabelText("Instituição"), {
      target: { value: "PicPay" },
    });

    expect(screen.queryByLabelText("Titularidade")).toBeNull();
  });

  it("editar: Nubank PJ abre com o campo e PJ marcado", () => {
    abrir({ ...linha(null), instituicao: "Nubank", titularidade: "PJ" });

    expect(screen.getByLabelText("Titularidade")).toHaveValue("PJ");
  });

  it("editar: Nubank PJ de conta de atendimento abre com PJ marcado", () => {
    abrir({
      ...linha("55555555-5555-4555-8555-555555555555"),
      instituicao: "Nubank",
      titularidade: "PJ",
    });

    expect(screen.getByLabelText("Titularidade")).toHaveValue("PJ");
  });
});
