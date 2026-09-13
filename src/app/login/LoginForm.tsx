"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Eye, EyeOff } from "lucide-react";
import { z } from "zod";

import { createClient } from "@/lib/supabase/client";

type Estado = "idle" | "entrando" | "erro";

const emailSchema = z.email();

/** Erro de credencial é esperado: vira mensagem própria e não vai ao console. */
function ehCredencialInvalida(codigo: string | undefined, mensagem: string) {
  return (
    codigo === "invalid_credentials" ||
    /invalid login credentials/i.test(mensagem)
  );
}

/**
 * Credencial errada nunca diz *o que* errou: email inexistente e senha
 * errada voltam a mesma mensagem, que é o que o Supabase faz em
 * `invalid_credentials`.
 *
 * O resto — chave inválida, projeto fora do ar, CORS — cai na mensagem
 * genérica de propósito: a tela não é lugar de detalhe interno. O detalhe
 * vai para o console em `registrarErro`.
 */
function mensagemDeErro(codigo: string | undefined, mensagem: string) {
  if (ehCredencialInvalida(codigo, mensagem)) {
    return "Email ou senha incorretos.";
  }

  if (codigo === "over_request_rate_limit" || /rate limit/i.test(mensagem)) {
    return "Muitas tentativas. Espere um minuto e tente de novo.";
  }

  return "Não foi possível entrar. Tente de novo.";
}

/**
 * Um erro de chave do Supabase já passou despercebido aqui, escondido
 * atrás da mensagem genérica. Em desenvolvimento o erro real vai para o
 * console; em produção fica de fora, para não expor configuração a quem
 * abrir o DevTools no celular.
 */
function registrarErro(erro: { code?: string; message: string }) {
  if (process.env.NODE_ENV === "production") return;

  if (ehCredencialInvalida(erro.code, erro.message)) return;

  console.error("Falha no login:", erro);
}

export default function LoginForm() {
  const router = useRouter();

  const [email, setEmail] = useState("");
  const [senha, setSenha] = useState("");
  const [mostrarSenha, setMostrarSenha] = useState(false);
  const [estado, setEstado] = useState<Estado>("idle");
  const [erro, setErro] = useState("");

  // Segue desabilitado depois do sucesso: a navegação para /hoje ainda
  // está em curso e um segundo toque dispararia outro login.
  const entrando = estado === "entrando";

  async function entrar(evento: React.FormEvent<HTMLFormElement>) {
    evento.preventDefault();

    const emailLimpo = email.trim();

    if (!emailSchema.safeParse(emailLimpo).success) {
      setEstado("erro");
      setErro("Digite um email válido.");
      return;
    }

    if (!senha) {
      setEstado("erro");
      setErro("Digite sua senha.");
      return;
    }

    setEstado("entrando");
    setErro("");

    const supabase = createClient();
    const { error } = await supabase.auth.signInWithPassword({
      email: emailLimpo,
      password: senha,
    });

    if (error) {
      registrarErro(error);
      setEstado("erro");
      setErro(mensagemDeErro(error.code, error.message));
      return;
    }

    router.replace("/hoje");
    // Limpa o cache do Router Server para /hoje renderizar já com a sessão.
    router.refresh();
  }

  const temErro = estado === "erro";

  return (
    <div className="flex min-h-full flex-1 flex-col justify-center bg-neutral-50 px-6 py-12">
      <div className="mx-auto w-full max-w-sm">
        <h1 className="text-2xl font-semibold tracking-tight text-neutral-900">
          Essenza
        </h1>
        <p className="mt-2 text-neutral-600">Entre com seu email e senha.</p>

        <form onSubmit={entrar} className="mt-8 space-y-4" noValidate>
          <div>
            <label
              htmlFor="email"
              className="block text-sm font-medium text-neutral-700"
            >
              Email
            </label>
            <input
              id="email"
              name="email"
              type="email"
              inputMode="email"
              // "username" (e não "email") para o gerenciador de senhas do
              // celular preencher o par email + senha de uma vez.
              autoComplete="username"
              autoCapitalize="none"
              autoCorrect="off"
              required
              value={email}
              onChange={(evento) => setEmail(evento.target.value)}
              disabled={entrando}
              aria-invalid={temErro || undefined}
              aria-describedby={temErro ? "erro-login" : undefined}
              className="mt-1 block min-h-12 w-full rounded-xl border border-neutral-300 bg-white px-4 text-base text-neutral-900 outline-none focus:border-rose-500 focus:ring-2 focus:ring-rose-200 disabled:opacity-60"
            />
          </div>

          <div>
            <label
              htmlFor="senha"
              className="block text-sm font-medium text-neutral-700"
            >
              Senha
            </label>
            <div className="relative mt-1">
              <input
                id="senha"
                name="senha"
                type={mostrarSenha ? "text" : "password"}
                autoComplete="current-password"
                autoCapitalize="none"
                autoCorrect="off"
                required
                value={senha}
                onChange={(evento) => setSenha(evento.target.value)}
                disabled={entrando}
                aria-invalid={temErro || undefined}
                aria-describedby={temErro ? "erro-login" : undefined}
                // pr-14 reserva o espaço do botão de mostrar/ocultar.
                className="block min-h-12 w-full rounded-xl border border-neutral-300 bg-white py-0 pr-14 pl-4 text-base text-neutral-900 outline-none focus:border-rose-500 focus:ring-2 focus:ring-rose-200 disabled:opacity-60"
              />
              <button
                type="button"
                onClick={() => setMostrarSenha((valor) => !valor)}
                disabled={entrando}
                aria-label={mostrarSenha ? "Ocultar senha" : "Mostrar senha"}
                aria-pressed={mostrarSenha}
                className="absolute inset-y-0 right-0 flex w-14 items-center justify-center rounded-r-xl text-neutral-500 active:text-neutral-900 disabled:opacity-60"
              >
                {mostrarSenha ? (
                  <EyeOff aria-hidden="true" className="size-5" />
                ) : (
                  <Eye aria-hidden="true" className="size-5" />
                )}
              </button>
            </div>
          </div>

          {temErro && (
            <p id="erro-login" role="alert" className="text-sm text-red-600">
              {erro}
            </p>
          )}

          <button
            type="submit"
            disabled={entrando}
            className="min-h-12 w-full rounded-xl bg-rose-700 px-4 font-semibold text-white active:bg-rose-800 disabled:opacity-60"
          >
            {entrando ? "Entrando…" : "Entrar"}
          </button>
        </form>
      </div>
    </div>
  );
}
