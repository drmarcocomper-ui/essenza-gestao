import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import LoginForm from "./LoginForm";

const signInWithPassword = vi.fn();
const replace = vi.fn();
const refresh = vi.fn();

vi.mock("next/navigation", () => ({
  useRouter: () => ({ replace, refresh }),
}));

vi.mock("@/lib/supabase/client", () => ({
  createClient: () => ({ auth: { signInWithPassword } }),
}));

function preencher(email: string, senha: string) {
  fireEvent.change(screen.getByLabelText("Email"), {
    target: { value: email },
  });
  fireEvent.change(screen.getByLabelText("Senha"), {
    target: { value: senha },
  });
}

function entrar() {
  fireEvent.click(screen.getByRole("button", { name: "Entrar" }));
}

describe("LoginForm", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    signInWithPassword.mockResolvedValue({ error: null });
  });

  it("entra com email e senha e vai para /hoje", async () => {
    render(<LoginForm />);

    preencher("  kamylle@essenza.com  ", "senha-secreta");
    entrar();

    await waitFor(() => expect(replace).toHaveBeenCalledWith("/hoje"));

    expect(signInWithPassword).toHaveBeenCalledWith({
      email: "kamylle@essenza.com",
      password: "senha-secreta",
    });
    expect(refresh).toHaveBeenCalled();
  });

  it("não diferencia email inexistente de senha errada", async () => {
    signInWithPassword.mockResolvedValue({
      error: { code: "invalid_credentials", message: "Invalid login credentials" },
    });

    render(<LoginForm />);

    preencher("kamylle@essenza.com", "senha-errada");
    entrar();

    expect(await screen.findByRole("alert")).toHaveTextContent(
      "Email ou senha incorretos.",
    );
    expect(replace).not.toHaveBeenCalled();
  });

  it("não chama o Supabase com email inválido", async () => {
    render(<LoginForm />);

    preencher("kamylle", "senha-secreta");
    entrar();

    expect(await screen.findByRole("alert")).toHaveTextContent(
      "Digite um email válido.",
    );
    expect(signInWithPassword).not.toHaveBeenCalled();
  });

  it("mostra e oculta a senha", () => {
    render(<LoginForm />);

    const senha = screen.getByLabelText("Senha");

    expect(senha).toHaveAttribute("type", "password");

    fireEvent.click(screen.getByRole("button", { name: "Mostrar senha" }));
    expect(senha).toHaveAttribute("type", "text");

    fireEvent.click(screen.getByRole("button", { name: "Ocultar senha" }));
    expect(senha).toHaveAttribute("type", "password");
  });

  it("usa o autocomplete que o gerenciador de senhas do celular espera", () => {
    render(<LoginForm />);

    expect(screen.getByLabelText("Email")).toHaveAttribute(
      "autocomplete",
      "username",
    );
    expect(screen.getByLabelText("Senha")).toHaveAttribute(
      "autocomplete",
      "current-password",
    );
  });
});
