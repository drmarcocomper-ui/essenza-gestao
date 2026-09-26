"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Undo2 } from "lucide-react";

import { desfazerDesmembramento } from "@/app/(app)/produtos/extensao/actions";

/**
 * Desfazer em dois toques, como a exclusão: o primeiro abre a
 * confirmação com as partes que vão sumir, o segundo apaga. No sucesso a
 * página se recarrega no lugar — a mãe volta editável e desmembrável.
 */
export default function BotaoDesfazerDesmembramento({
  maeId,
  codigo,
  partes,
}: {
  maeId: string;
  codigo: string;
  /** Códigos das partes, para ela ver o que vai apagar. */
  partes: string[];
}) {
  const router = useRouter();
  const [confirmando, setConfirmando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);
  const [desfazendo, iniciar] = useTransition();

  function desfazer() {
    iniciar(async () => {
      setErro(null);

      try {
        const resultado = await desfazerDesmembramento(maeId);

        setConfirmando(false);

        if (resultado.erro) {
          setErro(resultado.erro);
          return;
        }

        router.refresh();
      } catch {
        setErro("Não foi possível desfazer. Tente de novo.");
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
          <Undo2 aria-hidden="true" className="size-5" />
          Desfazer desmembramento
        </button>
      </div>
    );
  }

  return (
    <div className="space-y-3 rounded-xl border border-rose-200 bg-rose-50 p-3">
      <p className="text-sm text-rose-900">
        Desfazer o desmembramento da peça {codigo}? As {partes.length} partes (
        {partes.join(", ")}) serão excluídas, com tudo o que foi preenchido
        nelas. Não dá para desfazer.
      </p>

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
          onClick={desfazer}
          disabled={desfazendo}
          className="h-12 flex-1 rounded-xl bg-rose-600 font-medium text-white active:bg-rose-700 disabled:opacity-60"
        >
          {desfazendo ? "Desfazendo…" : "Desfazer"}
        </button>
      </div>
    </div>
  );
}
