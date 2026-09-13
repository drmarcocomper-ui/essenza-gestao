import { Wallet } from "lucide-react";

import type { LancamentoLista } from "@/lib/caixa/consultas";

import LinhaLancamento from "./LinhaLancamento";

export default function ListaLancamentos({
  lancamentos,
  filtrada,
}: {
  lancamentos: LancamentoLista[];
  /** Com filtro ligado, a lista vazia quer dizer outra coisa. */
  filtrada: boolean;
}) {
  if (lancamentos.length === 0) {
    return (
      <div className="rounded-2xl border border-dashed border-neutral-300 px-4 py-10 text-center">
        <Wallet aria-hidden="true" className="mx-auto size-8 text-neutral-300" />
        <p className="mt-3 text-neutral-600">
          {filtrada
            ? "Nenhum lançamento com esses filtros."
            : "Nenhum lançamento neste mês."}
        </p>
      </div>
    );
  }

  return (
    <ul className="space-y-2">
      {lancamentos.map((lancamento) => (
        <li key={lancamento.id}>
          <LinhaLancamento lancamento={lancamento} />
        </li>
      ))}
    </ul>
  );
}
