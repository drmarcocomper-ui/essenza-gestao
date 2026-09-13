import type { Metadata } from "next";

import LoginForm from "./LoginForm";

export const metadata: Metadata = {
  title: "Entrar — Essenza",
};

/**
 * O erro de login é sempre local ao formulário (não existe mais redirect
 * de volta com `?erro=`), então a página só monta o form.
 */
export default function LoginPage() {
  return <LoginForm />;
}
