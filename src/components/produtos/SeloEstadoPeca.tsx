import Link from "next/link";
import { ChevronRight } from "lucide-react";

import { formatarDiaMes } from "@/lib/formatters";
import {
  estadoDaPeca,
  type ContaDaPeca,
} from "@/lib/pecas-extensao/regras";

/**
 * O estado da peça (disponível, desmembrada, na conta aberta, vendida),
 * como a lista e a ficha da peça mostram.
 *
 * Nos dois estados de conta o selo é um link para o atendimento: é lá
 * que ela reabre a conta e tira a peça, se precisar. Por isso ele não
 * pode morar dentro de outro link — quem usa põe fora do card.
 */
export default function SeloEstadoPeca({
  temFilhas,
  conta,
}: {
  temFilhas: boolean;
  conta: ContaDaPeca | null;
}) {
  const estado = estadoDaPeca({ temFilhas, conta });

  if (conta && estado !== "disponivel" && estado !== "desmembrada") {
    const vendida = estado === "vendida";

    return (
      <Link
        href={`/clientes/${conta.clienteId}/atendimentos/${conta.atendimentoId}`}
        className={`flex min-h-11 items-center gap-2 px-4 text-sm font-medium ${
          vendida
            ? "text-emerald-800 active:bg-emerald-50"
            : "text-amber-800 active:bg-amber-50"
        }`}
      >
        <span className="min-w-0 flex-1 truncate">
          {vendida
            ? `Vendida · ${conta.clienteNome} · ${formatarDiaMes(conta.data)}`
            : `Na conta aberta · ${conta.clienteNome}`}
        </span>

        <ChevronRight aria-hidden="true" className="size-4 shrink-0 opacity-60" />
      </Link>
    );
  }

  return (
    <span
      className={`shrink-0 rounded-full px-2 py-0.5 text-xs ${
        estado === "disponivel"
          ? "bg-emerald-50 text-emerald-700"
          : "bg-neutral-100 text-neutral-500"
      }`}
    >
      {estado === "disponivel" ? "Disponível" : "Desmembrada"}
    </span>
  );
}
