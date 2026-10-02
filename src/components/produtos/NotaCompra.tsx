"use client";

import { useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { FileText, Loader2, Paperclip, Trash2 } from "lucide-react";

import { removerNota } from "@/app/(app)/produtos/compras/actions";
import { enviarNota } from "@/components/produtos/enviarNota";
import type { ExtensaoNota, FalhaNota } from "@/lib/estoque/nota";

export type NotaNaTela = {
  extensao: ExtensaoNota;
  /** URL assinada, curta. Null quando o arquivo sumiu do bucket. */
  url: string | null;
};

/** O tipo de arquivo que o seletor oferece: PDF ou qualquer foto. */
export const ACEITA_NOTA = "application/pdf,image/*,.heic,.heif";

/**
 * A nota fiscal da compra: ver, trocar, apagar. A compra já está salva
 * aqui — uma falha de envio é só da nota, e o botão volta para tentar
 * de novo.
 */
export default function NotaCompra({
  compraId,
  nota,
  falhaAnterior = false,
}: {
  compraId: string;
  nota: NotaNaTela | null;
  /** Veio da Nova compra com a nota que não subiu. */
  falhaAnterior?: boolean;
}) {
  const router = useRouter();
  const entrada = useRef<HTMLInputElement>(null);
  const [enviando, setEnviando] = useState(false);
  const [erro, setErro] = useState<FalhaNota | null>(
    falhaAnterior
      ? {
          texto: "A compra foi salva, mas a nota não subiu. Mande de novo aqui.",
          podeTentarDeNovo: true,
        }
      : null,
  );
  const [confirmando, setConfirmando] = useState(false);
  const [removendo, iniciarRemocao] = useTransition();

  async function enviar(arquivo: File) {
    setErro(null);
    setEnviando(true);

    const falha = await enviarNota(compraId, arquivo);

    setEnviando(false);
    // Libera o input para reenviar o mesmo arquivo, se for o caso.
    if (entrada.current) entrada.current.value = "";

    if (falha) {
      setErro(falha);
      return;
    }

    router.refresh();
  }

  function remover() {
    iniciarRemocao(async () => {
      setErro(null);

      try {
        const resultado = await removerNota(compraId);

        if (resultado.erro) {
          setErro({ texto: resultado.erro, podeTentarDeNovo: true });
        }

        setConfirmando(false);
        router.refresh();
      } catch {
        setErro({
          texto: "Não foi possível apagar. Tente de novo.",
          podeTentarDeNovo: true,
        });
        setConfirmando(false);
      }
    });
  }

  return (
    <div className="space-y-3">
      {nota &&
        (nota.url === null ? (
          <p className="rounded-xl border border-dashed border-neutral-300 px-3 py-4 text-center text-sm text-neutral-500">
            O arquivo da nota não foi encontrado. Mande de novo.
          </p>
        ) : nota.extensao === "pdf" ? (
          <a
            href={nota.url}
            target="_blank"
            rel="noopener noreferrer"
            className="flex h-12 w-full items-center justify-center gap-2 rounded-xl border border-neutral-300 bg-white font-medium text-neutral-700 active:bg-neutral-100"
          >
            <FileText aria-hidden="true" className="size-5" />
            Abrir nota (PDF)
          </a>
        ) : (
          <a href={nota.url} target="_blank" rel="noopener noreferrer">
            {/* URL assinada com validade de minutos: o otimizador do
                next/image cacheia pelo endereço e serviria uma vencida. */}
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={nota.url}
              alt="Foto da nota fiscal"
              className="max-h-96 w-full rounded-2xl border border-neutral-200 bg-neutral-100 object-contain"
            />
          </a>
        ))}

      <input
        ref={entrada}
        id={`nota-${compraId}`}
        type="file"
        accept={ACEITA_NOTA}
        className="sr-only"
        onChange={(evento) => {
          const arquivo = evento.target.files?.[0];
          if (arquivo) void enviar(arquivo);
        }}
      />

      <label
        htmlFor={`nota-${compraId}`}
        aria-disabled={enviando}
        className={`flex h-12 w-full items-center justify-center gap-2 rounded-xl border border-neutral-300 bg-white font-medium text-neutral-700 active:bg-neutral-100 ${
          enviando ? "pointer-events-none opacity-60" : ""
        }`}
      >
        {enviando ? (
          <Loader2 aria-hidden="true" className="size-5 animate-spin" />
        ) : (
          <Paperclip aria-hidden="true" className="size-5" />
        )}
        {enviando ? "Enviando a nota…" : nota ? "Trocar nota" : "Anexar nota (foto ou PDF)"}
      </label>

      {nota &&
        (confirmando ? (
          <div className="flex gap-3">
            <button
              type="button"
              onClick={() => setConfirmando(false)}
              className="h-12 flex-1 rounded-xl border border-neutral-300 bg-white font-medium text-neutral-700 active:bg-neutral-100"
            >
              Cancelar
            </button>

            <button
              type="button"
              onClick={remover}
              disabled={removendo}
              className="h-12 flex-1 rounded-xl bg-rose-600 font-medium text-white active:bg-rose-700 disabled:opacity-60"
            >
              {removendo ? "Apagando…" : "Apagar nota"}
            </button>
          </div>
        ) : (
          <button
            type="button"
            onClick={() => setConfirmando(true)}
            className="flex h-11 w-full items-center justify-center gap-2 rounded-xl text-sm font-medium text-neutral-500 active:bg-neutral-100"
          >
            <Trash2 aria-hidden="true" className="size-4" />
            Apagar nota
          </button>
        ))}

      {erro && (
        /* Âmbar é "tenta de novo"; vermelho é "chama o Marco". */
        <p
          role="alert"
          className={`rounded-lg px-3 py-2 text-sm ${
            erro.podeTentarDeNovo
              ? "bg-amber-50 text-amber-900"
              : "bg-rose-50 font-medium text-rose-800"
          }`}
        >
          {erro.texto}
        </p>
      )}
    </div>
  );
}
