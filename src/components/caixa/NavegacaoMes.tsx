import Link from "next/link";
import { ChevronLeft, ChevronRight } from "lucide-react";

import { deslocarMes, rotuloMes } from "@/lib/caixa/mes";

/**
 * Mês anterior e próximo, sem JavaScript: são links que trocam o `mes`
 * da URL. Quem usa diz como montar o link — o Caixa preserva os
 * filtros, o relatório só troca o mês.
 */
export default function NavegacaoMes({
  mes,
  linkDoMes,
}: {
  mes: string;
  linkDoMes: (mes: string) => string;
}) {
  return (
    <nav
      aria-label="Navegação de mês"
      className="flex items-center justify-between gap-2"
    >
      <Seta href={linkDoMes(deslocarMes(mes, -1))} rotulo="Mês anterior">
        <ChevronLeft aria-hidden="true" className="size-6" />
      </Seta>

      <h2 aria-live="polite" className="font-semibold text-neutral-900">
        {rotuloMes(mes)}
      </h2>

      <Seta href={linkDoMes(deslocarMes(mes, 1))} rotulo="Próximo mês">
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
