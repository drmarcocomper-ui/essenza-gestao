import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Scissors } from "lucide-react";

import { atualizarPeca } from "@/app/(app)/produtos/extensao/actions";
import BotaoDesfazerDesmembramento from "@/components/produtos/BotaoDesfazerDesmembramento";
import BotaoExcluirPeca from "@/components/produtos/BotaoExcluirPeca";
import FormularioPeca from "@/components/produtos/FormularioPeca";
import {
  listarPartes,
  listarSugestoes,
  obterPeca,
} from "@/lib/pecas-extensao/consultas";
import { compararCodigos, travasDaPeca } from "@/lib/pecas-extensao/regras";

export const metadata: Metadata = {
  title: "Editar peça — Essenza",
};

export default async function EditarPecaPage({
  params,
}: PageProps<"/produtos/extensao/[id]">) {
  const { id } = await params;

  const peca = await obterPeca(id);

  if (!peca) {
    notFound();
  }

  const [partes, mae, { cores, texturas, origens }] = await Promise.all([
    listarPartes(peca.id),
    peca.pecaMaeId ? obterPeca(peca.pecaMaeId) : null,
    listarSugestoes(),
  ]);

  const temFilhas = partes.length > 0;
  const travas = travasDaPeca({ ...peca, temFilhas });

  return (
    <div className="space-y-4">
      <div>
        <h2 className="text-lg font-semibold text-neutral-900">
          Peça {peca.codigo}
        </h2>

        {/* Parte: o caminho até o Desfazer, que mora na mãe. */}
        {mae && (
          <Link
            href={`/produtos/extensao/${mae.id}`}
            className="-ml-2 inline-flex min-h-11 items-center rounded-xl px-2 text-sm text-rose-700 active:bg-rose-50"
          >
            Parte da peça {mae.codigo}
          </Link>
        )}
      </div>

      <FormularioPeca
        // O id vem amarrado no servidor: não trafega em campo escondido.
        acao={atualizarPeca.bind(null, peca.id)}
        peca={peca}
        codigoTravado={travas.codigoTravado}
        motivoCustoTravado={travas.motivoCustoTravado}
        cores={cores}
        texturas={texturas}
        origens={origens}
        rotuloEnviar="Salvar"
      />

      <div className="border-t border-neutral-200 pt-4">
        {temFilhas ? (
          <BotaoDesfazerDesmembramento
            maeId={peca.id}
            codigo={peca.codigo}
            partes={partes
              .map((parte) => parte.codigo)
              .sort(compararCodigos)}
          />
        ) : travas.motivoNaoDesmembra ? (
          <p className="text-sm text-neutral-500">{travas.motivoNaoDesmembra}</p>
        ) : (
          <Link
            href={`/produtos/extensao/${peca.id}/desmembrar`}
            className="flex h-12 w-full items-center justify-center gap-2 rounded-xl border border-neutral-300 bg-white font-medium text-neutral-700 active:bg-neutral-100"
          >
            <Scissors aria-hidden="true" className="size-5" />
            Desmembrar
          </Link>
        )}
      </div>

      <div className="border-t border-neutral-200 pt-4">
        {travas.motivoExclusaoTravada ? (
          <p className="text-sm text-neutral-500">
            {travas.motivoExclusaoTravada}
          </p>
        ) : (
          <BotaoExcluirPeca id={peca.id} codigo={peca.codigo} />
        )}
      </div>
    </div>
  );
}
