import { fireEvent, render, screen, within } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import type { PecaVendavel } from "@/lib/pecas-extensao/consultas";

import FecharConta, { type LinhaItem } from "./FecharConta";

function peca(codigo: string, extra: Partial<PecaVendavel> = {}): PecaVendavel {
  return {
    id: `id-${codigo}`,
    codigo,
    cor: "Castanho",
    textura: "Liso",
    gramas: 100,
    comprimentoCm: 55,
    precoVenda: 1200,
    ...extra,
  };
}

function montar(pecas: PecaVendavel[], itensIniciais: LinhaItem[] = []) {
  return render(
    <FecharConta
      acao={vi.fn(async () => ({}))}
      servicos={[]}
      produtos={[]}
      todosProdutos={[]}
      itensIniciais={itensIniciais}
      pecas={pecas}
    />,
  );
}

/** Os campos escondidos que viajam no POST. */
function escondidos(container: HTMLElement, nome: string) {
  return [...container.querySelectorAll<HTMLInputElement>(`input[name="${nome}"]`)].map(
    (campo) => campo.value,
  );
}

describe("FecharConta — bloco Peças de extensão", () => {
  it("sem peça vendável, o bloco não aparece", () => {
    montar([]);

    expect(screen.queryByText("Peças de extensão")).toBeNull();
  });

  it("cada opção mostra código · cor · gramas · comprimento", () => {
    montar([peca("1254", { comprimentoCm: null })]);

    expect(screen.getByRole("button", { name: /1254/ })).toHaveTextContent(
      "1254· Castanho · 100 g · — cm",
    );
  });

  it("busca pelo código com trim + lower, contém", () => {
    montar([peca("1254-B"), peca("999")]);

    fireEvent.change(screen.getByLabelText("Buscar peça pelo código"), {
      target: { value: " 54-b " },
    });

    expect(screen.getByRole("button", { name: /1254-B/ })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /^999/ })).toBeNull();
  });

  it("escolher entra com quantidade 1 fixa, o preço de venda e a descrição", () => {
    const { container } = montar([peca("1254")]);

    fireEvent.click(screen.getByRole("button", { name: /1254/ }));

    expect(screen.getByText("Extensão 1254")).toBeInTheDocument();
    expect(screen.getByLabelText("Valor de Extensão 1254")).toHaveValue("1.200,00");
    // Sem mais e menos.
    expect(screen.queryByLabelText("Mais um Extensão 1254")).toBeNull();

    expect(escondidos(container, "item_tipo")).toEqual(["peca_extensao"]);
    expect(escondidos(container, "item_ref")).toEqual(["id-1254"]);
    expect(escondidos(container, "item_quantidade")).toEqual(["1"]);
  });

  it("peça sem preço de venda entra com o valor vazio", () => {
    montar([peca("1254", { precoVenda: null })]);

    fireEvent.click(screen.getByRole("button", { name: /1254/ }));

    expect(screen.getByLabelText("Valor de Extensão 1254")).toHaveValue("");
  });

  it("a mesma peça não entra duas vezes: o segundo toque tira", () => {
    const { container } = montar([peca("1254")]);
    const opcao = screen.getByRole("button", { name: /1254/ });

    fireEvent.click(opcao);
    expect(opcao).toHaveAttribute("aria-pressed", "true");

    fireEvent.click(opcao);
    expect(escondidos(container, "item_tipo")).toEqual([]);
  });

  it("conta reaberta: a peça que já estava vem escolhida, com o valor gravado", () => {
    const { container } = montar(
      [peca("1254")],
      [
        {
          tipo: "peca_extensao",
          refId: "id-1254",
          nome: "Extensão 1254",
          quantidade: 1,
          valor: "950,00",
          detalhe: "Castanho · 100 g · 55 cm",
        },
      ],
    );

    expect(screen.getByRole("button", { name: /^1254/ })).toHaveAttribute(
      "aria-pressed",
      "true",
    );
    expect(screen.getByLabelText("Valor de Extensão 1254")).toHaveValue("950,00");
    expect(escondidos(container, "item_ref")).toEqual(["id-1254"]);

    const itens = screen.getByRole("heading", { name: /Itens/ }).parentElement!;

    expect(within(itens).getByText("Castanho · 100 g · 55 cm")).toBeInTheDocument();
  });
});
