import type { Metadata } from "next";
import { notFound } from "next/navigation";

import { criarAtendimento } from "@/app/(app)/clientes/[id]/atendimentos/actions";
import FormularioAtendimento from "@/components/atendimentos/FormularioAtendimento";
import { listarServicos } from "@/lib/atendimentos/consultas";
import { obterCliente } from "@/lib/clientes/consultas";

export const metadata: Metadata = {
  title: "Novo atendimento — Essenza",
};

export default async function NovoAtendimentoPage({
  params,
}: PageProps<"/clientes/[id]/atendimentos/novo">) {
  const { id } = await params;

  const [cliente, servicos] = await Promise.all([
    obterCliente(id),
    listarServicos(),
  ]);

  if (!cliente) {
    notFound();
  }

  return (
    <div className="space-y-4">
      <div>
        <h2 className="text-lg font-semibold text-neutral-900">
          Novo atendimento
        </h2>
        <p className="text-sm text-neutral-500">{cliente.nome}</p>
      </div>

      <FormularioAtendimento
        // O id vem amarrado no servidor: não trafega em campo escondido.
        acao={criarAtendimento.bind(null, cliente.id)}
        servicos={servicos}
        cancelarHref={`/clientes/${cliente.id}`}
      />
    </div>
  );
}
