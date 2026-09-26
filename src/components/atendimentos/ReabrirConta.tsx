"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { LockOpen } from "lucide-react";

import {
  textoReabertura,
  type ResumoReabertura,
} from "@/lib/atendimentos/reabertura";

/**
 * Reabrir em dois toques, como a exclusão do Caixa: o primeiro diz o que
 * vai ser apagado, o segundo apaga. Os lançamentos saem do Caixa na hora.
 */
export default function ReabrirConta({
  acao,
  resumo,
}: {
  acao: () => Promise<{ erro?: string }>;
  resumo: ResumoReabertura;
}) {
  const router = useRouter();
  const [confirmando, setConfirmando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);
  const [reabrindo, iniciar] = useTransition();

  function reabrir() {
    iniciar(async () => {
      setErro(null);

      try {
        const resultado = await acao();

        if (resultado.erro) {
          setErro(resultado.erro);
          setConfirmando(false);
          // "Já está aberta": a tela estava velha, e recarregar mostra.
          router.refresh();
          return;
        }

        setConfirmando(false);
        router.refresh();
      } catch {
        setErro("Não foi possível reabrir a conta. Tente de novo.");
        setConfirmando(false);
      }
    });
  }

  if (!confirmando) {
    return (
      <div className="space-y-2">
        {erro && (
          <p
            role="alert"
            className="rounded-xl border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-800"
          >
            {erro}
          </p>
        )}

        <button
          type="button"
          onClick={() => setConfirmando(true)}
          className="flex h-12 w-full items-center justify-center gap-2 rounded-xl border border-neutral-300 bg-white font-medium text-neutral-700 active:bg-neutral-100"
        >
          <LockOpen aria-hidden="true" className="size-5" />
          Reabrir conta
        </button>
      </div>
    );
  }

  return (
    <div className="space-y-3 rounded-xl border border-amber-200 bg-amber-50 p-3">
      {textoReabertura(resumo).map((frase) => (
        <p key={frase} className="text-sm text-amber-900">
          {frase}
        </p>
      ))}

      <div className="flex gap-3">
        <button
          type="button"
          onClick={() => setConfirmando(false)}
          className="h-12 flex-1 rounded-xl border border-neutral-300 bg-white font-medium text-neutral-700 active:bg-neutral-100"
        >
          Cancelar
        </button>

        <button
          type="button"
          onClick={reabrir}
          disabled={reabrindo}
          className="h-12 flex-1 rounded-xl bg-amber-600 font-medium text-white active:bg-amber-700 disabled:opacity-60"
        >
          {reabrindo ? "Reabrindo…" : "Reabrir"}
        </button>
      </div>
    </div>
  );
}
