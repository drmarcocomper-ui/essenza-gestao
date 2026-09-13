import Link from "next/link";
import { ChevronRight } from "lucide-react";

import type { ResumoMes as Resumo } from "@/lib/caixa/consultas";
import { formatarMoeda } from "@/lib/formatters";

/**
 * O fechamento do mês em regime de competência, como vem da
 * `vw_resumo_competencia`: o que foi faturado, pago ou não.
 */
export default function ResumoMes({
  resumo,
  pendentes,
}: {
  resumo: Resumo;
  pendentes: number;
}) {
  const negativo = resumo.resultado < 0;

  return (
    <section className="rounded-2xl border border-neutral-200 bg-white">
      <dl className="grid grid-cols-3 divide-x divide-neutral-100 text-center">
        <Numero rotulo="Entradas" valor={resumo.entradas} cor="text-emerald-700" />
        <Numero rotulo="Saídas" valor={resumo.saidas} cor="text-rose-700" />
        <Numero
          rotulo="Resultado"
          valor={resumo.resultado}
          cor={negativo ? "text-rose-700" : "text-neutral-900"}
        />
      </dl>

      {pendentes > 0 && (
        <Link
          href="/caixa/pendentes"
          className="flex min-h-12 items-center justify-between gap-2 border-t border-neutral-100 px-4 py-2.5 text-sm font-medium text-amber-800 active:bg-amber-50"
        >
          <span>
            {pendentes === 1
              ? "1 pendência a receber"
              : `${pendentes} pendências a receber`}
          </span>
          <ChevronRight aria-hidden="true" className="size-5 shrink-0" />
        </Link>
      )}
    </section>
  );
}

function Numero({
  rotulo,
  valor,
  cor,
}: {
  rotulo: string;
  valor: number;
  cor: string;
}) {
  return (
    <div className="px-1 py-3">
      <dt className="text-xs text-neutral-500">{rotulo}</dt>
      {/* break-all: R$ 100.000,00 não pode estourar a coluna no celular. */}
      <dd className={`mt-1 text-sm font-semibold break-all tabular-nums ${cor}`}>
        {formatarMoeda(valor)}
      </dd>
    </div>
  );
}
