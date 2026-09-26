"use client";

import { useActionState, useId, useState } from "react";
import Link from "next/link";

import type { EstadoFormulario } from "@/app/(app)/produtos/actions";
import { mascararMoeda, valorParaCampo } from "@/lib/formatters";
import type { ProdutoRevenda } from "@/lib/produtos/consultas";

type Props = {
  acao: (
    estado: EstadoFormulario,
    formData: FormData,
  ) => Promise<EstadoFormulario>;
  produto?: ProdutoRevenda;
  rotuloEnviar: string;
};

const ESTADO_INICIAL: EstadoFormulario = {};

const classeCampo =
  "h-12 w-full rounded-xl border bg-white px-3 text-base text-neutral-900 placeholder:text-neutral-400 focus:ring-2 focus:ring-rose-200 focus:outline-none";

/** Cadastro e edição usam o mesmo formulário — muda só a server action. */
export default function FormularioProduto({
  acao,
  produto,
  rotuloEnviar,
}: Props) {
  const [estado, enviar, enviando] = useActionState(acao, ESTADO_INICIAL);

  // Controlado por causa da máscara (a mesma do Caixa: os dígitos entram
  // pela direita). Sobrevive a um erro do servidor, que não remonta o form.
  const [preco, setPreco] = useState(() =>
    mascararMoeda(valorParaCampo(produto?.preco)),
  );

  return (
    <form action={enviar} className="space-y-5">
      {estado.mensagem && (
        <div
          role="alert"
          className="rounded-xl border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-800"
        >
          <p>{estado.mensagem}</p>

          {estado.reativarId && (
            <Link
              href={`/produtos/${estado.reativarId}/editar`}
              className="mt-1 flex min-h-11 items-center font-medium text-rose-700 underline underline-offset-2"
            >
              Abrir o produto desativado
            </Link>
          )}
        </div>
      )}

      <Campo rotulo="Nome" erro={estado.erros?.nome} obrigatorio>
        {(props) => (
          <input
            {...props}
            name="nome"
            type="text"
            defaultValue={estado.valores?.nome ?? produto?.nome ?? ""}
            autoCapitalize="sentences"
            enterKeyHint="next"
            required
          />
        )}
      </Campo>

      <Campo rotulo="Marca" erro={estado.erros?.marca}>
        {(props) => (
          <input
            {...props}
            name="marca"
            type="text"
            defaultValue={estado.valores?.marca ?? produto?.marca ?? ""}
            autoCapitalize="words"
            enterKeyHint="next"
          />
        )}
      </Campo>

      <Campo
        rotulo="Preço de venda"
        erro={estado.erros?.preco_venda}
        ajuda="Deixe em branco se ainda não tem preço."
        prefixo="R$"
      >
        {(props) => (
          <input
            {...props}
            name="preco_venda"
            type="text"
            inputMode="decimal"
            value={preco}
            onChange={(evento) => setPreco(mascararMoeda(evento.target.value))}
            placeholder="0,00"
            autoComplete="off"
            enterKeyHint="done"
          />
        )}
      </Campo>

      <div className="flex gap-3 pt-2">
        <Link
          href="/produtos"
          className="flex h-12 flex-1 items-center justify-center rounded-xl border border-neutral-300 bg-white font-medium text-neutral-700 active:bg-neutral-100"
        >
          Cancelar
        </Link>

        <button
          type="submit"
          disabled={enviando}
          className="h-12 flex-1 rounded-xl bg-rose-600 font-medium text-white active:bg-rose-700 disabled:opacity-60"
        >
          {enviando ? "Salvando…" : rotuloEnviar}
        </button>
      </div>
    </form>
  );
}

type PropsControle = {
  id: string;
  className: string;
  "aria-invalid"?: true;
  "aria-describedby"?: string;
};

/** Rótulo + controle + ajuda + erro, com os ids já amarrados. */
function Campo({
  rotulo,
  erro,
  ajuda,
  obrigatorio,
  prefixo,
  children,
}: {
  rotulo: string;
  erro?: string;
  ajuda?: string;
  obrigatorio?: boolean;
  prefixo?: string;
  children: (props: PropsControle) => React.ReactNode;
}) {
  const id = useId();
  const idErro = `${id}-erro`;
  const idAjuda = `${id}-ajuda`;

  const descritores = [ajuda && idAjuda, erro && idErro]
    .filter(Boolean)
    .join(" ");

  const props: PropsControle = {
    id,
    className: `${classeCampo} ${
      erro
        ? "border-rose-400 focus:border-rose-500"
        : "border-neutral-300 focus:border-rose-500"
    } ${prefixo ? "pl-11 tabular-nums" : ""}`,
    ...(erro ? { "aria-invalid": true as const } : {}),
    ...(descritores ? { "aria-describedby": descritores } : {}),
  };

  return (
    <div>
      <label
        htmlFor={id}
        className="mb-1.5 block text-sm font-medium text-neutral-700"
      >
        {rotulo}
        {obrigatorio && <span className="text-rose-600"> *</span>}
      </label>

      <div className="relative">
        {prefixo && (
          <span
            aria-hidden="true"
            className="pointer-events-none absolute top-1/2 left-3 -translate-y-1/2 text-neutral-400"
          >
            {prefixo}
          </span>
        )}

        {children(props)}
      </div>

      {ajuda && (
        <p id={idAjuda} className="mt-1 text-xs text-neutral-500">
          {ajuda}
        </p>
      )}

      {erro && (
        <p id={idErro} className="mt-1 text-sm text-rose-700">
          {erro}
        </p>
      )}
    </div>
  );
}
