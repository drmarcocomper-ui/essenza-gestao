import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Pencil } from "lucide-react";

import Voltar from "@/components/layout/Voltar";
import BotaoExcluirCompra from "@/components/produtos/BotaoExcluirCompra";
import NotaCompra, { type NotaNaTela } from "@/components/produtos/NotaCompra";
import { formatarUnidades } from "@/components/produtos/SaldoEstoque";
import { exigirSessao } from "@/lib/auth";
import { obterCompra } from "@/lib/estoque/consultas";
import {
  BUCKET_NOTAS,
  extensaoDoCaminho,
  SEGUNDOS_URL_NOTA,
} from "@/lib/estoque/nota";
import { totalDaCompra } from "@/lib/estoque/regras";
import { formatarData, formatarMoeda } from "@/lib/formatters";

export const metadata: Metadata = {
  title: "Compra — Essenza",
};

/**
 * A nota é exibida só por URL assinada de validade curta, gerada aqui no
 * servidor — nunca getPublicUrl. Null quando o arquivo sumiu do bucket.
 */
async function nota(caminho: string | null): Promise<NotaNaTela | null> {
  if (!caminho) return null;

  const extensao = extensaoDoCaminho(caminho);

  if (!extensao) return null;

  const { supabase } = await exigirSessao();
  const { data } = await supabase.storage
    .from(BUCKET_NOTAS)
    .createSignedUrl(caminho, SEGUNDOS_URL_NOTA);

  return { extensao, url: data?.signedUrl ?? null };
}

export default async function CompraPage({
  params,
  searchParams,
}: PageProps<"/produtos/compras/[id]">) {
  const { id } = await params;
  const { nota: avisoNota } = await searchParams;

  const compra = await obterCompra(id);

  if (!compra) {
    notFound();
  }

  const notaNaTela = await nota(compra.notaPath);
  const total = totalDaCompra(compra.itens);

  return (
    <div className="space-y-5">
      <Voltar href="/produtos/compras" rotulo="Compras" />

      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <h2 className="text-lg font-semibold text-neutral-900">
            {compra.fornecedor}
          </h2>
          <p className="mt-0.5 text-sm text-neutral-500">
            Compra de {formatarData(compra.data)}
          </p>
        </div>

        <Link
          href={`/produtos/compras/${compra.id}/editar`}
          aria-label="Editar compra"
          className="-mr-2 flex size-11 shrink-0 items-center justify-center rounded-xl text-neutral-500 active:bg-neutral-100"
        >
          <Pencil aria-hidden="true" className="size-5" />
        </Link>
      </div>

      <ul className="divide-y divide-neutral-100 overflow-hidden rounded-2xl border border-neutral-200 bg-white">
        {compra.itens.map((item) => (
          <li key={item.id}>
            <Link
              href={`/produtos/${item.produtoId}`}
              className="flex min-h-14 items-center gap-3 px-4 py-2.5 active:bg-neutral-100"
            >
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-medium text-neutral-900">
                  {item.produtoNome}
                </p>
                <p className="text-xs text-neutral-500">
                  {formatarUnidades(item.quantidade)} ×{" "}
                  {formatarMoeda(item.custoUnitario)}
                  {!item.produtoAtivo && " · inativo"}
                </p>
              </div>
              <span className="shrink-0 text-sm font-medium tabular-nums text-neutral-900">
                {formatarMoeda(totalDaCompra([item]))}
              </span>
            </Link>
          </li>
        ))}

        <li className="flex min-h-12 items-center justify-between px-4 py-2.5">
          <span className="text-sm font-medium text-neutral-600">Total</span>
          <span className="font-semibold tabular-nums text-neutral-900">
            {formatarMoeda(total)}
          </span>
        </li>
      </ul>

      {compra.observacoes && (
        <p className="whitespace-pre-line rounded-2xl border border-neutral-200 bg-white px-4 py-3 text-sm text-neutral-700">
          {compra.observacoes}
        </p>
      )}

      <section aria-labelledby="nota" className="space-y-3">
        <h3 id="nota" className="text-sm font-medium text-neutral-500">
          Nota fiscal
        </h3>

        <NotaCompra
          compraId={compra.id}
          nota={notaNaTela}
          falhaAnterior={avisoNota === "falhou"}
        />
      </section>

      <div className="border-t border-neutral-200 pt-4">
        <BotaoExcluirCompra id={compra.id} />
      </div>
    </div>
  );
}
