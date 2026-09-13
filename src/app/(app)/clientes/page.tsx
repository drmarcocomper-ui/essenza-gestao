import type { Metadata } from "next";
import Link from "next/link";
import { Plus } from "lucide-react";

import BuscaClientes from "@/components/clientes/BuscaClientes";
import ListaClientes from "@/components/clientes/ListaClientes";
import { listarClientes } from "@/lib/clientes/consultas";

export const metadata: Metadata = {
  title: "Clientes — Essenza",
};

export default async function ClientesPage({
  searchParams,
}: PageProps<"/clientes">) {
  const { q, inativas } = await searchParams;

  const termo = typeof q === "string" ? q : "";
  const incluirInativos = inativas === "1";

  const paginaInicial = await listarClientes({ termo, incluirInativos });

  return (
    <div className="space-y-4">
      <BuscaClientes termo={termo} incluirInativos={incluirInativos} />

      <ListaClientes
        // Filtro novo é lista nova: remonta em vez de sincronizar estado.
        key={`${termo}|${incluirInativos}`}
        paginaInicial={paginaInicial}
        termo={termo}
        incluirInativos={incluirInativos}
      />

      {/* Acima da BottomNav (h-14) e no canto do polegar. */}
      <Link
        href="/clientes/novo"
        aria-label="Cadastrar cliente"
        className="fixed right-4 bottom-[calc(4.5rem+env(safe-area-inset-bottom))] z-30 flex size-14 items-center justify-center rounded-full bg-rose-600 text-white shadow-lg active:bg-rose-700"
      >
        <Plus aria-hidden="true" className="size-7" />
      </Link>
    </div>
  );
}
