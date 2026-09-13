"use client";

import { useActionState, useId, useState } from "react";
import Link from "next/link";

import type { EstadoFormulario } from "@/app/(app)/clientes/actions";
import type { Cliente } from "@/lib/clientes/consultas";
import type { CampoCliente } from "@/lib/clientes/schema";
import { formatarTelefone, mascararTelefone } from "@/lib/formatters";

type Props = {
  acao: (
    estado: EstadoFormulario,
    formData: FormData,
  ) => Promise<EstadoFormulario>;
  cliente?: Cliente;
  rotuloEnviar: string;
  cancelarHref: string;
};

const ESTADO_INICIAL: EstadoFormulario = {};

const classeCampo =
  "h-12 w-full rounded-xl border bg-white px-3 text-base text-neutral-900 placeholder:text-neutral-400 focus:ring-2 focus:ring-rose-200 focus:outline-none";

/**
 * Cadastro e edição usam o mesmo formulário — muda só a server action.
 *
 * Nome e telefone são obrigatórios; o resto é opcional e fica embaixo,
 * para o caminho curto (cadastrar rápido entre um atendimento e outro)
 * caber na primeira tela.
 */
export default function FormularioCliente({
  acao,
  cliente,
  rotuloEnviar,
  cancelarHref,
}: Props) {
  const [estado, enviar, enviando] = useActionState(acao, ESTADO_INICIAL);

  // O que o servidor devolveu depois de um erro tem prioridade sobre o
  // valor gravado: é o que a usuária tinha acabado de digitar.
  const valor = (campo: CampoCliente) =>
    estado.valores?.[campo] ?? (cliente?.[campo] ?? "");

  const [telefone, setTelefone] = useState(() =>
    formatarTelefone(cliente?.telefone ?? ""),
  );

  return (
    <form action={enviar} className="space-y-5">
      {estado.mensagem && (
        <p
          role="alert"
          className="rounded-xl border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-800"
        >
          {estado.mensagem}
        </p>
      )}

      <div className="space-y-4">
        <Campo rotulo="Nome" erro={estado.erros?.nome} obrigatorio>
          {(props) => (
            <input
              {...props}
              name="nome"
              type="text"
              defaultValue={valor("nome")}
              autoComplete="name"
              autoCapitalize="words"
              enterKeyHint="next"
              required
            />
          )}
        </Campo>

        <Campo rotulo="Telefone" erro={estado.erros?.telefone} obrigatorio>
          {(props) => (
            <input
              {...props}
              name="telefone"
              type="tel"
              value={telefone}
              onChange={(evento) =>
                setTelefone(mascararTelefone(evento.target.value))
              }
              placeholder="(27) 99999-8888"
              inputMode="tel"
              autoComplete="tel"
              enterKeyHint="next"
              required
            />
          )}
        </Campo>
      </div>

      <fieldset className="space-y-4 border-t border-neutral-200 pt-5">
        <legend className="sr-only">Dados complementares</legend>
        <p className="text-sm font-medium text-neutral-500">
          Opcional
        </p>

        <Campo rotulo="E-mail" erro={estado.erros?.email}>
          {(props) => (
            <input
              {...props}
              name="email"
              type="email"
              defaultValue={valor("email")}
              inputMode="email"
              autoComplete="email"
              autoCapitalize="off"
            />
          )}
        </Campo>

        <Campo
          rotulo="Data de nascimento"
          erro={estado.erros?.data_nascimento}
        >
          {(props) => (
            <input
              {...props}
              name="data_nascimento"
              type="date"
              defaultValue={valor("data_nascimento")}
            />
          )}
        </Campo>

        <Campo rotulo="Município" erro={estado.erros?.municipio}>
          {(props) => (
            <input
              {...props}
              name="municipio"
              type="text"
              defaultValue={valor("municipio")}
              autoCapitalize="words"
            />
          )}
        </Campo>

        <Campo rotulo="Bairro" erro={estado.erros?.bairro}>
          {(props) => (
            <input
              {...props}
              name="bairro"
              type="text"
              defaultValue={valor("bairro")}
              autoCapitalize="words"
            />
          )}
        </Campo>

        <Campo rotulo="Profissão" erro={estado.erros?.profissao}>
          {(props) => (
            <input
              {...props}
              name="profissao"
              type="text"
              defaultValue={valor("profissao")}
              autoCapitalize="sentences"
            />
          )}
        </Campo>

        <Campo rotulo="Como conheceu" erro={estado.erros?.origem}>
          {(props) => (
            <input
              {...props}
              name="origem"
              type="text"
              defaultValue={valor("origem")}
              placeholder="Instagram, indicação…"
              autoCapitalize="sentences"
            />
          )}
        </Campo>

        <Campo
          rotulo="Preferências"
          erro={estado.erros?.preferencias}
          multilinha
        >
          {(props) => (
            <textarea
              {...props}
              name="preferencias"
              defaultValue={valor("preferencias")}
              rows={2}
              placeholder="Água com gás, capuccino…"
            />
          )}
        </Campo>

        <Campo
          rotulo="Observações"
          erro={estado.erros?.observacoes}
          multilinha
        >
          {(props) => (
            <textarea
              {...props}
              name="observacoes"
              defaultValue={valor("observacoes")}
              rows={4}
              placeholder="Sensibilidades, histórico, combinados…"
            />
          )}
        </Campo>
      </fieldset>

      <div className="flex gap-3 pt-2">
        <Link
          href={cancelarHref}
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

/** Rótulo + controle + mensagem de erro, com os ids já amarrados. */
function Campo({
  rotulo,
  erro,
  obrigatorio,
  multilinha,
  children,
}: {
  rotulo: string;
  erro?: string;
  obrigatorio?: boolean;
  multilinha?: boolean;
  children: (props: PropsControle) => React.ReactNode;
}) {
  const id = useId();
  const idErro = `${id}-erro`;

  const props: PropsControle = {
    id,
    className: `${classeCampo} ${
      erro
        ? "border-rose-400 focus:border-rose-500"
        : "border-neutral-300 focus:border-rose-500"
    } ${multilinha ? "h-auto py-2.5 leading-relaxed" : ""}`,
    ...(erro ? { "aria-invalid": true as const, "aria-describedby": idErro } : {}),
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

      {children(props)}

      {erro && (
        <p id={idErro} className="mt-1 text-sm text-rose-700">
          {erro}
        </p>
      )}
    </div>
  );
}
