import { TriangleAlert } from "lucide-react";

import type { Saldo } from "@/lib/estoque/saldo";

/** 3 → "3 un". O estoque de frasco é sempre em unidades. */
export function formatarUnidades(quantidade: number) {
  return `${quantidade.toLocaleString("pt-BR")} un`;
}

/**
 * O saldo como a lista e a página do produto mostram: o número, ou "Sem
 * contagem" quando ainda não há de onde partir. Negativo aparece como
 * número — esconder seria mentir — com o recado de contar de novo.
 */
export default function SaldoEstoque({
  saldo,
  grande = false,
}: {
  saldo: Saldo;
  grande?: boolean;
}) {
  if (saldo.situacao === "sem_contagem") {
    return (
      <span className="shrink-0 rounded-full bg-amber-100 px-2 py-0.5 text-xs font-medium text-amber-800">
        Sem contagem
      </span>
    );
  }

  const negativo = saldo.quantidade < 0;

  return (
    <span className="flex shrink-0 flex-col items-end">
      <span
        className={`font-semibold tabular-nums ${grande ? "text-2xl" : ""} ${
          negativo ? "text-rose-700" : "text-neutral-900"
        }`}
      >
        {formatarUnidades(saldo.quantidade)}
      </span>

      {negativo && (
        <span className="flex items-center gap-1 text-xs font-medium text-rose-700">
          <TriangleAlert aria-hidden="true" className="size-3.5" />
          Conte de novo
        </span>
      )}
    </span>
  );
}
