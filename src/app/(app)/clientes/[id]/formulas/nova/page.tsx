import type { Metadata } from "next";
import { notFound } from "next/navigation";

import { criarFormula } from "@/app/(app)/clientes/[id]/formulas/actions";
import FormularioFormula from "@/components/formulas/FormularioFormula";
import { obterCliente } from "@/lib/clientes/consultas";
import { obterFormula } from "@/lib/formulas/consultas";
import { valoresParaRepetir } from "@/lib/formulas/repetir";

export const metadata: Metadata = {
  title: "Nova fórmula — Essenza",
};

/** Só aceita uuid: o parâmetro vem da URL e é usado para buscar no banco. */
function idNaBusca(valor: string | string[] | undefined) {
  return typeof valor === "string" && valor.length > 0 ? valor : null;
}

export default async function NovaFormulaPage({
  params,
  searchParams,
}: PageProps<"/clientes/[id]/formulas/nova">) {
  const { id } = await params;
  const { repetir, atendimento } = await searchParams;

  const cliente = await obterCliente(id);

  if (!cliente) {
    notFound();
  }

  const repetirId = idNaBusca(repetir);

  // `obterFormula` já filtra pela cliente da rota: um id de outra pessoa
  // na URL não devolve nada, e o formulário abre em branco.
  const origem = repetirId ? await obterFormula(cliente.id, repetirId) : null;

  return (
    <div className="space-y-4">
      <div>
        <h2 className="text-lg font-semibold text-neutral-900">
          {origem ? "Repetir fórmula" : "Nova fórmula"}
        </h2>
        <p className="text-sm text-neutral-500">{cliente.nome}</p>
      </div>

      <FormularioFormula
        // O id vem amarrado no servidor: não trafega em campo escondido.
        acao={criarFormula.bind(null, cliente.id)}
        inicial={valoresParaRepetir(origem)}
        anterior={
          origem
            ? {
                data: origem.data,
                resultado: origem.resultado,
                observacao: origem.observacao,
              }
            : null
        }
        atendimentoId={idNaBusca(atendimento)}
        cancelarHref={`/clientes/${cliente.id}`}
      />
    </div>
  );
}
