import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import {
  CalendarPlus,
  MessageCircle,
  Pencil,
  Phone,
  Plus,
  RotateCcw,
} from "lucide-react";

import ListaAtendimentos from "@/components/atendimentos/ListaAtendimentos";
import BotaoAtivo from "@/components/clientes/BotaoAtivo";
import HistoricoCliente from "@/components/clientes/HistoricoCliente";
import ListaFormulas from "@/components/formulas/ListaFormulas";
import { listarAtendimentos } from "@/lib/atendimentos/consultas";
import { obterCliente, obterHistorico } from "@/lib/clientes/consultas";
import { resolveClienteDesde } from "@/lib/clientes/desde";
import {
  formatarData,
  formatarMoeda,
  formatarTelefone,
  linkWhatsApp,
} from "@/lib/formatters";
import { listarFormulas } from "@/lib/formulas/consultas";

export async function generateMetadata({
  params,
}: PageProps<"/clientes/[id]">): Promise<Metadata> {
  const { id } = await params;
  const cliente = await obterCliente(id);

  return { title: `${cliente?.nome ?? "Cliente"} — Essenza` };
}

export default async function ClientePage({
  params,
}: PageProps<"/clientes/[id]">) {
  const { id } = await params;

  const cliente = await obterCliente(id);

  if (!cliente) {
    notFound();
  }

  // Três consultas independentes: em paralelo, não em fila.
  const [historico, formulas, atendimentos] = await Promise.all([
    obterHistorico(cliente.id),
    listarFormulas(cliente.id),
    listarAtendimentos(cliente.id),
  ]);

  // A lista já vem da mais recente para a mais antiga: repetir é sempre
  // a primeira, sem consulta a mais.
  const ultimaFormula = formulas[0] ?? null;

  const whatsapp = linkWhatsApp(cliente.telefone);
  const clienteDesde = resolveClienteDesde(
    cliente.data_cadastro,
    historico.primeiroAtendimento,
  );

  return (
    <div className="space-y-6">
      <section className="rounded-2xl border border-neutral-200 bg-white p-4">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <h2 className="text-xl font-semibold text-neutral-900">
              {cliente.nome}
            </h2>
            {!cliente.ativo && (
              <span className="mt-1 inline-block rounded-full bg-neutral-100 px-2 py-0.5 text-xs font-medium text-neutral-500">
                Inativa
              </span>
            )}
          </div>

          <Link
            href={`/clientes/${cliente.id}/editar`}
            aria-label="Editar cadastro"
            className="flex size-11 shrink-0 items-center justify-center rounded-xl border border-neutral-300 text-neutral-600 active:bg-neutral-100"
          >
            <Pencil aria-hidden="true" className="size-5" />
          </Link>
        </div>

        {cliente.telefone && (
          <div className="mt-4 flex gap-2">
            <a
              href={`tel:${cliente.telefone}`}
              className="inline-flex h-12 flex-1 items-center justify-center gap-2 rounded-xl border border-neutral-300 font-medium text-neutral-700 active:bg-neutral-100"
            >
              <Phone aria-hidden="true" className="size-5" />
              {formatarTelefone(cliente.telefone)}
            </a>

            {whatsapp && (
              <a
                href={whatsapp}
                target="_blank"
                rel="noopener noreferrer"
                aria-label="Conversar no WhatsApp"
                className="inline-flex size-12 shrink-0 items-center justify-center rounded-xl bg-emerald-600 text-white active:bg-emerald-700"
              >
                <MessageCircle aria-hidden="true" className="size-5" />
              </a>
            )}
          </div>
        )}

        <dl className="mt-4 space-y-2 border-t border-neutral-100 pt-4 text-sm">
          <Dado rotulo="E-mail" valor={cliente.email} />
          <Dado
            rotulo="Nascimento"
            valor={formatarData(cliente.data_nascimento)}
          />
          <Dado rotulo="Bairro" valor={cliente.bairro} />
          <Dado rotulo="Município" valor={cliente.municipio} />
          <Dado rotulo="Profissão" valor={cliente.profissao} />
          <Dado rotulo="Preferências" valor={cliente.preferencias} />
          <Dado rotulo="Como conheceu" valor={cliente.origem} />
          <Dado rotulo="Observações" valor={cliente.observacoes} />
        </dl>
      </section>

      {/* Da cliente até a fórmula nova em um toque — é daqui que ela sai
          para trabalhar, com o celular na mão e a cliente na cadeira. */}
      <section className="space-y-3">
        <div className="grid grid-cols-2 gap-3">
          <Link
            href={`/clientes/${cliente.id}/formulas/nova`}
            className={`flex h-14 items-center justify-center gap-2 rounded-xl bg-rose-600 font-medium text-white active:bg-rose-700 ${
              ultimaFormula ? "" : "col-span-2"
            }`}
          >
            <Plus aria-hidden="true" className="size-5" />
            Nova fórmula
          </Link>

          {ultimaFormula && (
            <Link
              href={`/clientes/${cliente.id}/formulas/nova?repetir=${ultimaFormula.id}`}
              className="flex h-14 items-center justify-center gap-2 rounded-xl border border-rose-600 bg-white font-medium text-rose-700 active:bg-rose-50"
            >
              <RotateCcw aria-hidden="true" className="size-5" />
              Repetir última
            </Link>
          )}
        </div>

        <Link
          href={`/clientes/${cliente.id}/atendimentos/novo`}
          className="flex h-12 w-full items-center justify-center gap-2 rounded-xl border border-neutral-300 bg-white font-medium text-neutral-700 active:bg-neutral-100"
        >
          <CalendarPlus aria-hidden="true" className="size-5" />
          Novo atendimento
        </Link>
      </section>

      <section className="grid grid-cols-2 gap-3">
        {/* Sem "Cliente desde", "Total gasto" ocupa a linha toda em vez de
            deixar meia tela vazia. */}
        <div
          className={`rounded-2xl border border-neutral-200 bg-white p-4 ${
            clienteDesde ? "" : "col-span-2"
          }`}
        >
          <p className="text-xs text-neutral-500">Total gasto</p>
          <p className="mt-1 text-lg font-semibold text-neutral-900 tabular-nums">
            {formatarMoeda(historico.total)}
          </p>
        </div>

        {clienteDesde && (
          <div className="rounded-2xl border border-neutral-200 bg-white p-4">
            <p className="text-xs text-neutral-500">Cliente desde</p>
            <p className="mt-1 text-lg font-semibold text-neutral-900 tabular-nums">
              {formatarData(clienteDesde)}
            </p>
          </div>
        )}
      </section>

      <section className="space-y-3">
        <h3 className="text-sm font-medium text-neutral-500">
          Fórmulas ({formulas.length})
        </h3>

        <ListaFormulas clienteId={cliente.id} formulas={formulas} />
      </section>

      <section className="space-y-3">
        <h3 className="text-sm font-medium text-neutral-500">
          Atendimentos ({atendimentos.length})
        </h3>

        <ListaAtendimentos
          clienteId={cliente.id}
          atendimentos={atendimentos}
        />
      </section>

      <section className="space-y-3">
        <h3 className="text-sm font-medium text-neutral-500">
          Histórico financeiro ({historico.lancamentos.length})
        </h3>

        <HistoricoCliente lancamentos={historico.lancamentos} />
      </section>

      <BotaoAtivo id={cliente.id} ativo={cliente.ativo} />
    </div>
  );
}

/** Linha da ficha. Campo vazio não vira linha em branco: some. */
function Dado({
  rotulo,
  valor,
}: {
  rotulo: string;
  valor: string | null | undefined;
}) {
  if (!valor) return null;

  return (
    <div className="flex gap-3">
      <dt className="w-28 shrink-0 text-neutral-500">{rotulo}</dt>
      <dd className="min-w-0 flex-1 break-words whitespace-pre-line text-neutral-900">
        {valor}
      </dd>
    </div>
  );
}
