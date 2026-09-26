"use client";

import { useState, useTransition } from "react";
import { PackageCheck, PackageX } from "lucide-react";

import { alternarAtivoProduto } from "@/app/(app)/produtos/actions";

/**
 * Desativar / reativar. Produto nunca é apagado: inativo some dos chips
 * da conta, mas continua nos atendimentos em que foi vendido.
 *
 * Desativar pede confirmação no próprio botão, em dois toques, como em
 * Clientes. Reativar é direto, mas pode ser recusado se já existir um
 * ativo com o mesmo nome e marca — a mensagem aparece aqui.
 */
export default function BotaoAtivoProduto({
  id,
  ativo,
}: {
  id: string;
  ativo: boolean;
}) {
  const [confirmando, setConfirmando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);
  const [processando, iniciarTransicao] = useTransition();

  function executar() {
    setErro(null);

    iniciarTransicao(async () => {
      const resultado = await alternarAtivoProduto(id, !ativo);

      setErro(resultado.erro ?? null);
      setConfirmando(false);
    });
  }

  const aviso = erro && (
    <p
      role="alert"
      className="rounded-xl border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-800"
    >
      {erro}
    </p>
  );

  if (!ativo) {
    return (
      <div className="space-y-2">
        {aviso}

        <button
          type="button"
          onClick={executar}
          disabled={processando}
          className="inline-flex h-12 w-full items-center justify-center gap-2 rounded-xl border border-neutral-300 bg-white font-medium text-neutral-700 active:bg-neutral-100 disabled:opacity-60"
        >
          <PackageCheck aria-hidden="true" className="size-5" />
          {processando ? "Reativando…" : "Reativar produto"}
        </button>
      </div>
    );
  }

  if (!confirmando) {
    return (
      <div className="space-y-2">
        {aviso}

        <button
          type="button"
          onClick={() => setConfirmando(true)}
          className="inline-flex h-12 w-full items-center justify-center gap-2 rounded-xl border border-neutral-300 bg-white font-medium text-neutral-600 active:bg-neutral-100"
        >
          <PackageX aria-hidden="true" className="size-5" />
          Desativar produto
        </button>
      </div>
    );
  }

  return (
    <div className="space-y-2 rounded-xl border border-neutral-300 bg-white p-3">
      <p className="text-sm text-neutral-600">
        O produto sai da conta, mas continua nos atendimentos em que já foi
        vendido. Dá para reativar depois.
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
          {processando ? "Desativando…" : "Confirmar"}
        </button>
      </div>
    </div>
  );
}
