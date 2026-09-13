"use client";

import { useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Camera, Loader2, Trash2 } from "lucide-react";

import {
  registrarFoto,
  removerFoto,
} from "@/app/(app)/clientes/[id]/formulas/actions";
import {
  classificarFalhaUpload,
  type EtapaUpload,
  type FalhaUpload,
} from "@/lib/formulas/erros";
import { reduzirImagem } from "@/lib/formulas/imagem";
import { MOMENTOS, ROTULO_MOMENTO, type Momento } from "@/lib/formulas/schema";
import { BUCKET_FORMULAS, caminhoFoto } from "@/lib/formulas/storage";
import { createClient } from "@/lib/supabase/client";

/**
 * O erro real do Supabase vai para o console fora de produção — mesmo
 * arranjo do login. Em produção fica de fora: a tela não é lugar de
 * detalhe interno, e o DevTools do celular é público demais.
 */
function registrarFalha(etapa: EtapaUpload, erro: unknown) {
  if (process.env.NODE_ENV === "production") return;

  console.error(`Falha ao ${etapa} a foto:`, erro);
}

/** Rastro do que foi tentado, para ler junto com a falha. */
function registrarPasso(passo: string, dados: Record<string, unknown>) {
  if (process.env.NODE_ENV === "production") return;

  console.info(`Foto — ${passo}:`, dados);
}

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
  const [erro, setErro] = useState<FalhaUpload | null>(null);
  const [confirmando, setConfirmando] = useState(false);
  const [removendo, iniciarRemocao] = useTransition();

  const imagem = previa ?? url;

  async function enviar(arquivo: File) {
    setErro(null);
    setEnviando(true);

    // Em qual passo parou: é o que separa "arquivo ruim" de "policy
    // errada" na hora de escrever a mensagem.
    let etapa: EtapaUpload = "preparar";

    try {
      const reduzida = await reduzirImagem(arquivo);

      etapa = "enviar";

      const caminho = caminhoFoto(clienteId, formulaId, momento);

      registrarPasso("vai subir", {
        caminho,
        bucket: BUCKET_FORMULAS,
        bytes: reduzida.size,
        tipo: reduzida.type,
      });

      const supabase = createClient();

      const { error } = await supabase.storage
        .from(BUCKET_FORMULAS)
        .upload(caminho, reduzida, {
          contentType: "image/jpeg",
          // Refazer a foto substitui a anterior: o caminho é o mesmo e a
          // fórmula continua com no máximo duas.
          upsert: true,
        });

      // Repassa o erro inteiro, não só a mensagem: `status` e
      // `statusCode` são o que distingue permissão de limite de tamanho.
      if (error) throw error;

      etapa = "registrar";
      await registrarFoto(clienteId, formulaId, momento);

      // Mostra o que acabou de subir sem esperar a próxima URL assinada.
      setPrevia((anterior) => {
        if (anterior) URL.revokeObjectURL(anterior);
        return URL.createObjectURL(reduzida);
      });

      router.refresh();
    } catch (falha) {
      registrarFalha(etapa, falha);

      setErro(
        classificarFalhaUpload(
          etapa,
          falha,
          // navigator.onLine só é confiável no negativo: false é offline
          // de verdade, true não promete que a internet funciona.
          typeof navigator === "undefined" ? true : navigator.onLine,
        ),
      );
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
      } catch (falha) {
        registrarFalha("registrar", falha);
        setErro({
          texto: "Não foi possível apagar. Tente de novo.",
          podeTentarDeNovo: true,
        });
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
        /* Dois tons porque são dois destinos: âmbar é "tenta de novo",
           vermelho é "não adianta insistir, chama o Marco". */
        <p
          role="alert"
          className={`rounded-lg px-2 py-1.5 text-sm ${
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
