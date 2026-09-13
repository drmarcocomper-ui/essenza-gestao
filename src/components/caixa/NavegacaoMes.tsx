import Link from "next/link";
import { ChevronLeft, ChevronRight } from "lucide-react";

import { deslocarMes, rotuloMes } from "@/lib/caixa/mes";
import { linkCaixa, type FiltrosCaixa } from "@/lib/caixa/url";

/**
 * Mês anterior e próximo, sem JavaScript: são links que trocam o `mes`
 * da URL e preservam os filtros.
 */
export default function NavegacaoMes({ filtros }: { filtros: FiltrosCaixa }) {
  return (
    <nav
      aria-label="Navegação de mês"
      className="flex items-center justify-between gap-2"
    >
      <Seta
        href={linkCaixa({ ...filtros, mes: deslocarMes(filtros.mes, -1) })}
        rotulo="Mês anterior"
      >
        <ChevronLeft aria-hidden="true" className="size-6" />
      </Seta>

      <h2 aria-live="polite" className="font-semibold text-neutral-900">
        {rotuloMes(filtros.mes)}
      </h2>

      <Seta
        href={linkCaixa({ ...filtros, mes: deslocarMes(filtros.mes, 1) })}
        rotulo="Próximo mês"
      >
        <ChevronRight aria-hidden="true" className="size-6" />
      </Seta>
    </nav>
  );
}

function Seta({
  href,
  rotulo,
  children,
}: {
  href: string;
  rotulo: string;
  children: React.ReactNode;
}) {
  return (
    <Link
      href={href}
      aria-label={rotulo}
      scroll={false}
      className="flex size-11 shrink-0 items-center justify-center rounded-xl border border-neutral-300 bg-white text-neutral-600 active:bg-neutral-100"
    >
      {children}
    </Link>
  );
}
