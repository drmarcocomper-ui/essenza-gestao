"use client";

import { useId, useState, useTransition } from "react";
import { Check } from "lucide-react";

import { confirmarRecebimento } from "@/app/(app)/caixa/actions";
import { hoje } from "@/lib/caixa/mes";

/**
 * "Caiu" — o gesto da tela A receber.
 *
 * Em dois toques, como a exclusão: o primeiro abre o campo de data, o
 * segundo grava. Ninguém confirma um recebimento sem querer com o
 * polegar, e ninguém confirma sem dizer o dia.
 *
 * O campo abre com hoje só por conveniência — é o caso comum, ela olha
 * o extrato no dia em que a parcela cai. A data é sempre editável, e o
 * app não a deriva da venda: quem sabe quando o dinheiro caiu é ela.
 * `max` fecha o futuro já no seletor do celular; o schema e a action
 * fecham de novo, porque o campo do navegador não é garantia de nada.
 */
export default function ConfirmarRecebimento({
  id,
  descricao,
}: {
  id: string;
  descricao: string;
}) {
  const idData = useId();
  const [aberto, setAberto] = useState(false);
  const [data, setData] = useState("");
  const [erro, setErro] = useState<string | null>(null);
  const [salvando, iniciar] = useTransition();

  function abrir() {
    setData(hoje());
    setErro(null);
    setAberto(true);
  }

  function confirmar() {
    iniciar(async () => {
      setErro(null);

      try {
        const resultado = await confirmarRecebimento(id, data);

        if (!resultado.ok) {
          setErro(resultado.mensagem);
          return;
        }

        // Deu certo: o lançamento deixa de ser pendente e a linha some
        // da lista sozinha, com a revalidação que veio da action.
        setAberto(false);
      } catch {
        setErro("Não foi possível confirmar. Tente de novo.");
      }
    });
  }

  if (!aberto) {
    return (
      <div className="space-y-2">
        {erro && (
          <p role="alert" className="text-sm text-rose-700">
            {erro}
          </p>
        )}

        <button
          type="button"
          onClick={abrir}
          aria-label={`Confirmar recebimento de ${descricao}`}
          className="flex h-12 w-full items-center justify-center gap-2 rounded-xl bg-emerald-600 font-medium text-white active:bg-emerald-700"
        >
          <Check aria-hidden="true" className="size-5" />
          Confirmar recebimento
        </button>
      </div>
    );
  }

  return (
    <div className="space-y-3 rounded-xl border border-emerald-200 bg-emerald-50 p-3">
      <div>
        <label
          htmlFor={idData}
          className="mb-1.5 block text-sm font-medium text-emerald-900"
        >
          Em que dia o dinheiro caiu?
        </label>

        <input
          id={idData}
          type="date"
          value={data}
          max={hoje()}
          onChange={(evento) => setData(evento.target.value)}
          className="h-12 w-full rounded-xl border border-emerald-300 bg-white px-3 text-base text-neutral-900 focus:border-emerald-600 focus:ring-2 focus:ring-emerald-200 focus:outline-none"
        />
      </div>

      {erro && (
        <p role="alert" className="text-sm text-rose-700">
          {erro}
        </p>
      )}

      <div className="flex gap-3">
        <button
          type="button"
          onClick={() => setAberto(false)}
          disabled={salvando}
          className="h-12 flex-1 rounded-xl border border-neutral-300 bg-white font-medium text-neutral-700 active:bg-neutral-100 disabled:opacity-60"
        >
          Cancelar
        </button>

        <button
          type="button"
          onClick={confirmar}
          disabled={salvando}
          className="h-12 flex-1 rounded-xl bg-emerald-600 font-medium text-white active:bg-emerald-700 disabled:opacity-60"
        >
          {salvando ? "Confirmando…" : "Confirmar"}
        </button>
      </div>
    </div>
  );
}
