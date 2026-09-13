"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

import { ITENS_NAV } from "@/lib/nav";

/**
 * Navegação fixa no rodapé. Uso de pé, com uma mão: alvo de toque de 44px
 * (h-14 = 56px) e área inteira do item clicável.
 */
export default function BottomNav() {
  const pathname = usePathname();

  return (
    <nav
      aria-label="Navegação principal"
      className="fixed inset-x-0 bottom-0 z-40 border-t border-neutral-200 bg-white pb-[env(safe-area-inset-bottom)]"
    >
      <ul className="mx-auto flex max-w-screen-sm">
        {ITENS_NAV.map(({ href, label, icone: Icone }) => {
          const ativo = pathname === href || pathname.startsWith(`${href}/`);

          return (
            <li key={href} className="flex-1">
              <Link
                href={href}
                aria-current={ativo ? "page" : undefined}
                className={`flex h-14 min-h-11 flex-col items-center justify-center gap-0.5 text-xs font-medium transition-colors ${
                  ativo
                    ? "text-rose-700"
                    : "text-neutral-500 active:text-neutral-900"
                }`}
              >
                <Icone
                  aria-hidden="true"
                  className="size-6"
                  strokeWidth={ativo ? 2.4 : 1.8}
                />
                {label}
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
