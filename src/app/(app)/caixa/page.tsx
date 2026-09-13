import type { Metadata } from "next";
import Link from "next/link";
import { ArrowDownLeft, ArrowUpRight } from "lucide-react";

import FiltrosCaixa from "@/components/caixa/FiltrosCaixa";
import ListaLancamentos from "@/components/caixa/ListaLancamentos";
import NavegacaoMes from "@/components/caixa/NavegacaoMes";
import ResumoMes from "@/components/caixa/ResumoMes";
import {
  contarPendentes,
  listarLancamentos,
  obterResumoMes,
} from "@/lib/caixa/consultas";
import { lerFiltros, statusDoSlug, tipoDoSlug } from "@/lib/caixa/url";

export const metadata: Metadata = {
  title: "Caixa — Essenza",
};

export default async function CaixaPage({ searchParams }: PageProps<"/caixa">) {
  const filtros = lerFiltros(await searchParams);

  // Três consultas independentes: vão juntas, não em fila.
  const [lancamentos, resumo, pendentes] = await Promise.all([
    listarLancamentos({
      mes: filtros.mes,
      tipo: tipoDoSlug(filtros.tipo),
      status: statusDoSlug(filtros.status),
    }),
    obterResumoMes(filtros.mes),
    contarPendentes(),
  ]);

  return (
    // pb-16: a barra de lançar é fixa e não pode cobrir o último item.
    <div className="space-y-4 pb-16">
      <NavegacaoMes filtros={filtros} />

      <ResumoMes resumo={resumo} pendentes={pendentes} />

      <FiltrosCaixa filtros={filtros} />

      <ListaLancamentos
        lancamentos={lancamentos}
        filtrada={filtros.tipo !== "todos" || filtros.status !== "todos"}
      />

      {/* Acima da BottomNav (h-14), na altura do polegar. Entrada primeiro:
          é o lançamento do dia a dia. */}
      <div className="fixed inset-x-0 bottom-[calc(3.5rem+env(safe-area-inset-bottom))] z-30 border-t border-neutral-200 bg-neutral-50/95 backdrop-blur">
        <div className="mx-auto flex max-w-screen-sm gap-3 px-4 py-2.5">
          <Link
            href="/caixa/novo?tipo=entrada"
            className="flex h-12 flex-1 items-center justify-center gap-2 rounded-xl bg-emerald-600 font-medium text-white shadow-sm active:bg-emerald-700"
          >
            <ArrowDownLeft aria-hidden="true" className="size-5" />
            Entrada
          </Link>

          <Link
            href="/caixa/novo?tipo=saida"
            className="flex h-12 flex-1 items-center justify-center gap-2 rounded-xl border border-neutral-300 bg-white font-medium text-neutral-700 active:bg-neutral-100"
          >
            <ArrowUpRight aria-hidden="true" className="size-5" />
            Saída
          </Link>
        </div>
      </div>
    </div>
  );
}
