"use client";

import { Check, ChevronDown } from "lucide-react";

/**
 * O catálogo, como as duas telas de atendimento o mostram: blocos
 * sanfonados por categoria, cada um com a lista dos itens dentro.
 *
 * Saiu de dentro do FecharConta para o registro do atendimento (4A) usar
 * a mesma coisa. O catálogo dela tem 24 serviços: num monte só vira
 * rolagem pura, e é a tela por onde toda cliente passa.
 *
 * Dentro do bloco, um item por linha, em ordem alfabética: foi como ela
 * pediu. Chips lado a lado já saíam em ordem, mas a quebra de linha
 * escondia isso — o olho não sabia se lia por linha ou por coluna.
 *
 * O agrupamento e a ordem são regra, não desenho, e moram em
 * `@/lib/servicos/grupos`.
 */

/**
 * Um bloco da lista que abre e fecha.
 *
 * `<details>` nativo: abre sem JavaScript, e fechado ocupa uma linha. O
 * badge conta o que já foi escolhido lá dentro, porque o bloco fechado
 * esconde a escolha — sem ele ela teria que abrir os seis para conferir.
 */
export function GrupoDeChips({
  rotulo,
  escolhidos,
  children,
}: {
  rotulo: string;
  escolhidos: number;
  children: React.ReactNode;
}) {
  return (
    <details className="group rounded-2xl border border-neutral-200 bg-white">
      <summary className="flex min-h-12 cursor-pointer list-none items-center gap-2 px-4 py-2 font-medium text-neutral-800 [&::-webkit-details-marker]:hidden">
        <ChevronDown
          aria-hidden="true"
          className="size-5 shrink-0 text-neutral-400 transition-transform group-open:rotate-180"
        />

        <span className="flex-1">{rotulo}</span>

        {escolhidos > 0 && (
          <span className="rounded-full bg-rose-600 px-2 py-0.5 text-xs font-medium text-white">
            {escolhidos}
          </span>
        )}
      </summary>

      <div className="flex flex-col gap-2 px-3 pb-3">{children}</div>
    </details>
  );
}

/**
 * A bolinha no começo da linha: vazia, ou branca com check quando o item
 * está na conta. Existe nas duas situações para os nomes ficarem
 * alinhados, e o check diz "marcado" mesmo para quem não repara na cor.
 */
export function MarcaDeEscolha({ marcado }: { marcado: boolean }) {
  return (
    <span
      aria-hidden="true"
      className={`flex size-5 shrink-0 items-center justify-center rounded-full border ${
        marcado
          ? "border-white bg-white text-rose-600"
          : "border-neutral-300 bg-white"
      }`}
    >
      {marcado && <Check strokeWidth={3} className="size-3.5" />}
    </span>
  );
}

export function ChipDeCatalogo({
  nome,
  marcado,
  semPreco,
  aoTocar,
}: {
  nome: string;
  marcado: boolean;
  semPreco: boolean;
  aoTocar: () => void;
}) {
  return (
    <button
      type="button"
      onClick={aoTocar}
      aria-pressed={marcado}
      className={`flex min-h-11 w-full items-center gap-3 rounded-xl border px-3 py-2 text-left text-sm font-medium ${
        marcado
          ? "border-rose-600 bg-rose-600 text-white"
          : "border-neutral-300 bg-white text-neutral-700 active:bg-neutral-100"
      }`}
    >
      <MarcaDeEscolha marcado={marcado} />

      <span className="min-w-0 flex-1">
        {nome}

        {/* Nasceu numa tela destas e continua sem preço: o aviso anda com
            o serviço para ela esbarrar nele de novo e acertar. */}
        {semPreco && (
          <span
            className={`text-xs font-normal ${
              marcado ? "text-rose-100" : "text-amber-700"
            }`}
          >
            {" "}
            · sem preço
          </span>
        )}
      </span>
    </button>
  );
}
