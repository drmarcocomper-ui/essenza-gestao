"use client";

import { useActionState, useId, useState } from "react";
import Link from "next/link";
import { Check, Plus, X } from "lucide-react";

import type { EstadoAtendimento } from "@/app/(app)/clientes/[id]/atendimentos/actions";
import type { ServicoCatalogo } from "@/lib/atendimentos/consultas";
import type { CampoAtendimento } from "@/lib/atendimentos/schema";
import { hoje } from "@/lib/caixa/mes";

type Escolhido = {
  /** null = serviço digitado agora, que ainda não está no catálogo. */
  id: string | null;
  nome: string;
};

type Props = {
  acao: (
    estado: EstadoAtendimento,
    formData: FormData,
  ) => Promise<EstadoAtendimento>;
  servicos: ServicoCatalogo[];
  cancelarHref: string;
};

const ESTADO_INICIAL: EstadoAtendimento = {};

const classeCampo =
  "h-12 w-full rounded-xl border bg-white px-3 text-base text-neutral-900 placeholder:text-neutral-400 focus:ring-2 focus:ring-rose-200 focus:outline-none";

/**
 * Registro do atendimento: quem, quando e o que foi feito.
 *
 * Não há valor, forma de pagamento nem parcela nesta tela — dinheiro
 * continua sendo lançado no Caixa, e as duas coisas não se cruzam nesta
 * fase.
 *
 * Os serviços são chips: o dedo escolhe, não digita. O que não estiver
 * no catálogo ela escreve uma vez e passa a aparecer como chip nos
 * próximos atendimentos.
 */
export default function FormularioAtendimento({
  acao,
  servicos,
  cancelarHref,
}: Props) {
  const [estado, enviar, enviando] = useActionState(acao, ESTADO_INICIAL);

  const [escolhidos, setEscolhidos] = useState<Escolhido[]>([]);
  const [novo, setNovo] = useState("");
  const [comFormula, setComFormula] = useState(false);

  const idData = useId();
  const idObservacao = useId();
  const idNovo = useId();

  const valor = (campo: CampoAtendimento) => estado.valores?.[campo] ?? "";

  const avulsos = escolhidos.filter((servico) => servico.id === null);

  function jaEscolhido(nome: string) {
    return escolhidos.some(
      (servico) => servico.nome.toLowerCase() === nome.trim().toLowerCase(),
    );
  }

  function alternar(servico: ServicoCatalogo) {
    setEscolhidos((atuais) =>
      atuais.some((escolhido) => escolhido.id === servico.id)
        ? atuais.filter((escolhido) => escolhido.id !== servico.id)
        : [...atuais, { id: servico.id, nome: servico.nome }],
    );
  }

  function adicionarNovo() {
    const nome = novo.trim();

    if (nome.length < 2 || jaEscolhido(nome)) {
      setNovo("");
      return;
    }

    setEscolhidos((atuais) => [...atuais, { id: null, nome }]);
    setNovo("");
  }

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

      {/* Os escolhidos viajam como duas listas paralelas; o id vazio é o
          serviço novo, que a action cadastra antes de gravar o item. */}
      {escolhidos.map((servico, indice) => (
        <div key={`${servico.id ?? "novo"}-${indice}`} hidden>
          <input type="hidden" name="servico_id" value={servico.id ?? ""} />
          <input type="hidden" name="servico_nome" value={servico.nome} />
        </div>
      ))}

      <div>
        <label
          htmlFor={idData}
          className="mb-1.5 block text-sm font-medium text-neutral-700"
        >
          Data <span className="text-rose-600">*</span>
        </label>

        <input
          id={idData}
          name="data"
          type="date"
          defaultValue={valor("data") || hoje()}
          required
          aria-invalid={estado.erros?.data ? true : undefined}
          className={`${classeCampo} ${
            estado.erros?.data
              ? "border-rose-400 focus:border-rose-500"
              : "border-neutral-300 focus:border-rose-500"
          }`}
        />

        {estado.erros?.data && (
          <p className="mt-1 text-sm text-rose-700">{estado.erros.data}</p>
        )}
      </div>

      <fieldset className="space-y-3">
        <legend className="mb-1.5 text-sm font-medium text-neutral-700">
          Serviços <span className="text-rose-600">*</span>
        </legend>

        {estado.erros?.servicos && (
          <p role="alert" className="text-sm text-rose-700">
            {estado.erros.servicos}
          </p>
        )}

        {servicos.length > 0 && (
          <div className="flex flex-wrap gap-2">
            {servicos.map((servico) => {
              const marcado = escolhidos.some(
                (escolhido) => escolhido.id === servico.id,
              );

              return (
                <button
                  key={servico.id}
                  type="button"
                  onClick={() => alternar(servico)}
                  aria-pressed={marcado}
                  className={`flex min-h-11 items-center gap-1.5 rounded-full border px-4 text-sm font-medium ${
                    marcado
                      ? "border-rose-600 bg-rose-600 text-white"
                      : "border-neutral-300 bg-white text-neutral-700 active:bg-neutral-100"
                  }`}
                >
                  {marcado && <Check aria-hidden="true" className="size-4" />}
                  {servico.nome}
                </button>
              );
            })}
          </div>
        )}

        {avulsos.length > 0 && (
          <div className="flex flex-wrap gap-2">
            {avulsos.map((servico) => (
              <span
                key={servico.nome}
                className="flex min-h-11 items-center gap-1.5 rounded-full border border-rose-600 bg-rose-600 pr-2 pl-4 text-sm font-medium text-white"
              >
                {servico.nome}
                <button
                  type="button"
                  onClick={() =>
                    setEscolhidos((atuais) =>
                      atuais.filter(
                        (escolhido) =>
                          !(
                            escolhido.id === null &&
                            escolhido.nome === servico.nome
                          ),
                      ),
                    )
                  }
                  aria-label={`Tirar ${servico.nome}`}
                  className="flex size-9 items-center justify-center rounded-full active:bg-rose-700"
                >
                  <X aria-hidden="true" className="size-4" />
                </button>
              </span>
            ))}
          </div>
        )}

        <div className="flex gap-2">
          <label htmlFor={idNovo} className="sr-only">
            Outro serviço
          </label>

          <input
            id={idNovo}
            type="text"
            value={novo}
            onChange={(evento) => setNovo(evento.target.value)}
            onKeyDown={(evento) => {
              // Enter aqui adiciona o serviço, não envia o atendimento
              // pela metade.
              if (evento.key === "Enter") {
                evento.preventDefault();
                adicionarNovo();
              }
            }}
            placeholder="Outro serviço"
            autoCapitalize="sentences"
            autoComplete="off"
            enterKeyHint="done"
            className={`${classeCampo} border-neutral-300 focus:border-rose-500`}
          />

          <button
            type="button"
            onClick={adicionarNovo}
            aria-label="Adicionar serviço"
            className="flex size-12 shrink-0 items-center justify-center rounded-xl border border-neutral-300 bg-white text-neutral-700 active:bg-neutral-100"
          >
            <Plus aria-hidden="true" className="size-5" />
          </button>
        </div>
      </fieldset>

      <div>
        <label
          htmlFor={idObservacao}
          className="mb-1.5 block text-sm font-medium text-neutral-700"
        >
          Observação
        </label>

        <textarea
          id={idObservacao}
          name="observacao"
          defaultValue={valor("observacao")}
          rows={3}
          placeholder="O que combinaram, como ela chegou…"
          className={`${classeCampo} h-auto border-neutral-300 py-2.5 leading-relaxed focus:border-rose-500`}
        />

        {estado.erros?.observacao && (
          <p className="mt-1 text-sm text-rose-700">
            {estado.erros.observacao}
          </p>
        )}
      </div>

      {/* Nem todo atendimento tem coloração; quando tem, o caminho
          continua direto na ficha, já amarrada neste atendimento. */}
      <label className="flex min-h-14 items-center gap-3 rounded-2xl border border-neutral-200 bg-white px-4">
        <input
          type="checkbox"
          name="com_formula"
          value="1"
          checked={comFormula}
          onChange={(evento) => setComFormula(evento.target.checked)}
          className="size-6 shrink-0 accent-rose-600"
        />
        <span className="font-medium text-neutral-800">
          Registrar a fórmula agora
        </span>
      </label>

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
          {enviando ? "Salvando…" : comFormula ? "Salvar e seguir" : "Salvar"}
        </button>
      </div>
    </form>
  );
}
