import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import type { PecaExtensao } from "@/lib/pecas-extensao/consultas";
import { MENSAGEM_CODIGO_REPETIDO_PARTES } from "@/lib/pecas-extensao/regras";

import FormularioDesmembrar from "./FormularioDesmembrar";

const { desmembrarPeca, push } = vi.hoisted(() => ({
  desmembrarPeca: vi.fn(),
  push: vi.fn(),
}));

vi.mock("@/app/(app)/produtos/extensao/actions", () => ({
  desmembrarPeca: (...args: unknown[]) => desmembrarPeca(...args),
}));
vi.mock("next/navigation", () => ({ useRouter: () => ({ push }) }));

const MAE: PecaExtensao = {
  id: "mae",
  codigo: "1254",
  pecaMaeId: null,
  cor: "Castanho",
  textura: "Liso",
  gramas: 100,
  comprimentoCm: 55,
  precoCompra: 100,
  precoVenda: 600,
  origem: "Sul do Brasil",
  numeroOrigem: "A-0091",
  dataEntrada: "2026-09-01",
  observacoes: "Lacre rompido",
};

function montar() {
  render(
    <FormularioDesmembrar
      mae={MAE}
      custoMae={100}
      cores={[]}
      texturas={[]}
      origens={[]}
    />,
  );
}

function campos(rotulo: string) {
  return screen.getAllByLabelText(new RegExp(`^${rotulo}`)) as HTMLInputElement[];
}

function digitar(rotulo: string, indice: number, valor: string) {
  fireEvent.change(campos(rotulo)[indice], { target: { value: valor } });
}

function botaoConfirmar() {
  return screen.getByRole("button", { name: /^Desmembrar em/ });
}

describe("FormularioDesmembrar", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    desmembrarPeca.mockResolvedValue({});
  });

  it("começa com 2 partes, códigos sugeridos e dados da mãe copiados", () => {
    montar();

    expect(campos("Código").map((c) => c.value)).toEqual(["1254-a", "1254-b"]);
    expect(campos("Cor").map((c) => c.value)).toEqual(["Castanho", "Castanho"]);
    expect(campos("Origem")[0].value).toBe("Sul do Brasil");
    expect(campos("Nº de origem")[0].value).toBe("A-0091");
    expect(campos("Data de entrada")[0].value).toBe("2026-09-01");

    // Da parte, não da mãe: nascem vazios.
    expect(campos("Gramas")[0].value).toBe("");
    expect(campos("Preço de compra")[0].value).toBe("");
    expect(campos("Preço de venda")[0].value).toBe("");
    expect(campos("Observações")[0].value).toBe("");
  });

  it("muda a quantidade entre 2 e 10, sugerindo o código das novas", () => {
    montar();

    const menos = screen.getByRole("button", { name: "Uma parte a menos" });
    const mais = screen.getByRole("button", { name: "Uma parte a mais" });

    expect(menos).toBeDisabled();

    digitar("Código", 1, "1254-x");
    fireEvent.click(mais);

    expect(campos("Código").map((c) => c.value)).toEqual([
      "1254-a",
      "1254-x",
      "1254-c",
    ]);

    for (let i = 0; i < 10; i++) fireEvent.click(mais);

    expect(campos("Código")).toHaveLength(10);
    expect(campos("Código")[9].value).toBe("1254-j");
    expect(mais).toBeDisabled();
  });

  it("só libera o botão quando a soma dos custos fecha", () => {
    montar();

    expect(botaoConfirmar()).toBeDisabled();

    digitar("Preço de compra", 0, "6000");
    expect(screen.getByText(/faltam R\$\s40,00/)).toBeInTheDocument();
    expect(botaoConfirmar()).toBeDisabled();

    digitar("Preço de compra", 1, "5000");
    expect(screen.getByText(/sobram R\$\s10,00/)).toBeInTheDocument();
    expect(botaoConfirmar()).toBeDisabled();

    digitar("Preço de compra", 1, "4000");
    expect(screen.getByText("fecha")).toBeInTheDocument();
    expect(botaoConfirmar()).toBeEnabled();
  });

  it("soma as gramas só para informar", () => {
    montar();

    digitar("Gramas", 0, "60");
    digitar("Gramas", 1, "30,5");

    expect(screen.getByText(/Gramas: 90,5 g de 100 g/)).toBeInTheDocument();
  });

  it("avisa código repetido entre as partes", () => {
    montar();

    digitar("Código", 1, " 1254-A ");

    expect(screen.getByText(MENSAGEM_CODIGO_REPETIDO_PARTES)).toBeInTheDocument();
  });

  it("envia as partes e volta para a lista", async () => {
    montar();

    digitar("Preço de compra", 0, "6000");
    digitar("Preço de compra", 1, "4000");
    fireEvent.click(botaoConfirmar());

    await waitFor(() => expect(push).toHaveBeenCalledWith("/produtos"));

    const [maeId, partes] = desmembrarPeca.mock.calls[0];

    expect(maeId).toBe("mae");
    expect(partes).toHaveLength(2);
    expect(partes[0]).toMatchObject({ codigo: "1254-a", preco_compra: "60,00" });
  });

  it("mostra o recado do servidor e não sai da tela", async () => {
    desmembrarPeca.mockResolvedValue({ mensagem: "Já existe a peça 1254-a." });
    montar();

    digitar("Preço de compra", 0, "6000");
    digitar("Preço de compra", 1, "4000");
    fireEvent.click(botaoConfirmar());

    expect(await screen.findByRole("alert")).toHaveTextContent(
      "Já existe a peça 1254-a.",
    );
    expect(push).not.toHaveBeenCalled();
  });
});
