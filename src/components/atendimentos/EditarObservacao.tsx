"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Pencil } from "lucide-react";

/**
 * A observação do atendimento, editável ali mesmo — com a conta aberta
 * ou fechada. Texto não é dinheiro: não passa pelo Reabrir.
 */
export default function EditarObservacao({
  acao,
  observacao,
}: {
  acao: (observacao: string) => Promise<{ erro?: string }>;
  observacao: string | null;
}) {
  const router = useRouter();
  const [editando, setEditando] = useState(false);
  const [texto, setTexto] = useState(observacao ?? "");
  const [erro, setErro] = useState<string | null>(null);
  const [salvando, iniciar] = useTransition();

  function abrir() {
    setTexto(observacao ?? "");
    setErro(null);
    setEditando(true);
  }

  function salvar() {
    iniciar(async () => {
      setErro(null);

      try {
        const resultado = await acao(texto);

        if (resultado.erro) {
          setErro(resultado.erro);
          return;
        }

        setEditando(false);
        router.refresh();
      } catch {
        setErro("Não foi possível salvar a observação. Tente de novo.");
      }
    });
  }

  if (!editando) {
    return (
      <div className="space-y-2">
        {observacao && (
          <p className="rounded-2xl border border-neutral-200 bg-white px-4 py-3 text-sm whitespace-pre-line text-neutral-700">
            {observacao}
          </p>
        )}

        <button
          type="button"
          onClick={abrir}
          className="flex h-11 items-center gap-2 rounded-lg px-2 text-sm font-medium text-rose-700 active:bg-rose-50"
        >
          <Pencil aria-hidden="true" className="size-4" />
          {observacao ? "Editar observação" : "Adicionar observação"}
        </button>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <label className="block space-y-1">
        <span className="text-sm font-medium text-neutral-700">
          Observação
        </span>
        <textarea
          value={texto}
          onChange={(evento) => setTexto(evento.target.value)}
          maxLength={1000}
          rows={4}
          autoFocus
          className="block w-full rounded-xl border border-neutral-300 bg-white px-3 py-2 text-base text-neutral-900 focus:border-rose-500 focus:outline-none"
        />
      </label>

      {erro && (
        <p
          role="alert"
          className="rounded-xl border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-800"
        >
          {erro}
        </p>
      )}

      <div className="flex gap-3">
        <button
          type="button"
          onClick={() => setEditando(false)}
          disabled={salvando}
          className="h-12 flex-1 rounded-xl border border-neutral-300 bg-white font-medium text-neutral-700 active:bg-neutral-100"
        >
          Cancelar
        </button>

        <button
          type="button"
          onClick={salvar}
          disabled={salvando}
          className="h-12 flex-1 rounded-xl bg-rose-600 font-medium text-white active:bg-rose-700 disabled:opacity-60"
        >
          {salvando ? "Salvando…" : "Salvar"}
        </button>
      </div>
    </div>
  );
}
