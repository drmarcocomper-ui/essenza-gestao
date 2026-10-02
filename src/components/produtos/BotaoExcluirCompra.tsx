"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Trash2 } from "lucide-react";

import { excluirCompra } from "@/app/(app)/produtos/compras/actions";

/**
 * Exclusão em dois toques, sem `confirm()` do navegador, como a do
 * Caixa: o primeiro toque abre a confirmação, o segundo apaga a compra,
 * as linhas e a nota.
 */
export default function BotaoExcluirCompra({ id }: { id: string }) {
  const router = useRouter();
  const [confirmando, setConfirmando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);
  const [excluindo, iniciar] = useTransition();

  function excluir() {
    iniciar(async () => {
      setErro(null);

      try {
        // A recusa volta como valor e em português; a exceção é só a
        // falha de rede, que o Next não deixa ler.
        const resultado = await excluirCompra(id);

        if (resultado.erro) {
          setErro(resultado.erro);
          setConfirmando(false);
          return;
        }

        router.push("/produtos/compras");
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
          className="flex h-12 w-full items-center justify-center gap-2 rounded-xl border border-neutral-300 bg-white font-medium text-rose-700 active:bg-rose-50"
        >
          <Trash2 aria-hidden="true" className="size-5" />
          Excluir compra
        </button>
      </div>
    );
  }

  return (
    <div className="space-y-3 rounded-xl border border-rose-200 bg-rose-50 p-3">
      <p className="text-sm text-rose-900">
        Excluir esta compra e a nota dela? O estoque deixa de contar estes
        frascos. Não dá para desfazer.
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
