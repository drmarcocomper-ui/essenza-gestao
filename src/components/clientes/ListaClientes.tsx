"use client";

import { useState, useTransition } from "react";
import { UserRound } from "lucide-react";

import { carregarMaisClientes } from "@/app/(app)/clientes/actions";
import type { ClienteResumo, PaginaClientes } from "@/lib/clientes/consultas";

import CardCliente from "./CardCliente";

type Props = {
  paginaInicial: PaginaClientes;
  termo: string;
  incluirInativos: boolean;
};

/**
 * Lista com carregamento incremental.
 *
 * A primeira página vem renderizada do servidor; as seguintes chegam por
 * server action e são empilhadas. O componente é remontado (key na page)
 * quando o filtro muda, então o estado não precisa se sincronizar.
 */
export default function ListaClientes({
  paginaInicial,
  termo,
  incluirInativos,
}: Props) {
  const [clientes, setClientes] = useState<ClienteResumo[]>(
    paginaInicial.clientes,
  );
  const [pagina, setPagina] = useState(0);
  const [temMais, setTemMais] = useState(paginaInicial.temMais);
  const [erro, setErro] = useState<string | null>(null);
  const [carregando, iniciarTransicao] = useTransition();

  function carregarMais() {
    iniciarTransicao(async () => {
      setErro(null);

      try {
        const proxima = await carregarMaisClientes({
          termo,
          incluirInativos,
          pagina: pagina + 1,
        });

        setClientes((atuais) => [...atuais, ...proxima.clientes]);
        setPagina((atual) => atual + 1);
        setTemMais(proxima.temMais);
      } catch {
        setErro("Não foi possível carregar mais. Tente de novo.");
      }
    });
  }

  if (clientes.length === 0) {
    return (
      <div className="rounded-2xl border border-dashed border-neutral-300 px-4 py-10 text-center">
        <UserRound
          aria-hidden="true"
          className="mx-auto size-8 text-neutral-300"
        />
        <p className="mt-3 text-neutral-600">
          {termo
            ? `Nenhuma cliente encontrada para "${termo}".`
            : "Nenhuma cliente cadastrada ainda."}
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <p aria-live="polite" className="text-sm text-neutral-500">
        {paginaInicial.total === 1
          ? "1 cliente"
          : `${paginaInicial.total} clientes`}
      </p>

      <ul className="space-y-2">
        {clientes.map((cliente) => (
          <li key={cliente.id}>
            <CardCliente cliente={cliente} />
          </li>
        ))}
      </ul>

      {erro && (
        <p role="alert" className="text-sm text-rose-700">
          {erro}
        </p>
      )}

      {temMais && (
        <button
          type="button"
          onClick={carregarMais}
          disabled={carregando}
          className="h-12 w-full rounded-xl border border-neutral-300 bg-white font-medium text-neutral-700 active:bg-neutral-100 disabled:opacity-60"
        >
          {carregando ? "Carregando…" : "Carregar mais"}
        </button>
      )}
    </div>
  );
}
