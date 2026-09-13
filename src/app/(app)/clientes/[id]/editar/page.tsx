import type { Metadata } from "next";
import { notFound } from "next/navigation";

import { atualizarCliente } from "@/app/(app)/clientes/actions";
import FormularioCliente from "@/components/clientes/FormularioCliente";
import { obterCliente } from "@/lib/clientes/consultas";

export const metadata: Metadata = {
  title: "Editar cliente — Essenza",
};

export default async function EditarClientePage({
  params,
}: PageProps<"/clientes/[id]/editar">) {
  const { id } = await params;

  const cliente = await obterCliente(id);

  if (!cliente) {
    notFound();
  }

  return (
    <div className="space-y-4">
      <h2 className="text-lg font-semibold text-neutral-900">
        Editar cadastro
      </h2>

      <FormularioCliente
        // O id vem amarrado no servidor: não trafega em campo escondido.
        acao={atualizarCliente.bind(null, cliente.id)}
        cliente={cliente}
        rotuloEnviar="Salvar"
        cancelarHref={`/clientes/${cliente.id}`}
      />
    </div>
  );
}
