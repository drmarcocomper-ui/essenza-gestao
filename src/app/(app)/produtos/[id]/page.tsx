import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ClipboardList, Pencil } from "lucide-react";

import Voltar from "@/components/layout/Voltar";
import SaldoEstoque, {
  formatarUnidades,
} from "@/components/produtos/SaldoEstoque";
import { lerMovimentosDoProduto } from "@/lib/estoque/consultas";
import {
  montarHistorico,
  ultimoCustoPago,
  type EventoHistorico,
} from "@/lib/estoque/historico";
import { calcularSaldo } from "@/lib/estoque/saldo";
import { formatarData, formatarMoeda } from "@/lib/formatters";
import { obterProduto } from "@/lib/produtos/consultas";

export const metadata: Metadata = {
  title: "Estoque do produto — Essenza",
};

/**
 * O frasco de revenda no estoque: saldo, "Contar estoque", último custo
 * pago e o histórico que explica o número.
 */
export default async function ProdutoPage({
  params,
}: PageProps<"/produtos/[id]">) {
  const { id } = await params;

  // Só revenda: insumo de coloração não tem estoque de frasco.
  const produto = await obterProduto(id);

  if (!produto) {
    notFound();
  }

  const movimentos = await lerMovimentosDoProduto(produto.id);
  const saldo = calcularSaldo(
    movimentos.contagens,
    movimentos.entradas,
    movimentos.saidas,
  );
  const historico = montarHistorico(movimentos);
  const ultimoCusto = ultimoCustoPago(movimentos.entradas);

  return (
    <div className="space-y-5">
      <Voltar href="/produtos" rotulo="Produtos" />

      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <h2 className="text-lg font-semibold text-neutral-900">
            {produto.nome}
          </h2>
          <p className="mt-0.5 text-sm text-neutral-500">
            {produto.marca ?? "Sem marca"}
            {!produto.ativo && " · Inativo"}
          </p>
        </div>

        <Link
          href={`/produtos/${produto.id}/editar`}
          aria-label="Editar produto"
          className="-mr-2 flex size-11 shrink-0 items-center justify-center rounded-xl text-neutral-500 active:bg-neutral-100"
        >
          <Pencil aria-hidden="true" className="size-5" />
        </Link>
      </div>

      <section className="space-y-4 rounded-2xl border border-neutral-200 bg-white p-4">
        <div className="flex items-center justify-between gap-3">
          <div>
            <p className="text-sm font-medium text-neutral-500">
              Saldo em estoque
            </p>
            {saldo.situacao === "contado" && (
              <p className="mt-0.5 text-xs text-neutral-500">
                Contado em {formatarData(saldo.contagem.data)}:{" "}
                {formatarUnidades(saldo.contagem.quantidade)}
              </p>
            )}
          </div>

          <SaldoEstoque saldo={saldo} grande />
        </div>

        <p className="text-sm text-neutral-600">
          Último custo pago:{" "}
          <span className="font-medium tabular-nums text-neutral-900">
            {ultimoCusto === null ? "nenhuma compra" : formatarMoeda(ultimoCusto)}
          </span>
        </p>

        {produto.ativo ? (
          <Link
            href={`/produtos/${produto.id}/contar`}
            className="flex h-12 w-full items-center justify-center gap-2 rounded-xl bg-rose-600 font-medium text-white active:bg-rose-700"
          >
            <ClipboardList aria-hidden="true" className="size-5" />
            Contar estoque
          </Link>
        ) : (
          <p className="text-sm text-neutral-500">
            Produto inativo: não entra no estoque.
          </p>
        )}
      </section>

      <section aria-labelledby="historico" className="space-y-3">
        <h3 id="historico" className="text-sm font-medium text-neutral-500">
          Histórico
        </h3>

        {historico.length === 0 ? (
          <p className="rounded-2xl border border-dashed border-neutral-300 px-4 py-6 text-center text-sm text-neutral-500">
            Nenhuma contagem, compra ou venda ainda.
          </p>
        ) : (
          <ul className="divide-y divide-neutral-100 overflow-hidden rounded-2xl border border-neutral-200 bg-white">
            {historico.map((evento, indice) => (
              <li key={`${evento.tipo}-${indice}`}>
                <LinhaHistorico evento={evento} />
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}

const classeLinha = "flex min-h-14 items-center gap-3 px-4 py-2.5";

function Detalhe({ texto, fora }: { texto: string; fora: string | null }) {
  return (
    <p className="truncate text-xs text-neutral-500">
      {texto}
      {fora && <span className="text-amber-700"> · {fora}</span>}
    </p>
  );
}

function LinhaHistorico({ evento }: { evento: EventoHistorico }) {
  if (evento.tipo === "contagem") {
    return (
      <div className={classeLinha}>
        <div className="min-w-0 flex-1">
          <p className="text-sm font-medium text-neutral-900">
            Contagem · {formatarData(evento.data)}
          </p>
          <Detalhe
            texto={
              [evento.vigente && "Vale para o saldo", evento.observacao]
                .filter(Boolean)
                .join(" · ") || "Contagem anterior"
            }
            fora={null}
          />
        </div>
        <span className="shrink-0 font-medium tabular-nums text-neutral-900">
          {formatarUnidades(evento.quantidade)}
        </span>
      </div>
    );
  }

  if (evento.tipo === "compra") {
    return (
      <div className={classeLinha}>
        <div className="min-w-0 flex-1">
          <p className="text-sm font-medium text-neutral-900">
            Compra · {formatarData(evento.data)}
          </p>
          <Detalhe
            texto={`${evento.fornecedor} · ${formatarMoeda(evento.custoUnitario)} cada`}
            fora={evento.foraDoSaldo}
          />
        </div>
        <span className="shrink-0 font-medium tabular-nums text-emerald-700">
          +{formatarUnidades(evento.quantidade)}
        </span>
      </div>
    );
  }

  return (
    <Link
      href={`/clientes/${evento.clienteId}/atendimentos/${evento.atendimentoId}`}
      className={`${classeLinha} active:bg-neutral-100`}
    >
      <div className="min-w-0 flex-1">
        <p className="text-sm font-medium text-neutral-900">
          Venda · {formatarData(evento.data)}
        </p>
        <Detalhe texto={evento.clienteNome} fora={evento.foraDoSaldo} />
      </div>
      <span className="shrink-0 font-medium tabular-nums text-neutral-700">
        −{formatarUnidades(evento.quantidade)}
      </span>
    </Link>
  );
}
