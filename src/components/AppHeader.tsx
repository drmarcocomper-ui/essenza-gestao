"use client";

import { usePathname } from "next/navigation";

import { itemAtivo } from "@/lib/nav";

/** Header fixo com o título da seção atual. */
export default function AppHeader() {
  const pathname = usePathname();
  const titulo = itemAtivo(pathname)?.label ?? "Essenza";

  return (
    <header className="sticky top-0 z-40 border-b border-neutral-200 bg-white/95 backdrop-blur">
      <div className="mx-auto flex h-14 max-w-screen-sm items-center px-4">
        <h1 className="text-lg font-semibold tracking-tight text-neutral-900">
          {titulo}
        </h1>
      </div>
    </header>
  );
}
