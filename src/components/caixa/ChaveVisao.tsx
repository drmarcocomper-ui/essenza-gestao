import Link from "next/link";

import { linkCaixa, type FiltrosCaixa } from "@/lib/caixa/url";
import type { VisaoCaixa } from "@/lib/caixa/visao";

const VISOES: { visao: VisaoCaixa; rotulo: string }[] = [
  { visao: "caixa", rotulo: "Caixa" },
  { visao: "competencia", rotulo: "Competência" },
];

/**
 * Caixa (quando o dinheiro entra ou sai) ou Competência (quando vendeu).
 * Como os filtros, é link: troca a `visao` da URL e mantém o resto.
 */
export default function ChaveVisao({ filtros }: { filtros: FiltrosCaixa }) {
  return (
    <div
      role="group"
      aria-label="Visão do caixa"
      className="flex gap-1 rounded-xl bg-neutral-200/70 p-1"
    >
      {VISOES.map(({ visao, rotulo }) => {
        const ativo = filtros.visao === visao;

        return (
          <Link
            key={visao}
            href={linkCaixa({ ...filtros, visao })}
            aria-current={ativo ? "true" : undefined}
            scroll={false}
            className={`flex min-h-11 flex-1 items-center justify-center rounded-lg text-sm font-medium ${
              ativo
                ? "bg-white text-neutral-900 shadow-sm"
                : "text-neutral-600 active:bg-neutral-100"
            }`}
          >
            {rotulo}
          </Link>
        );
      })}
    </div>
  );
}
