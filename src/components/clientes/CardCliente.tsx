import Link from "next/link";
import { ChevronRight } from "lucide-react";

import type { ClienteResumo } from "@/lib/clientes/consultas";
import { formatarData, formatarTelefone } from "@/lib/formatters";

/**
 * Item da lista. Mostra só o que serve para achar a pessoa — nome,
 * telefone e quando ela veio pela última vez. Valores ficam no perfil.
 */
export default function CardCliente({ cliente }: { cliente: ClienteResumo }) {
  return (
    <Link
      href={`/clientes/${cliente.id}`}
      className="flex min-h-16 items-center gap-3 rounded-2xl border border-neutral-200 bg-white px-4 py-3 active:bg-neutral-100"
    >
      <div className="min-w-0 flex-1">
        <p className="flex items-center gap-2 font-medium text-neutral-900">
          <span className="truncate">{cliente.nome}</span>
          {!cliente.ativo && (
            <span className="shrink-0 rounded-full bg-neutral-100 px-2 py-0.5 text-xs font-medium text-neutral-500">
              Inativa
            </span>
          )}
        </p>

        <p className="mt-0.5 truncate text-sm text-neutral-500">
          {formatarTelefone(cliente.telefone) || "Sem telefone"}
        </p>

        <p className="mt-0.5 text-xs text-neutral-400">
          {cliente.ultimoAtendimento
            ? `Último atendimento em ${formatarData(cliente.ultimoAtendimento)}`
            : "Sem atendimento registrado"}
        </p>
      </div>

      <ChevronRight
        aria-hidden="true"
        className="size-5 shrink-0 text-neutral-300"
      />
    </Link>
  );
}
