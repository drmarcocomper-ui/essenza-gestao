"use client";

import { useState } from "react";
import { z } from "zod";

import { createClient } from "@/lib/supabase/client";

type Estado = "idle" | "enviando" | "enviado" | "erro";

const emailSchema = z.email();

/**
 * O signup está desabilitado no Supabase. Com `shouldCreateUser: false`,
 * email não cadastrado volta como `otp_disabled` / "Signups not allowed",
 * que é enganoso para quem só digitou errado.
 */
function mensagemDeErro(codigo: string | undefined, mensagem: string) {
  if (codigo === "otp_disabled" || /signups? not allowed/i.test(mensagem)) {
    return "Email não cadastrado.";
  }

  if (codigo === "over_email_send_rate_limit" || /rate limit/i.test(mensagem)) {
    return "Muitas tentativas. Espere um minuto e tente de novo.";
  }

  return "Não foi possível enviar o link. Tente de novo.";
}

export default function LoginForm({ erroInicial = "" }: { erroInicial?: string }) {
  const [email, setEmail] = useState("");
  const [estado, setEstado] = useState<Estado>(erroInicial ? "erro" : "idle");
  const [erro, setErro] = useState(erroInicial);

  const enviando = estado === "enviando";

  async function enviarLink(evento: React.FormEvent<HTMLFormElement>) {
    evento.preventDefault();

    const emailLimpo = email.trim();

    if (!emailSchema.safeParse(emailLimpo).success) {
      setEstado("erro");
      setErro("Digite um email válido.");
      return;
    }

    setEstado("enviando");
    setErro("");

    const supabase = createClient();
    const { error } = await supabase.auth.signInWithOtp({
      email: emailLimpo,
      options: {
        shouldCreateUser: false,
        emailRedirectTo: `${window.location.origin}/auth/callback`,
      },
    });

    if (error) {
      setEstado("erro");
      setErro(mensagemDeErro(error.code, error.message));
      return;
    }

    setEstado("enviado");
  }

  if (estado === "enviado") {
    return (
      <div className="flex min-h-full flex-1 flex-col justify-center bg-neutral-50 px-6 py-12">
        <div className="mx-auto w-full max-w-sm text-center">
          <h1 className="text-2xl font-semibold tracking-tight text-neutral-900">
            Link enviado
          </h1>
          <p className="mt-3 text-neutral-600">
            Abra o email enviado para <strong>{email.trim()}</strong> e toque no
            link para entrar.
          </p>
          <button
            type="button"
            onClick={() => {
              setEstado("idle");
              setErro("");
            }}
            className="mt-8 min-h-11 w-full rounded-xl border border-neutral-300 px-4 font-medium text-neutral-700 active:bg-neutral-100"
          >
            Usar outro email
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="flex min-h-full flex-1 flex-col justify-center bg-neutral-50 px-6 py-12">
      <div className="mx-auto w-full max-w-sm">
        <h1 className="text-2xl font-semibold tracking-tight text-neutral-900">
          Essenza
        </h1>
        <p className="mt-2 text-neutral-600">
          Entre com seu email. Enviamos um link de acesso.
        </p>

        <form onSubmit={enviarLink} className="mt-8 space-y-4" noValidate>
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
              autoComplete="email"
              autoCapitalize="none"
              autoCorrect="off"
              required
              value={email}
              onChange={(evento) => setEmail(evento.target.value)}
              disabled={enviando}
              aria-invalid={estado === "erro" || undefined}
              aria-describedby={estado === "erro" ? "erro-login" : undefined}
              className="mt-1 block min-h-12 w-full rounded-xl border border-neutral-300 bg-white px-4 text-base text-neutral-900 outline-none focus:border-rose-500 focus:ring-2 focus:ring-rose-200 disabled:opacity-60"
            />
          </div>

          {estado === "erro" && (
            <p id="erro-login" role="alert" className="text-sm text-red-600">
              {erro}
            </p>
          )}

          <button
            type="submit"
            disabled={enviando}
            className="min-h-12 w-full rounded-xl bg-rose-700 px-4 font-semibold text-white active:bg-rose-800 disabled:opacity-60"
          >
            {enviando ? "Enviando…" : "Entrar"}
          </button>
        </form>
      </div>
    </div>
  );
}
