"use client";

import { useEffect, useId, useRef, useState, useTransition } from "react";
import { Loader2, Search, UserRound, X } from "lucide-react";

import { buscarClientes } from "@/app/(app)/caixa/actions";

/** Tempo de espera depois da última tecla antes de consultar o servidor. */
const DEBOUNCE_MS = 300;

export type ClienteEscolhido = { id: string; nome: string };

/**
 * Escolha da cliente na entrada. Usa a mesma busca do módulo de clientes
 * — sem acento e por telefone também — através de uma server action.
 *
 * Escolhida a cliente, o campo vira um resumo com botão de trocar: o id
 * é o que viaja no formulário, o nome é só para ela conferir.
 */
export default function BuscaCliente({
  clienteInicial = null,
  erro,
}: {
  clienteInicial?: ClienteEscolhido | null;
  erro?: string;
}) {
  const id = useId();
  const idErro = `${id}-erro`;

  const [escolhida, setEscolhida] = useState(clienteInicial);
  const [termo, setTermo] = useState("");
  const [resultados, setResultados] = useState<ClienteEscolhido[]>([]);
  /** Termo que produziu os resultados na tela, para não dizer "nenhuma
   *  cliente" antes de a busca ter acontecido. */
  const [buscado, setBuscado] = useState("");
  const [buscando, iniciarBusca] = useTransition();
  const campo = useRef<HTMLInputElement>(null);

  // Duas letras já bastam para procurar; uma só traria a base inteira.
  const procurando = !escolhida && termo.trim().length >= 2;

  // Só é "nenhuma cliente" depois que a busca deste termo voltou vazia.
  const semResultado =
    procurando && !buscando && buscado === termo.trim() && resultados.length === 0;

  useEffect(() => {
    if (!procurando) return;

    const relogio = setTimeout(() => {
      iniciarBusca(async () => {
        const alvo = termo.trim();

        try {
          setResultados(await buscarClientes(alvo));
        } catch {
          setResultados([]);
        } finally {
          setBuscado(alvo);
        }
      });
    }, DEBOUNCE_MS);

    return () => clearTimeout(relogio);
  }, [termo, procurando]);

  function trocar() {
    setEscolhida(null);
    setTermo("");
    // O campo de busca só existe agora: espera o próximo quadro.
    requestAnimationFrame(() => campo.current?.focus());
  }

  return (
    <div>
      <label
        htmlFor={id}
        className="mb-1.5 block text-sm font-medium text-neutral-700"
      >
        Cliente <span className="text-rose-600">*</span>
      </label>

      {/* O formulário manda sempre a chave, mesmo vazia: o schema é quem
          decide que entrada sem cliente é erro. */}
      <input type="hidden" name="cliente_id" value={escolhida?.id ?? ""} />

      {escolhida ? (
        <div className="flex items-center gap-2 rounded-xl border border-neutral-300 bg-white px-3">
          <UserRound aria-hidden="true" className="size-5 text-neutral-400" />

          <p className="min-w-0 flex-1 truncate py-3 font-medium text-neutral-900">
            {escolhida.nome}
          </p>

          <button
            type="button"
            onClick={trocar}
            className="-mr-1 flex h-12 min-w-11 items-center justify-center px-2 text-sm font-medium text-rose-700 active:text-rose-900"
          >
            Trocar
          </button>
        </div>
      ) : (
        <div className="space-y-2">
          <div className="relative">
            <Search
              aria-hidden="true"
              className="pointer-events-none absolute top-1/2 left-3 size-5 -translate-y-1/2 text-neutral-400"
            />

            <input
              ref={campo}
              id={id}
              type="search"
              value={termo}
              onChange={(evento) => setTermo(evento.target.value)}
              placeholder="Buscar por nome ou telefone"
              enterKeyHint="search"
              autoComplete="off"
              autoCorrect="off"
              aria-invalid={erro ? true : undefined}
              aria-describedby={erro ? idErro : undefined}
              className={`h-12 w-full rounded-xl border bg-white pr-12 pl-11 text-base text-neutral-900 placeholder:text-neutral-400 focus:ring-2 focus:ring-rose-200 focus:outline-none [&::-webkit-search-cancel-button]:hidden ${
                erro
                  ? "border-rose-400 focus:border-rose-500"
                  : "border-neutral-300 focus:border-rose-500"
              }`}
            />

            {buscando ? (
              <Loader2
                aria-hidden="true"
                className="absolute top-1/2 right-4 size-5 -translate-y-1/2 animate-spin text-neutral-400"
              />
            ) : (
              termo.length > 0 && (
                <button
                  type="button"
                  onClick={() => setTermo("")}
                  aria-label="Limpar busca"
                  className="absolute top-1/2 right-0 flex size-12 -translate-y-1/2 items-center justify-center text-neutral-400 active:text-neutral-700"
                >
                  <X aria-hidden="true" className="size-5" />
                </button>
              )
            )}
          </div>

          {procurando && resultados.length > 0 && (
            <ul className="divide-y divide-neutral-100 overflow-hidden rounded-xl border border-neutral-200 bg-white">
              {resultados.map((cliente) => (
                <li key={cliente.id}>
                  <button
                    type="button"
                    onClick={() => setEscolhida(cliente)}
                    className="flex min-h-12 w-full items-center px-3 py-2.5 text-left text-neutral-900 active:bg-neutral-50"
                  >
                    {cliente.nome}
                  </button>
                </li>
              ))}
            </ul>
          )}

          {semResultado && (
            <p className="text-sm text-neutral-500">
              Nenhuma cliente encontrada.
            </p>
          )}
        </div>
      )}

      {erro && (
        <p id={idErro} className="mt-1 text-sm text-rose-700">
          {erro}
        </p>
      )}
    </div>
  );
}
