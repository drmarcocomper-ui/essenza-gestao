"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Trash2 } from "lucide-react";

import { excluirLancamento } from "@/app/(app)/caixa/actions";

/**
 * Exclusão em dois toques, sem `confirm()` do navegador: o primeiro
 * toque abre a confirmação, o segundo apaga. Errar com o polegar não
 * pode custar um lançamento.
 */
export default function BotaoExcluir({ id }: { id: string }) {
  const router = useRouter();
  const [confirmando, setConfirmando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);
  const [excluindo, iniciar] = useTransition();

  function excluir() {
    iniciar(async () => {
      setErro(null);

      try {
        await excluirLancamento(id);
        // A volta é daqui, não da action: em produção o Next troca a
        // mensagem de erro do servidor por um texto genérico em inglês,
        // então o sucesso e a falha são tratados no cliente.
        router.push("/caixa");
      } catch {
        setErro("Não foi possível excluir. Tente de novo.");
        setConfirmando(false);
      }
    });
  }

  if (!confirmando) {
    return (
      <div className="space-y-2">
        {erro && (
          <p role="alert" className="text-sm text-rose-700">
            {erro}
          </p>
        )}

        <button
          type="button"
          onClick={() => setConfirmando(true)}
          className="flex h-12 w-full items-center justify-center gap-2 rounded-xl border border-neutral-300 bg-white font-medium text-rose-700 active:bg-rose-50"
        >
          <Trash2 aria-hidden="true" className="size-5" />
          Excluir lançamento
        </button>
      </div>
    );
  }

  return (
    <div className="space-y-3 rounded-xl border border-rose-200 bg-rose-50 p-3">
      <p className="text-sm text-rose-900">
        Excluir este lançamento? Não dá para desfazer.
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
          onClick={excluir}
          disabled={excluindo}
          className="h-12 flex-1 rounded-xl bg-rose-600 font-medium text-white active:bg-rose-700 disabled:opacity-60"
        >
          {excluindo ? "Excluindo…" : "Excluir"}
        </button>
      </div>
    </div>
  );
}
