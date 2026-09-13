"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import { usePathname, useRouter } from "next/navigation";
import { Loader2, Search, X } from "lucide-react";

/** Tempo de espera depois da última tecla antes de consultar o servidor. */
const DEBOUNCE_MS = 300;

type Props = {
  termo: string;
  incluirInativos: boolean;
};

/**
 * Campo de busca no topo da lista.
 *
 * O que a usuária digita fica em estado local (o cursor não pode pular
 * enquanto ela digita); a URL é atualizada com atraso, e é a URL que
 * manda no resultado — assim o voltar do navegador funciona e o link da
 * busca pode ser guardado.
 */
export default function BuscaClientes({ termo, incluirInativos }: Props) {
  const router = useRouter();
  const pathname = usePathname();
  const [rascunho, setRascunho] = useState(termo);
  const [pendente, iniciarTransicao] = useTransition();
  const campo = useRef<HTMLInputElement>(null);

  function navegar(proximoTermo: string, proximosInativos: boolean) {
    const params = new URLSearchParams();

    if (proximoTermo.trim()) params.set("q", proximoTermo.trim());
    if (proximosInativos) params.set("inativas", "1");

    const query = params.toString();

    iniciarTransicao(() => {
      // replace, não push: digitar não pode encher o histórico de voltas.
      router.replace(query ? `${pathname}?${query}` : pathname, {
        scroll: false,
      });
    });
  }

  useEffect(() => {
    // Já sincronizado (inclusive logo após a navegação terminar).
    if (rascunho.trim() === termo) return;

    const relogio = setTimeout(
      () => navegar(rascunho, incluirInativos),
      DEBOUNCE_MS,
    );

    return () => clearTimeout(relogio);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [rascunho, termo, incluirInativos]);

  function limpar() {
    setRascunho("");
    navegar("", incluirInativos);
    campo.current?.focus();
  }

  return (
    <div className="space-y-2">
      <div className="relative">
        <Search
          aria-hidden="true"
          className="pointer-events-none absolute top-1/2 left-3 size-5 -translate-y-1/2 text-neutral-400"
        />

        <input
          ref={campo}
          type="search"
          name="q"
          value={rascunho}
          onChange={(evento) => setRascunho(evento.target.value)}
          placeholder="Buscar por nome ou telefone"
          aria-label="Buscar por nome ou telefone"
          enterKeyHint="search"
          autoComplete="off"
          autoCorrect="off"
          className="h-12 w-full rounded-xl border border-neutral-300 bg-white pr-12 pl-11 text-base text-neutral-900 placeholder:text-neutral-400 focus:border-rose-500 focus:ring-2 focus:ring-rose-200 focus:outline-none [&::-webkit-search-cancel-button]:hidden"
        />

        {pendente ? (
          <Loader2
            aria-hidden="true"
            className="absolute top-1/2 right-4 size-5 -translate-y-1/2 animate-spin text-neutral-400"
          />
        ) : (
          rascunho.length > 0 && (
            <button
              type="button"
              onClick={limpar}
              aria-label="Limpar busca"
              className="absolute top-1/2 right-0 flex size-12 -translate-y-1/2 items-center justify-center text-neutral-400 active:text-neutral-700"
            >
              <X aria-hidden="true" className="size-5" />
            </button>
          )
        )}
      </div>

      <label className="flex min-h-11 w-fit items-center gap-2 text-sm text-neutral-600">
        <input
          type="checkbox"
          checked={incluirInativos}
          onChange={(evento) => navegar(rascunho, evento.target.checked)}
          className="size-5 rounded border-neutral-300 accent-rose-600"
        />
        Mostrar inativas
      </label>
    </div>
  );
}
