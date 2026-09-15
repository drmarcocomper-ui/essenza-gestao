"use client";

import { Check, ChevronDown } from "lucide-react";

/**
 * Os chips do catálogo, como as duas telas de atendimento os mostram:
 * blocos sanfonados por categoria, cada um com os chips dentro.
 *
 * Saiu de dentro do FecharConta para o registro do atendimento (4A) usar
 * a mesma coisa. O catálogo dela tem 24 serviços: num monte só vira
 * rolagem pura, e é a tela por onde toda cliente passa.
 *
 * O agrupamento em si é regra, não desenho, e mora em
 * `@/lib/servicos/grupos`.
 */

/**
 * Um bloco de chips que abre e fecha.
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

      <div className="flex flex-wrap gap-2 px-3 pb-3">{children}</div>
    </details>
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
      className={`flex min-h-11 items-center gap-1.5 rounded-full border px-4 text-sm font-medium ${
        marcado
          ? "border-rose-600 bg-rose-600 text-white"
          : "border-neutral-300 bg-white text-neutral-700 active:bg-neutral-100"
      }`}
    >
      {marcado && <Check aria-hidden="true" className="size-4" />}
      {nome}

      {/* Nasceu numa tela destas e continua sem preço: o aviso anda com o
          serviço para ela esbarrar nele de novo e acertar. */}
      {semPreco && (
        <span
          className={`text-xs font-normal ${
            marcado ? "text-rose-100" : "text-amber-700"
          }`}
        >
          · sem preço
        </span>
      )}
    </button>
  );
}
