import Link from "next/link";
import { ChevronRight } from "lucide-react";

import type { ResumoMes as Resumo } from "@/lib/caixa/consultas";
import type { ResumoCaixa as Caixa } from "@/lib/caixa/visao";
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

      <LinkPendencias pendentes={pendentes} />
    </section>
  );
}

/**
 * O mês na visão Caixa, pela data em que o dinheiro entra ou sai. Duas
 * faixas para não somar o que já entrou com o que ainda vai entrar:
 * status Pago em cima, Pendente (previsto ou sem previsão) embaixo.
 */
export function ResumoCaixa({
  resumo,
  pendentes,
}: {
  resumo: Caixa;
  pendentes: number;
}) {
  return (
    <section className="rounded-2xl border border-neutral-200 bg-white">
      <Faixa titulo="Recebido e pago">
        <Numero rotulo="Recebido" valor={resumo.recebido} cor="text-emerald-700" />
        <Numero rotulo="Pago" valor={resumo.pago} cor="text-rose-700" />
        <Numero
          rotulo="Saldo"
          valor={resumo.saldo}
          cor={resumo.saldo < 0 ? "text-rose-700" : "text-neutral-900"}
        />
      </Faixa>

      <div className="border-t border-neutral-100 bg-neutral-50/60">
        <Faixa titulo="Previsto e pendente">
          <Numero rotulo="A receber" valor={resumo.aReceber} cor="text-emerald-700" />
          <Numero rotulo="A pagar" valor={resumo.aPagar} cor="text-rose-700" />
          <Numero
            rotulo="Saldo"
            valor={resumo.saldoPrevisto}
            cor={resumo.saldoPrevisto < 0 ? "text-rose-700" : "text-neutral-900"}
          />
        </Faixa>
      </div>

      <LinkPendencias pendentes={pendentes} />
    </section>
  );
}

function Faixa({
  titulo,
  children,
}: {
  titulo: string;
  children: React.ReactNode;
}) {
  return (
    <div className="pt-2.5">
      <h3 className="px-4 text-xs font-medium text-neutral-500">{titulo}</h3>
      <dl
        aria-label={titulo}
        className="grid grid-cols-3 divide-x divide-neutral-100 text-center"
      >
        {children}
      </dl>
    </div>
  );
}

function LinkPendencias({ pendentes }: { pendentes: number }) {
  if (pendentes <= 0) return null;

  return (
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
