import { fireEvent, render, screen } from "@testing-library/react";
import { act } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import BuscaClientes from "./BuscaClientes";

const replace = vi.fn();

vi.mock("next/navigation", () => ({
  useRouter: () => ({ replace }),
  usePathname: () => "/clientes",
}));

/** Avança o relógio e deixa o React processar a transição pendente. */
async function avancar(ms: number) {
  await act(async () => {
    vi.advanceTimersByTime(ms);
  });
}

describe("BuscaClientes", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    replace.mockClear();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("só consulta depois que a usuária para de digitar", async () => {
    render(<BuscaClientes termo="" incluirInativos={false} />);

    const campo = screen.getByLabelText("Buscar por nome ou telefone");

    fireEvent.change(campo, { target: { value: "jes" } });
    fireEvent.change(campo, { target: { value: "jess" } });

    await avancar(200);
    expect(replace).not.toHaveBeenCalled();

    await avancar(200);
    expect(replace).toHaveBeenCalledTimes(1);
    expect(replace).toHaveBeenCalledWith("/clientes?q=jess", { scroll: false });
  });

  it("mantém o que foi digitado no campo", async () => {
    render(<BuscaClientes termo="" incluirInativos={false} />);

    const campo = screen.getByLabelText("Buscar por nome ou telefone");
    fireEvent.change(campo, { target: { value: "Jéssica" } });

    expect(campo).toHaveValue("Jéssica");
  });

  it("limpa a busca e volta para a lista inteira", async () => {
    render(<BuscaClientes termo="jess" incluirInativos={false} />);

    fireEvent.click(screen.getByLabelText("Limpar busca"));
    await act(async () => {});

    expect(replace).toHaveBeenCalledWith("/clientes", { scroll: false });
  });

  it("não navega quando a URL já reflete o termo", async () => {
    render(<BuscaClientes termo="jess" incluirInativos={false} />);

    await avancar(600);

    expect(replace).not.toHaveBeenCalled();
  });

  it("alterna a exibição das inativas sem esperar debounce", async () => {
    render(<BuscaClientes termo="jess" incluirInativos={false} />);

    fireEvent.click(screen.getByLabelText("Mostrar inativas"));
    await act(async () => {});

    expect(replace).toHaveBeenCalledWith("/clientes?q=jess&inativas=1", {
      scroll: false,
    });
  });
});
