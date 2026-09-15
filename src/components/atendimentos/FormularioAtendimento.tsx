"use client";

import { useActionState, useId, useState } from "react";
import Link from "next/link";
import { Plus, X } from "lucide-react";

import type { EstadoAtendimento } from "@/app/(app)/clientes/[id]/atendimentos/actions";
import {
  ChipDeCatalogo,
  GrupoDeChips,
} from "@/components/atendimentos/ChipsDeCatalogo";
import type { ServicoCatalogo } from "@/lib/atendimentos/consultas";
import type { CampoAtendimento } from "@/lib/atendimentos/schema";
import {
  acharServicoPorNome,
  jaEscolhido as nomeJaEscolhido,
} from "@/lib/atendimentos/servicos";
import { hoje } from "@/lib/caixa/mes";
import { agruparPorCategoria } from "@/lib/servicos/grupos";

type Escolhido = {
  /** null = serviço confirmado como novo, que a action vai cadastrar. */
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
 * Os serviços são chips agrupados por categoria: o dedo escolhe, não
 * digita. O que não estiver no catálogo ela escreve uma vez e passa a
 * aparecer como chip nos próximos atendimentos — sem categoria, no bloco
 * dos sem categoria, até ela precificar.
 */
export default function FormularioAtendimento({
  acao,
  servicos,
  cancelarHref,
}: Props) {
  const [estado, enviar, enviando] = useActionState(acao, ESTADO_INICIAL);

  const [escolhidos, setEscolhidos] = useState<Escolhido[]>([]);
  const [novo, setNovo] = useState("");
  /** Nome à espera do "sim" para virar serviço novo no catálogo. */
  const [perguntando, setPerguntando] = useState<string | null>(null);
  const [comFormula, setComFormula] = useState(false);

  const idData = useId();
  const idObservacao = useId();
  const idNovo = useId();

  const valor = (campo: CampoAtendimento) => estado.valores?.[campo] ?? "";

  const avulsos = escolhidos.filter((servico) => servico.id === null);

  /** Se este serviço do catálogo já está escolhido. */
  const marcado = (id: string) =>
    escolhidos.some((escolhido) => escolhido.id === id);

  function alternar(servico: ServicoCatalogo) {
    setEscolhidos((atuais) =>
      atuais.some((escolhido) => escolhido.id === servico.id)
        ? atuais.filter((escolhido) => escolhido.id !== servico.id)
        : [...atuais, { id: servico.id, nome: servico.nome }],
    );
  }

  /**
   * O que ela digitou primeiro é procurado no catálogo pelo nome
   * normalizado: "coloracao" acha "Coloração" e entra como o serviço que
   * já existe. Só o que não casa com nada abre a pergunta — catálogo
   * novo nunca nasce em silêncio.
   */
  function adicionarNovo() {
    const nome = novo.trim();

    if (nome.length < 2 || nomeJaEscolhido(escolhidos, nome)) {
      setNovo("");
      return;
    }

    const existente = acharServicoPorNome(servicos, nome);

    if (existente) {
      setEscolhidos((atuais) => [
        ...atuais,
        { id: existente.id, nome: existente.nome },
      ]);
      setNovo("");
      return;
    }

    setPerguntando(nome);
  }

  function confirmarNovo() {
    if (!perguntando) return;

    setEscolhidos((atuais) => [...atuais, { id: null, nome: perguntando }]);
    setPerguntando(null);
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

      {/* Os escolhidos viajam como três listas paralelas. O id vazio é o
          serviço a cadastrar, e `servico_novo` é o "sim" que ela deu na
          pergunta — sem ele a action recusa criar. */}
      {escolhidos.map((servico, indice) => (
        <div key={`${servico.id ?? "novo"}-${indice}`} hidden>
          <input type="hidden" name="servico_id" value={servico.id ?? ""} />
          <input type="hidden" name="servico_nome" value={servico.nome} />
          <input
            type="hidden"
            name="servico_novo"
            value={servico.id === null ? "1" : "0"}
          />
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

        {/* Agrupados por categoria, os mesmos blocos do fechamento da
            conta: o catálogo inteiro aberto de uma vez é rolagem pura, e
            é por esta tela que toda cliente passa. O badge conta o que
            foi escolhido dentro do bloco fechado. */}
        <div className="space-y-2">
          {agruparPorCategoria(servicos).map((grupo) => (
            <GrupoDeChips
              key={grupo.chave || "sem-categoria"}
              rotulo={grupo.rotulo}
              escolhidos={
                grupo.servicos.filter((servico) => marcado(servico.id)).length
              }
            >
              {grupo.servicos.map((servico) => (
                <ChipDeCatalogo
                  key={servico.id}
                  nome={servico.nome}
                  marcado={marcado(servico.id)}
                  semPreco={servico.semPreco}
                  aoTocar={() => alternar(servico)}
                />
              ))}
            </GrupoDeChips>
          ))}
        </div>

        {avulsos.length > 0 && (
          <div className="flex flex-wrap gap-2">
            {avulsos.map((servico) => (
              <span
                key={servico.nome}
                className="flex min-h-11 items-center gap-1.5 rounded-full border border-rose-600 bg-rose-600 pr-2 pl-4 text-sm font-medium text-white"
              >
                {servico.nome}
                <span className="text-xs font-normal text-rose-100">
                  · novo
                </span>
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
            onChange={(evento) => {
              setNovo(evento.target.value);
              // Continuar digitando desfaz a pergunta: ela é sobre o nome
              // de um instante atrás, que já não é o que está no campo.
              setPerguntando(null);
            }}
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

        {/* Cadastro de catálogo nunca acontece em silêncio: o nome que
            não casou com nada existente passa por aqui antes. */}
        {perguntando && (
          <div className="space-y-3 rounded-xl border border-amber-200 bg-amber-50 p-3">
            <div>
              <p className="text-sm font-medium text-amber-900">
                Cadastrar “{perguntando}” como serviço novo?
              </p>
              <p className="mt-1 text-xs text-amber-700">
                Entra no catálogo sem preço, marcado para você acertar
                depois.
              </p>
            </div>

            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => setPerguntando(null)}
                className="h-11 flex-1 rounded-xl border border-neutral-300 bg-white text-sm font-medium text-neutral-700 active:bg-neutral-100"
              >
                Cancelar
              </button>

              <button
                type="button"
                onClick={confirmarNovo}
                className="h-11 flex-1 rounded-xl bg-amber-600 text-sm font-medium text-white active:bg-amber-700"
              >
                Cadastrar
              </button>
            </div>
          </div>
        )}
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
