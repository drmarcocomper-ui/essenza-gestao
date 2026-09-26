"use client";

import { useState } from "react";
import Link from "next/link";
import { ChevronRight, Search, X } from "lucide-react";

import { formatarMoeda } from "@/lib/formatters";
import type { PecaExtensao } from "@/lib/pecas-extensao/consultas";
import { ordenarPecas, pecaCasaComTermo } from "@/lib/pecas-extensao/regras";

/** Campo não informado: nunca 0, que seria outro dado. */
const VAZIO = "—";

/** Recuo de cada nível de parte, em rem. */
const RECUO_POR_NIVEL = 1.25;

function medida(valor: number | null, unidade: string) {
  if (valor === null) return `${VAZIO} ${unidade}`;

  return `${valor.toLocaleString("pt-BR", { maximumFractionDigits: 2 })} ${unidade}`;
}

function preco(valor: number | null) {
  return valor === null ? VAZIO : formatarMoeda(valor);
}

/**
 * Peças de extensão em ordem natural de código, com cada parte logo
 * abaixo da mãe. A tabela vem inteira do servidor, e a busca por código
 * filtra aqui, a cada tecla, como a da revenda.
 */
export default function ListaPecas({ pecas }: { pecas: PecaExtensao[] }) {
  const [termo, setTermo] = useState("");

  const encontradas = ordenarPecas(
    pecas.filter((peca) => pecaCasaComTermo(peca, termo)),
  );
  const buscando = termo.trim() !== "";

  return (
    <div className="space-y-4">
      {pecas.length > 0 && (
        <div className="relative">
          <Search
            aria-hidden="true"
            className="pointer-events-none absolute top-1/2 left-3 size-5 -translate-y-1/2 text-neutral-400"
          />

          <input
            type="search"
            value={termo}
            onChange={(evento) => setTermo(evento.target.value)}
            placeholder="Buscar peça pelo código"
            aria-label="Buscar peça pelo código"
            enterKeyHint="search"
            autoComplete="off"
            autoCorrect="off"
            className="h-12 w-full rounded-xl border border-neutral-300 bg-white pr-12 pl-11 text-base text-neutral-900 placeholder:text-neutral-400 focus:border-rose-500 focus:ring-2 focus:ring-rose-200 focus:outline-none [&::-webkit-search-cancel-button]:hidden"
          />

          {termo.length > 0 && (
            <button
              type="button"
              onClick={() => setTermo("")}
              aria-label="Limpar busca de peça"
              className="absolute top-1/2 right-0 flex size-12 -translate-y-1/2 items-center justify-center text-neutral-400 active:text-neutral-700"
            >
              <X aria-hidden="true" className="size-5" />
            </button>
          )}
        </div>
      )}

      {encontradas.length > 0 ? (
        <ul className="space-y-2">
          {encontradas.map(({ peca, nivel }) => (
            <li
              key={peca.id}
              style={nivel > 0 ? { marginLeft: `${nivel * RECUO_POR_NIVEL}rem` } : undefined}
            >
              <CardPeca peca={peca} />
            </li>
          ))}
        </ul>
      ) : (
        <p className="rounded-2xl border border-dashed border-neutral-300 px-4 py-6 text-center text-sm text-neutral-500">
          {buscando
            ? "Nenhuma peça com esse código."
            : "Nenhuma peça cadastrada ainda."}
        </p>
      )}
    </div>
  );
}

/**
 * Código em destaque, depois cor · textura e gramas · comprimento; os
 * dois preços à direita, com rótulo, porque sem ele não se sabe qual é
 * qual.
 */
function CardPeca({ peca }: { peca: PecaExtensao }) {
  return (
    <Link
      href={`/produtos/extensao/${peca.id}`}
      className="flex min-h-16 items-center gap-3 rounded-2xl border border-neutral-200 bg-white px-4 py-3 active:bg-neutral-100"
    >
      <div className="min-w-0 flex-1">
        <p className="truncate font-medium text-neutral-900">{peca.codigo}</p>

        <p className="mt-0.5 truncate text-sm text-neutral-500">
          {peca.cor ?? VAZIO} · {peca.textura ?? VAZIO}
        </p>

        <p className="truncate text-sm tabular-nums text-neutral-500">
          {medida(peca.gramas, "g")} · {medida(peca.comprimentoCm, "cm")}
        </p>
      </div>

      <dl className="shrink-0 text-right text-sm tabular-nums">
        <div>
          <dt className="sr-only">Preço de venda</dt>
          <dd className="font-medium text-neutral-900">
            <span aria-hidden="true" className="text-xs font-normal text-neutral-400">
              venda{" "}
            </span>
            {preco(peca.precoVenda)}
          </dd>
        </div>

        <div>
          <dt className="sr-only">Preço de compra</dt>
          <dd className="text-neutral-500">
            <span aria-hidden="true" className="text-xs text-neutral-400">
              compra{" "}
            </span>
            {preco(peca.precoCompra)}
          </dd>
        </div>
      </dl>

      <ChevronRight
        aria-hidden="true"
        className="size-5 shrink-0 text-neutral-300"
      />
    </Link>
  );
}
