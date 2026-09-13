import type { Metadata } from "next";

import LoginForm from "./LoginForm";

export const metadata: Metadata = {
  title: "Entrar — Essenza",
};

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ erro?: string }>;
}) {
  const { erro } = await searchParams;

  return (
    <LoginForm
      erroInicial={
        erro === "link_invalido"
          ? "Esse link expirou ou já foi usado. Peça um novo."
          : ""
      }
    />
  );
}
