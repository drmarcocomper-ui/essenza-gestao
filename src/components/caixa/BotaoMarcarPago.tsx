"use client";

import { useState, useTransition } from "react";
import { Check } from "lucide-react";

import { marcarComoPago } from "@/app/(app)/caixa/actions";

/**
 * Ação rápida da tela de pendentes: recebeu, marcou. A data de caixa
 * vira hoje, que é o dia em que o dinheiro entrou.
 */
export default function BotaoMarcarPago({
  id,
  descricao,
}: {
  id: string;
  descricao: string;
}) {
  const [erro, setErro] = useState<string | null>(null);
  const [salvando, iniciar] = useTransition();

  function marcar() {
    iniciar(async () => {
      setErro(null);

      try {
        await marcarComoPago(id);
      } catch {
        setErro("Não foi possível marcar. Tente de novo.");
      }
    });
  }

  return (
    <div className="space-y-2">
      <button
        type="button"
        onClick={marcar}
        disabled={salvando}
        aria-label={`Marcar ${descricao} como pago`}
        className="flex h-12 w-full items-center justify-center gap-2 rounded-xl bg-emerald-600 font-medium text-white active:bg-emerald-700 disabled:opacity-60"
      >
        <Check aria-hidden="true" className="size-5" />
        {salvando ? "Marcando…" : "Marcar como pago"}
      </button>

      {erro && (
        <p role="alert" className="text-sm text-rose-700">
          {erro}
        </p>
      )}
    </div>
  );
}
