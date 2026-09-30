import type { Metadata } from "next";
import { notFound } from "next/navigation";

import Voltar from "@/components/layout/Voltar";
import FormularioDesmembrar from "@/components/produtos/FormularioDesmembrar";
import {
  listarSugestoes,
  obterContaDaPeca,
  obterPeca,
  pecaTemFilhas,
} from "@/lib/pecas-extensao/consultas";
import { travasDaPeca } from "@/lib/pecas-extensao/regras";

export const metadata: Metadata = {
  title: "Desmembrar peça — Essenza",
};

/**
 * Corta a peça em partes. Peça que não pode ser desmembrada (já tem
 * partes, sem preço de compra, ou numa conta) mostra o motivo em vez do formulário:
 * alguém pode chegar aqui por um link antigo.
 */
export default async function DesmembrarPecaPage({
  params,
}: PageProps<"/produtos/extensao/[id]/desmembrar">) {
  const { id } = await params;

  const mae = await obterPeca(id);

  if (!mae) {
    notFound();
  }

  const [temFilhas, conta, { cores, texturas, origens }] = await Promise.all([
    pecaTemFilhas(mae.id),
    obterContaDaPeca(mae.id),
    listarSugestoes(),
  ]);

  const { motivoNaoDesmembra } = travasDaPeca({ ...mae, temFilhas, conta });

  return (
    <div className="space-y-4">
      <Voltar href={`/produtos/extensao/${mae.id}`} rotulo={`Peça ${mae.codigo}`} />

      <h2 className="text-lg font-semibold text-neutral-900">
        Desmembrar peça {mae.codigo}
      </h2>

      {motivoNaoDesmembra || mae.precoCompra === null ? (
        <p className="rounded-xl border border-neutral-200 bg-white px-4 py-3 text-sm text-neutral-700">
          {motivoNaoDesmembra}
        </p>
      ) : (
        <FormularioDesmembrar
          mae={mae}
          custoMae={mae.precoCompra}
          cores={cores}
          texturas={texturas}
          origens={origens}
        />
      )}
    </div>
  );
}
