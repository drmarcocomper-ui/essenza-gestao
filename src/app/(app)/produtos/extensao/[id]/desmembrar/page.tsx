import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";

import FormularioDesmembrar from "@/components/produtos/FormularioDesmembrar";
import {
  listarSugestoes,
  obterPeca,
  pecaTemFilhas,
} from "@/lib/pecas-extensao/consultas";
import { travasDaPeca } from "@/lib/pecas-extensao/regras";

export const metadata: Metadata = {
  title: "Desmembrar peça — Essenza",
};

/**
 * Corta a peça em partes. Peça que não pode ser desmembrada (já tem
 * partes, ou sem preço de compra) mostra o motivo em vez do formulário:
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

  const [temFilhas, { cores, texturas, origens }] = await Promise.all([
    pecaTemFilhas(mae.id),
    listarSugestoes(),
  ]);

  const { motivoNaoDesmembra } = travasDaPeca({ ...mae, temFilhas });

  return (
    <div className="space-y-4">
      <h2 className="text-lg font-semibold text-neutral-900">
        Desmembrar peça {mae.codigo}
      </h2>

      {motivoNaoDesmembra || mae.precoCompra === null ? (
        <div className="space-y-4">
          <p className="rounded-xl border border-neutral-200 bg-white px-4 py-3 text-sm text-neutral-700">
            {motivoNaoDesmembra}
          </p>

          <Link
            href={`/produtos/extensao/${mae.id}`}
            className="flex h-12 items-center justify-center rounded-xl border border-neutral-300 bg-white font-medium text-neutral-700 active:bg-neutral-100"
          >
            Voltar para a peça
          </Link>
        </div>
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
