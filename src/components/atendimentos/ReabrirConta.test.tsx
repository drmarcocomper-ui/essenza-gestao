import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import ReabrirConta from "./ReabrirConta";

const refresh = vi.fn();

vi.mock("next/navigation", () => ({ useRouter: () => ({ refresh }) }));

describe("ReabrirConta", () => {
  it("o primeiro toque só mostra o que vai ser apagado", () => {
    const acao = vi.fn().mockResolvedValue({});

    render(<ReabrirConta acao={acao} resumo={{ lancamentos: 3, confirmadas: 2 }} />);

    fireEvent.click(screen.getByRole("button", { name: "Reabrir conta" }));

    expect(acao).not.toHaveBeenCalled();
    expect(screen.getByText(/apaga 3 lançamentos do Caixa/)).toBeInTheDocument();
    expect(
      screen.getByText(/2 parcelas já confirmadas como recebidas/),
    ).toBeInTheDocument();
  });

  it("sem parcela confirmada, não fala em confirmar de novo", () => {
    render(
      <ReabrirConta acao={vi.fn()} resumo={{ lancamentos: 1, confirmadas: 0 }} />,
    );

    fireEvent.click(screen.getByRole("button", { name: "Reabrir conta" }));

    expect(screen.getByText(/apaga 1 lançamento do Caixa/)).toBeInTheDocument();
    expect(screen.queryByText(/confirmad/)).toBeNull();
  });

  it("o segundo toque reabre e recarrega a tela", async () => {
    const acao = vi.fn().mockResolvedValue({});

    render(<ReabrirConta acao={acao} resumo={{ lancamentos: 1, confirmadas: 0 }} />);

    fireEvent.click(screen.getByRole("button", { name: "Reabrir conta" }));
    fireEvent.click(screen.getByRole("button", { name: "Reabrir" }));

    await waitFor(() => expect(refresh).toHaveBeenCalled());
    expect(acao).toHaveBeenCalledTimes(1);
  });

  it("recusa aparece em português", async () => {
    const acao = vi.fn().mockResolvedValue({ erro: "Esta conta já está aberta." });

    render(<ReabrirConta acao={acao} resumo={{ lancamentos: 1, confirmadas: 0 }} />);

    fireEvent.click(screen.getByRole("button", { name: "Reabrir conta" }));
    fireEvent.click(screen.getByRole("button", { name: "Reabrir" }));

    expect(await screen.findByRole("alert")).toHaveTextContent(
      "Esta conta já está aberta.",
    );
  });
});
