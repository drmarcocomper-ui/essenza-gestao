import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { hoje } from "@/lib/caixa/mes";

import ConfirmarRecebimento from "./ConfirmarRecebimento";

const confirmarRecebimento = vi.fn();

vi.mock("@/app/(app)/caixa/actions", () => ({
  confirmarRecebimento: (...args: unknown[]) => confirmarRecebimento(...args),
}));

const ID = "6f3d9a1e-6b5c-4c2a-9f0e-1a2b3c4d5e6f";

function abrir() {
  fireEvent.click(
    screen.getByRole("button", {
      name: "Confirmar recebimento de Coloração + corte",
    }),
  );
}

function campoData() {
  return screen.getByLabelText("Em que dia o dinheiro caiu?");
}

describe("ConfirmarRecebimento", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    confirmarRecebimento.mockResolvedValue({ ok: true });
  });

  it("não grava no primeiro toque: abre o campo de data", () => {
    render(<ConfirmarRecebimento id={ID} descricao="Coloração + corte" />);

    abrir();

    expect(campoData()).toBeInTheDocument();
    expect(confirmarRecebimento).not.toHaveBeenCalled();
  });

  it("abre com hoje, de conveniência, e deixa trocar", async () => {
    render(<ConfirmarRecebimento id={ID} descricao="Coloração + corte" />);

    abrir();
    expect(campoData()).toHaveValue(hoje());

    // A parcela caiu ontem e ela só viu hoje: a data é dela.
    fireEvent.change(campoData(), { target: { value: "2026-09-18" } });
    fireEvent.click(screen.getByRole("button", { name: "Confirmar" }));

    await waitFor(() =>
      expect(confirmarRecebimento).toHaveBeenCalledWith(ID, "2026-09-18"),
    );
  });

  it("fecha o futuro já no seletor do celular", () => {
    render(<ConfirmarRecebimento id={ID} descricao="Coloração + corte" />);

    abrir();

    expect(campoData()).toHaveAttribute("max", hoje());
  });

  it("mostra em português o motivo que a action devolveu", async () => {
    confirmarRecebimento.mockResolvedValue({
      ok: false,
      mensagem: "Este recebimento já foi confirmado.",
    });

    render(<ConfirmarRecebimento id={ID} descricao="Coloração + corte" />);

    abrir();
    fireEvent.click(screen.getByRole("button", { name: "Confirmar" }));

    expect(await screen.findByRole("alert")).toHaveTextContent(
      "Este recebimento já foi confirmado.",
    );
    // O campo continua aberto: ela precisa ver o que aconteceu.
    expect(campoData()).toBeInTheDocument();
  });

  it("cancelar fecha sem gravar nada", () => {
    render(<ConfirmarRecebimento id={ID} descricao="Coloração + corte" />);

    abrir();
    fireEvent.click(screen.getByRole("button", { name: "Cancelar" }));

    expect(
      screen.queryByLabelText("Em que dia o dinheiro caiu?"),
    ).not.toBeInTheDocument();
    expect(confirmarRecebimento).not.toHaveBeenCalled();
  });
});
