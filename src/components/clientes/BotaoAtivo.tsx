"use client";

import { useState, useTransition } from "react";
import { UserCheck, UserX } from "lucide-react";

import { alternarAtivo } from "@/app/(app)/clientes/actions";

/**
 * Inativar / reativar. Cliente nunca é excluída: inativa some da lista,
 * mas continua no histórico e pode voltar.
 *
 * A confirmação é feita no próprio botão, em dois toques, em vez de um
 * `confirm()` do navegador — mais previsível no celular.
 */
export default function BotaoAtivo({
  id,
  ativo,
}: {
  id: string;
  ativo: boolean;
}) {
  const [confirmando, setConfirmando] = useState(false);
  const [processando, iniciarTransicao] = useTransition();

  function executar() {
    iniciarTransicao(async () => {
      await alternarAtivo(id, !ativo);
      setConfirmando(false);
    });
  }

  if (!ativo) {
    return (
      <button
        type="button"
        onClick={executar}
        disabled={processando}
        className="inline-flex h-12 w-full items-center justify-center gap-2 rounded-xl border border-neutral-300 bg-white font-medium text-neutral-700 active:bg-neutral-100 disabled:opacity-60"
      >
        <UserCheck aria-hidden="true" className="size-5" />
        {processando ? "Reativando…" : "Reativar cliente"}
      </button>
    );
  }

  if (!confirmando) {
    return (
      <button
        type="button"
        onClick={() => setConfirmando(true)}
        className="inline-flex h-12 w-full items-center justify-center gap-2 rounded-xl border border-neutral-300 bg-white font-medium text-neutral-600 active:bg-neutral-100"
      >
        <UserX aria-hidden="true" className="size-5" />
        Inativar cliente
      </button>
    );
  }

  return (
    <div className="space-y-2 rounded-xl border border-neutral-300 bg-white p-3">
      <p className="text-sm text-neutral-600">
        A cliente sai da lista, mas o histórico continua aqui.
      </p>

      <div className="flex gap-2">
        <button
          type="button"
          onClick={() => setConfirmando(false)}
          className="h-11 flex-1 rounded-xl border border-neutral-300 font-medium text-neutral-700 active:bg-neutral-100"
        >
          Cancelar
        </button>

        <button
          type="button"
          onClick={executar}
          disabled={processando}
          className="h-11 flex-1 rounded-xl bg-neutral-800 font-medium text-white active:bg-neutral-900 disabled:opacity-60"
        >
          {processando ? "Inativando…" : "Confirmar"}
        </button>
      </div>
    </div>
  );
}
