"use client";

import { useState } from "react";
import Link from "next/link";
import { ChevronRight, Search, X } from "lucide-react";

import { formatarMoeda } from "@/lib/formatters";
import type { ProdutoRevenda } from "@/lib/produtos/consultas";
import { ordenarProdutos, produtoCasaComTermo } from "@/lib/produtos/regras";

/**
 * Produtos de revenda: ativos primeiro, com os sem preço no topo;
 * inativos num bloco recolhido no fim.
 *
 * O catálogo tem dezenas de linhas e vem inteiro do servidor, então a
 * busca filtra aqui, a cada tecla, sem ida ao banco.
 */
export default function ListaProdutos({
  produtos,
}: {
  produtos: ProdutoRevenda[];
}) {
  const [termo, setTermo] = useState("");

  const encontrados = ordenarProdutos(
    produtos.filter((produto) => produtoCasaComTermo(produto, termo)),
  );
  const ativos = encontrados.filter((produto) => produto.ativo);
  const inativos = encontrados.filter((produto) => !produto.ativo);
  const buscando = termo.trim() !== "";

  return (
    <div className="space-y-4">
      <div className="relative">
        <Search
          aria-hidden="true"
          className="pointer-events-none absolute top-1/2 left-3 size-5 -translate-y-1/2 text-neutral-400"
        />

        <input
          type="search"
          value={termo}
          onChange={(evento) => setTermo(evento.target.value)}
          placeholder="Buscar produto"
          aria-label="Buscar produto"
          enterKeyHint="search"
          autoComplete="off"
          autoCorrect="off"
          className="h-12 w-full rounded-xl border border-neutral-300 bg-white pr-12 pl-11 text-base text-neutral-900 placeholder:text-neutral-400 focus:border-rose-500 focus:ring-2 focus:ring-rose-200 focus:outline-none [&::-webkit-search-cancel-button]:hidden"
        />

        {termo.length > 0 && (
          <button
            type="button"
            onClick={() => setTermo("")}
            aria-label="Limpar busca"
            className="absolute top-1/2 right-0 flex size-12 -translate-y-1/2 items-center justify-center text-neutral-400 active:text-neutral-700"
          >
            <X aria-hidden="true" className="size-5" />
          </button>
        )}
      </div>

      {ativos.length > 0 ? (
        <ul className="space-y-2">
          {ativos.map((produto) => (
            <li key={produto.id}>
              <CardProduto produto={produto} />
            </li>
          ))}
        </ul>
      ) : (
        <p className="rounded-2xl border border-dashed border-neutral-300 px-4 py-6 text-center text-sm text-neutral-500">
          {buscando
            ? "Nenhum produto ativo com esse nome."
            : "Nenhum produto cadastrado ainda."}
        </p>
      )}

      {inativos.length > 0 && (
        <details className="group rounded-2xl border border-neutral-200 bg-white">
          <summary className="flex min-h-12 cursor-pointer list-none items-center justify-between px-4 text-sm font-medium text-neutral-600 [&::-webkit-details-marker]:hidden">
            Inativos ({inativos.length})
            <ChevronRight
              aria-hidden="true"
              className="size-5 text-neutral-400 transition-transform group-open:rotate-90"
            />
          </summary>

          <ul className="space-y-2 px-2 pb-2">
            {inativos.map((produto) => (
              <li key={produto.id}>
                <CardProduto produto={produto} />
              </li>
            ))}
          </ul>
        </details>
      )}
    </div>
  );
}

/**
 * Nome e marca à esquerda, preço à direita. "Sem preço" em destaque,
 * porque é o que ela veio resolver; "criado na conta" discreto, porque
 * é só a origem.
 */
function CardProduto({ produto }: { produto: ProdutoRevenda }) {
  return (
    <Link
      href={`/produtos/${produto.id}/editar`}
      className={`flex min-h-16 items-center gap-3 rounded-2xl border border-neutral-200 px-4 py-3 active:bg-neutral-100 ${
        produto.ativo ? "bg-white" : "bg-neutral-50"
      }`}
    >
      <div className="min-w-0 flex-1">
        <p
          className={`truncate font-medium ${
            produto.ativo ? "text-neutral-900" : "text-neutral-500"
          }`}
        >
          {produto.nome}
        </p>

        <p className="mt-0.5 truncate text-sm text-neutral-500">
          {produto.marca ?? "Sem marca"}
          {produto.origem === "atendimento" && (
            <span className="text-xs text-neutral-400"> · criado na conta</span>
          )}
        </p>
      </div>

      {produto.preco === null ? (
        <span className="shrink-0 rounded-full bg-amber-100 px-2 py-0.5 text-xs font-medium text-amber-800">
          Sem preço
        </span>
      ) : (
        <span className="shrink-0 font-medium tabular-nums text-neutral-900">
          {formatarMoeda(produto.preco)}
        </span>
      )}

      <ChevronRight
        aria-hidden="true"
        className="size-5 shrink-0 text-neutral-300"
      />
    </Link>
  );
}
