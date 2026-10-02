"use client";

import { useActionState } from "react";
import Link from "next/link";

import type { EstadoContagem } from "@/app/(app)/produtos/[id]/actions";
import { Campo } from "@/components/produtos/FormularioPeca";
import { hoje } from "@/lib/caixa/mes";

type Props = {
  acao: (estado: EstadoContagem, formData: FormData) => Promise<EstadoContagem>;
  produtoId: string;
};

const ESTADO_INICIAL: EstadoContagem = {};

/** Data (hoje por padrão), quantidade inteira e uma observação opcional. */
export default function FormularioContagem({ acao, produtoId }: Props) {
  const [estado, enviar, enviando] = useActionState(acao, ESTADO_INICIAL);

  return (
    <form action={enviar} className="space-y-5">
      {estado.mensagem && (
        <p
          role="alert"
          className="rounded-xl border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-800"
        >
          {estado.mensagem}
        </p>
      )}

      <Campo
        rotulo="Quantidade na prateleira"
        erro={estado.erros?.quantidade}
        sufixo="un"
        obrigatorio
      >
        {(props) => (
          <input
            {...props}
            name="quantidade"
            type="text"
            // Teclado só de números: frasco se conta inteiro.
            inputMode="numeric"
            defaultValue={estado.valores?.quantidade ?? ""}
            autoComplete="off"
            enterKeyHint="done"
            required
            autoFocus
          />
        )}
      </Campo>

      <Campo rotulo="Data da contagem" erro={estado.erros?.data} obrigatorio>
        {(props) => (
          <input
            {...props}
            name="data"
            type="date"
            defaultValue={estado.valores?.data ?? hoje()}
            // Só dica para o calendário; quem recusa o futuro é o schema.
            max={hoje()}
            required
          />
        )}
      </Campo>

      <Campo rotulo="Observação" erro={estado.erros?.observacao} multilinha>
        {(props) => (
          <textarea
            {...props}
            name="observacao"
            defaultValue={estado.valores?.observacao ?? ""}
            rows={2}
          />
        )}
      </Campo>

      <div className="flex gap-3 pt-2">
        <Link
          href={`/produtos/${produtoId}`}
          className="flex h-12 flex-1 items-center justify-center rounded-xl border border-neutral-300 bg-white font-medium text-neutral-700 active:bg-neutral-100"
        >
          Cancelar
        </Link>

        <button
          type="submit"
          disabled={enviando}
          className="h-12 flex-1 rounded-xl bg-rose-600 font-medium text-white active:bg-rose-700 disabled:opacity-60"
        >
          {enviando ? "Salvando…" : "Registrar"}
        </button>
      </div>
    </form>
  );
}
