import type { Metadata } from "next";
import Link from "next/link";
import { ChevronRight, Download } from "lucide-react";

import NavegacaoMes from "@/components/caixa/NavegacaoMes";
import Voltar from "@/components/layout/Voltar";
import { formatarCentavos } from "@/lib/atendimentos/conta";
import { listarRelatorioMes } from "@/lib/caixa/consultas";
import { mesAtual } from "@/lib/caixa/mes";
import { lerFiltros, linkCaixa } from "@/lib/caixa/url";
import { dataReferenciaCaixa } from "@/lib/caixa/visao";
import { formatarDiaMes } from "@/lib/formatters";
import { GRUPOS_DESPESA } from "@/lib/relatorio/classificar";
import { levantarPendencias, type Pendencia } from "@/lib/relatorio/pendencias";
import {
  centavosDe,
  montarResumo,
  type Grupo,
} from "@/lib/relatorio/resumo";
import { linkCsvRelatorio, linkRelatorio } from "@/lib/relatorio/url";

export const metadata: Metadata = {
  title: "Relatório do mês — Essenza",
};

/**
 * O mês para a contadora: entradas por conta (PJ, PF, dinheiro), saídas
 * por grupo e o que falta conferir. Somente leitura — o mês é o da visão
 * Caixa, pela data em que o dinheiro andou.
 */
export default async function RelatorioPage({
  searchParams,
}: PageProps<"/caixa/relatorio">) {
  // Mesma leitura de `?mes=` do Caixa: inválido ou ausente, mês corrente.
  const { mes } = lerFiltros(await searchParams);

  const lancamentos = await listarRelatorioMes(mes);
  const resumo = montarResumo(lancamentos);
  const pendencias = levantarPendencias(lancamentos, mes, mesAtual());

  return (
    <div className="space-y-4">
      <Voltar
        href={linkCaixa({ mes, tipo: "todos", status: "todos", visao: "caixa" })}
        rotulo="Caixa"
      />

      <h2 className="text-lg font-semibold text-neutral-900">
        Relatório do mês
      </h2>

      <NavegacaoMes mes={mes} linkDoMes={linkRelatorio} />

      {/* <a>, não <Link>: é download de arquivo, não navegação. */}
      <a
        href={linkCsvRelatorio(mes)}
        download
        className="flex h-12 items-center justify-center gap-2 rounded-xl border border-neutral-300 bg-white font-medium text-neutral-700 active:bg-neutral-100"
      >
        <Download aria-hidden="true" className="size-5" />
        Baixar CSV do mês
      </a>

      <Bloco titulo="Entradas recebidas">
        <Linha rotulo="PJ SumUp" grupo={resumo.entradas["PJ SumUp"]} />
        <Linha rotulo="PJ Nubank" grupo={resumo.entradas["PJ Nubank"]} />
        <Linha rotulo="Total PJ" grupo={resumo.totalPJ} total />
        <Linha rotulo="PF Nubank" grupo={resumo.entradas["PF Nubank"]} />
        <Linha rotulo="PF PicPay" grupo={resumo.entradas["PF PicPay"]} />
        <Linha rotulo="Total PF" grupo={resumo.totalPF} total />
        <Linha rotulo="Dinheiro" grupo={resumo.entradas.Dinheiro} total />
        <Linha rotulo="Sem PF/PJ" grupo={resumo.entradas["Sem PF/PJ"]} total />
      </Bloco>

      <Bloco titulo="Saídas">
        {GRUPOS_DESPESA.map((grupo) => (
          <Linha key={grupo} rotulo={grupo} grupo={resumo.despesas[grupo]} />
        ))}
        <Linha rotulo="Total de despesas" grupo={resumo.totalDespesas} total />
      </Bloco>

      <Bloco titulo="Retirada (participação nos lucros)">
        <Linha rotulo="Retirada" grupo={resumo.retirada} total />
        <p className="px-4 pb-3 text-sm text-neutral-500">
          Não entra nas despesas.
        </p>
      </Bloco>

      <Bloco titulo="Previsto a receber">
        <Linha
          rotulo={
            resumo.previsto.linhas.length === 1
              ? "1 parcela"
              : `${resumo.previsto.linhas.length} parcelas`
          }
          grupo={resumo.previsto}
          total
        />
        <p className="px-4 pb-3 text-sm text-neutral-500">
          Ainda não caiu. Não soma em nenhum total.
        </p>
      </Bloco>

      <Bloco titulo="Pendências do mês">
        {pendencias.length === 0 ? (
          <p className="px-4 py-3 text-neutral-600">
            Nada a conferir neste mês.
          </p>
        ) : (
          <ul className="divide-y divide-neutral-100">
            {pendencias.map((pendencia, indice) => (
              <ItemPendencia key={indice} pendencia={pendencia} />
            ))}
          </ul>
        )}
      </Bloco>
    </div>
  );
}

/** Zero é traço: "R$ 0,00" numa lista para a contadora parece valor. */
function valor(centavos: number) {
  return centavos === 0 ? "—" : formatarCentavos(centavos);
}

function Bloco({
  titulo,
  children,
}: {
  titulo: string;
  children: React.ReactNode;
}) {
  return (
    <section className="overflow-hidden rounded-2xl border border-neutral-200 bg-white">
      <h3 className="border-b border-neutral-100 px-4 py-2.5 text-sm font-semibold text-neutral-700">
        {titulo}
      </h3>
      <div className="divide-y divide-neutral-100">{children}</div>
    </section>
  );
}

/**
 * Um total. Se não é zero, abre a lista das linhas que o compõem —
 * details/summary do navegador, sem JavaScript.
 */
function Linha({
  rotulo,
  grupo,
  total = false,
}: {
  rotulo: string;
  grupo: Grupo;
  total?: boolean;
}) {
  const peso = total ? "font-semibold text-neutral-900" : "text-neutral-700";
  const nome = <span className={peso}>{rotulo}</span>;
  const numero = (
    <span className={`tabular-nums ${peso}`}>{valor(grupo.centavos)}</span>
  );

  if (grupo.centavos === 0) {
    return (
      <div className="flex min-h-11 items-center justify-between gap-3 px-4 py-2">
        {nome}
        {numero}
      </div>
    );
  }

  return (
    <details className="group">
      <summary className="flex min-h-11 cursor-pointer list-none items-center justify-between gap-3 px-4 py-2 active:bg-neutral-50 [&::-webkit-details-marker]:hidden">
        <span className="flex items-center gap-1">
          <ChevronRight
            aria-hidden="true"
            className="size-4 shrink-0 text-neutral-400 transition-transform group-open:rotate-90"
          />
          {nome}
        </span>
        {numero}
      </summary>

      <ul className="space-y-1 bg-neutral-50 px-4 py-2 text-sm">
        {grupo.linhas.map((linha) => (
          <li key={linha.id} className="flex items-baseline justify-between gap-3">
            <span className="min-w-0 text-neutral-600">
              <span className="tabular-nums">
                {formatarDiaMes(dataReferenciaCaixa(linha))}
              </span>{" "}
              {linha.descricao}
              {linha.cliente && (
                <span className="text-neutral-500"> · {linha.cliente.nome}</span>
              )}
              {linha.parcelamento && (
                <span className="text-neutral-500"> · {linha.parcelamento}</span>
              )}
            </span>
            <span className="shrink-0 tabular-nums text-neutral-700">
              {formatarCentavos(centavosDe(linha))}
            </span>
          </li>
        ))}
      </ul>
    </details>
  );
}

function ItemPendencia({ pendencia }: { pendencia: Pendencia }) {
  const corpo = (
    <div className="flex items-baseline justify-between gap-3">
      <span className="min-w-0">
        <span className="block text-sm font-medium text-amber-800">
          {pendencia.motivo}
        </span>
        {pendencia.descricao && (
          <span className="block text-sm text-neutral-600">
            {pendencia.data && (
              <span className="tabular-nums">
                {formatarDiaMes(pendencia.data)}{" "}
              </span>
            )}
            {pendencia.descricao}
          </span>
        )}
      </span>
      {pendencia.centavos !== null && (
        <span className="shrink-0 text-sm tabular-nums text-neutral-700">
          {valor(pendencia.centavos)}
        </span>
      )}
    </div>
  );

  // Com lançamento por trás, o item leva à edição — é lá que se corrige.
  if (!pendencia.id) {
    return <li className="px-4 py-3">{corpo}</li>;
  }

  return (
    <li>
      <Link
        href={`/caixa/${pendencia.id}/editar`}
        className="block min-h-11 px-4 py-3 active:bg-neutral-50"
      >
        {corpo}
      </Link>
    </li>
  );
}
