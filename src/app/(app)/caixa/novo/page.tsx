import type { Metadata } from "next";

import { criarLancamento } from "@/app/(app)/caixa/actions";
import FormularioLancamento from "@/components/caixa/FormularioLancamento";
import Voltar from "@/components/layout/Voltar";
import { listarCategorias, listarInstituicoes } from "@/lib/caixa/consultas";
import { voltaDaOrigem } from "@/lib/caixa/url";

export const metadata: Metadata = {
  title: "Novo lançamento — Essenza",
};

export default async function NovoLancamentoPage({
  searchParams,
}: PageProps<"/caixa/novo">) {
  const { tipo, origem } = await searchParams;
  const volta = voltaDaOrigem(origem);

  // O botão da lista já diz o que ela quer lançar; o formulário continua
  // deixando trocar.
  const tipoInicial = tipo === "saida" ? "Saída" : "Entrada";

  const [categorias, instituicoes] = await Promise.all([
    listarCategorias(),
    listarInstituicoes(),
  ]);

  return (
    <div className="space-y-4">
      <Voltar href={volta.href} rotulo={volta.rotulo} />

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
