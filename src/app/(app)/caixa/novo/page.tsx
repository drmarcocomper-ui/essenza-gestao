import type { Metadata } from "next";

import { criarLancamento } from "@/app/(app)/caixa/actions";
import FormularioLancamento from "@/components/caixa/FormularioLancamento";
import { listarCategorias, listarInstituicoes } from "@/lib/caixa/consultas";

export const metadata: Metadata = {
  title: "Novo lançamento — Essenza",
};

export default async function NovoLancamentoPage({
  searchParams,
}: PageProps<"/caixa/novo">) {
  const { tipo } = await searchParams;

  // O botão da lista já diz o que ela quer lançar; o formulário continua
  // deixando trocar.
  const tipoInicial = tipo === "saida" ? "Saída" : "Entrada";

  const [categorias, instituicoes] = await Promise.all([
    listarCategorias(),
    listarInstituicoes(),
  ]);

  return (
    <div className="space-y-4">
      <h2 className="text-lg font-semibold text-neutral-900">
        Novo lançamento
      </h2>

      <FormularioLancamento
        acao={criarLancamento}
        tipoInicial={tipoInicial}
        categorias={categorias}
        instituicoes={instituicoes}
        rotuloEnviar="Lançar"
        cancelarHref="/caixa"
      />
    </div>
  );
}
