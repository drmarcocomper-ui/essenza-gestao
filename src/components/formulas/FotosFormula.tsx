"use client";

import { useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Camera, Loader2, Trash2 } from "lucide-react";

import {
  registrarFoto,
  removerFoto,
} from "@/app/(app)/clientes/[id]/formulas/actions";
import { reduzirImagem } from "@/lib/formulas/imagem";
import { MOMENTOS, ROTULO_MOMENTO, type Momento } from "@/lib/formulas/schema";
import { BUCKET_FORMULAS, caminhoFoto } from "@/lib/formulas/storage";
import { createClient } from "@/lib/supabase/client";

export type FotoNaFicha = {
  momento: Momento;
  /** URL assinada, curta. Null quando o arquivo sumiu do bucket. */
  url: string | null;
};

type Props = {
  clienteId: string;
  formulaId: string;
  fotos: FotoNaFicha[];
};

/**
 * Antes e depois — duas fotos por fórmula, nunca mais que isso.
 *
 * A foto é reduzida no próprio navegador antes de subir (1600px, JPEG
 * 0.8): o arquivo do iPhone tem 3 a 12 MB e o envio precisa terminar
 * enquanto ela ainda está com a cliente na cadeira.
 *
 * A fórmula já está salva quando esta tela abre. Se o upload falhar,
 * falha só o upload: nada do que ela digitou se perde, e o botão volta
 * ao estado inicial para tentar de novo.
 */
export default function FotosFormula({ clienteId, formulaId, fotos }: Props) {
  const porMomento = new Map(fotos.map((foto) => [foto.momento, foto.url]));

  return (
    <div className="grid grid-cols-2 gap-3">
      {MOMENTOS.map((momento) => (
        <Slot
          key={momento}
          clienteId={clienteId}
          formulaId={formulaId}
          momento={momento}
          url={porMomento.get(momento) ?? null}
        />
      ))}
    </div>
  );
}

function Slot({
  clienteId,
  formulaId,
  momento,
  url,
}: {
  clienteId: string;
  formulaId: string;
  momento: Momento;
  url: string | null;
}) {
  const router = useRouter();
  const entrada = useRef<HTMLInputElement>(null);

  /** Prévia local: aparece antes de a URL assinada voltar do servidor. */
  const [previa, setPrevia] = useState<string | null>(null);
  const [enviando, setEnviando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);
  const [confirmando, setConfirmando] = useState(false);
  const [removendo, iniciarRemocao] = useTransition();

  const imagem = previa ?? url;

  async function enviar(arquivo: File) {
    setErro(null);
    setEnviando(true);

    try {
      const reduzida = await reduzirImagem(arquivo);

      const supabase = createClient();

      const { error } = await supabase.storage
        .from(BUCKET_FORMULAS)
        .upload(caminhoFoto(clienteId, formulaId, momento), reduzida, {
          contentType: "image/jpeg",
          // Refazer a foto substitui a anterior: o caminho é o mesmo e a
          // fórmula continua com no máximo duas.
          upsert: true,
        });

      if (error) throw new Error(error.message);

      await registrarFoto(clienteId, formulaId, momento);

      // Mostra o que acabou de subir sem esperar a próxima URL assinada.
      setPrevia((anterior) => {
        if (anterior) URL.revokeObjectURL(anterior);
        return URL.createObjectURL(reduzida);
      });

      router.refresh();
    } catch {
      // A mensagem do servidor vira texto genérico em produção; o aviso
      // útil aqui é o que ela pode fazer a respeito.
      setErro("Não foi possível enviar. Tente de novo.");
    } finally {
      setEnviando(false);
      // Libera o input para reenviar o mesmo arquivo, se for o caso.
      if (entrada.current) entrada.current.value = "";
    }
  }

  function remover() {
    iniciarRemocao(async () => {
      setErro(null);

      try {
        await removerFoto(clienteId, formulaId, momento);

        setPrevia((anterior) => {
          if (anterior) URL.revokeObjectURL(anterior);
          return null;
        });

        setConfirmando(false);
        router.refresh();
      } catch {
        setErro("Não foi possível apagar. Tente de novo.");
        setConfirmando(false);
      }
    });
  }

  return (
    <div className="space-y-2">
      <p className="text-sm font-medium text-neutral-700">
        {ROTULO_MOMENTO[momento]}
      </p>

      <div className="relative aspect-3/4 overflow-hidden rounded-2xl border border-neutral-200 bg-neutral-100">
        {imagem ? (
          /* URL assinada com validade de minutos: o otimizador do
             next/image cacheia pelo endereço e acabaria servindo uma URL
             já vencida. */
          /* eslint-disable-next-line @next/next/no-img-element */
          <img
            src={imagem}
            alt={`Foto ${ROTULO_MOMENTO[momento].toLowerCase()}`}
            className="size-full object-cover"
          />
        ) : (
          <div className="flex size-full items-center justify-center text-neutral-300">
            <Camera aria-hidden="true" className="size-10" />
          </div>
        )}

        {enviando && (
          <div className="absolute inset-0 flex items-center justify-center bg-white/70">
            <Loader2
              aria-hidden="true"
              className="size-8 animate-spin text-rose-600"
            />
            <span className="sr-only">Enviando a foto…</span>
          </div>
        )}
      </div>

      <input
        ref={entrada}
        id={`foto-${momento}`}
        type="file"
        accept="image/*"
        className="sr-only"
        onChange={(evento) => {
          const arquivo = evento.target.files?.[0];
          if (arquivo) void enviar(arquivo);
        }}
      />

      <label
        htmlFor={`foto-${momento}`}
        className="flex h-12 w-full items-center justify-center gap-2 rounded-xl border border-neutral-300 bg-white text-sm font-medium text-neutral-700 active:bg-neutral-100"
      >
        <Camera aria-hidden="true" className="size-5" />
        {imagem ? "Trocar" : "Adicionar"}
      </label>

      {imagem &&
        (confirmando ? (
          <div className="flex gap-2">
            <button
              type="button"
              onClick={() => setConfirmando(false)}
              className="h-11 flex-1 rounded-xl border border-neutral-300 bg-white text-sm font-medium text-neutral-700 active:bg-neutral-100"
            >
              Cancelar
            </button>

            <button
              type="button"
              onClick={remover}
              disabled={removendo}
              className="h-11 flex-1 rounded-xl bg-rose-600 text-sm font-medium text-white active:bg-rose-700 disabled:opacity-60"
            >
              {removendo ? "…" : "Apagar"}
            </button>
          </div>
        ) : (
          <button
            type="button"
            onClick={() => setConfirmando(true)}
            className="flex h-11 w-full items-center justify-center gap-2 rounded-xl text-sm font-medium text-neutral-500 active:bg-neutral-100"
          >
            <Trash2 aria-hidden="true" className="size-4" />
            Apagar
          </button>
        ))}

      {erro && (
        <p role="alert" className="text-sm text-rose-700">
          {erro}
        </p>
      )}
    </div>
  );
}
