"use client";

import { usePathname } from "next/navigation";

import { itemAtivo } from "@/lib/nav";

/**
 * Header fixo com o título da seção atual. É ele que encosta no topo da
 * tela, então é ele que respeita o safe-area do iPhone: o Voltar das
 * páginas vem logo abaixo e nunca fica sob o relógio. Com a barra de
 * status "default" o inset é 0 — o padding só entra se isso mudar.
 */
export default function AppHeader() {
  const pathname = usePathname();
  const titulo = itemAtivo(pathname)?.label ?? "Essenza";

  return (
    <header className="sticky top-0 z-40 border-b border-neutral-200 bg-white/95 pt-[env(safe-area-inset-top)] backdrop-blur">
      <div className="mx-auto flex h-14 max-w-screen-sm items-center px-4">
        <h1 className="text-lg font-semibold tracking-tight text-neutral-900">
          {titulo}
        </h1>
      </div>
    </header>
  );
}
