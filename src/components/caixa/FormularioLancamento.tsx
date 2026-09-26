"use client";

import { useActionState, useId, useState } from "react";
import Link from "next/link";

import type { EstadoFormulario } from "@/app/(app)/caixa/actions";
import BuscaCliente from "@/components/caixa/BuscaCliente";
import CampoValor from "@/components/caixa/CampoValor";
import type { Categoria, Lancamento } from "@/lib/caixa/consultas";
import { hoje } from "@/lib/caixa/mes";
import {
  FORMAS_PAGAMENTO,
  STATUS,
  TIPOS,
  TITULARIDADES,
  type CampoLancamento,
  type StatusLancamento,
  type TipoLancamento,
} from "@/lib/caixa/schema";
import {
  lancamentoDaConta,
  MENSAGEM_CAMPO_TRAVADO_CONTA,
  MENSAGEM_COMPETENCIA_TRAVADA,
} from "@/lib/caixa/travas";
import { valorParaCampo } from "@/lib/formatters";

type Props = {
  acao: (
    estado: EstadoFormulario,
    formData: FormData,
  ) => Promise<EstadoFormulario>;
  lancamento?: Lancamento;
  tipoInicial: TipoLancamento;
  categorias: Categoria[];
  instituicoes: string[];
  rotuloEnviar: string;
  cancelarHref: string;
};

const ESTADO_INICIAL: EstadoFormulario = {};

const classeCampo =
  "h-12 w-full rounded-xl border bg-white px-3 text-base text-neutral-900 placeholder:text-neutral-400 focus:ring-2 focus:ring-rose-200 focus:outline-none disabled:bg-neutral-100 disabled:text-neutral-400";

/**
 * Lançar e editar usam o mesmo formulário — muda só a server action.
 *
 * A ordem dos campos segue o caminho curto: o valor vem primeiro, porque
 * é o que ela sempre preenche; o que quase nunca muda fica embaixo, na
 * parte opcional. Trocar o tipo troca a contraparte (cliente ou
 * fornecedor) e a lista de categorias.
 */
export default function FormularioLancamento({
  acao,
  lancamento,
  tipoInicial,
  categorias,
  instituicoes,
  rotuloEnviar,
  cancelarHref,
}: Props) {
  const [estado, enviar, enviando] = useActionState(acao, ESTADO_INICIAL);

  const [tipo, setTipo] = useState<TipoLancamento>(
    lancamento?.tipo ?? tipoInicial,
  );
  const [categoria, setCategoria] = useState(lancamento?.categoria ?? "");
  const [status, setStatus] = useState<StatusLancamento>(
    lancamento?.status ?? "Pago",
  );
  const [dataCompetencia, setDataCompetencia] = useState(
    lancamento?.data_competencia ?? hoje(),
  );
  const [dataCaixa, setDataCaixa] = useState(
    // Lançamento novo já nasce pago hoje: é o caso mais comum, dinheiro
    // ou Pix na hora do atendimento.
    lancamento ? (lancamento.data_caixa ?? "") : hoje(),
  );

  const entrada = tipo === "Entrada";
  const pago = status === "Pago";
  // Entrada de conta: valor, tipo, competência, parcela e cliente são
  // da conta, e só mudam reabrindo-a. A action confere de novo.
  const daConta = lancamento ? lancamentoDaConta(lancamento) : false;
  const idInstituicoes = useId();

  /**
   * O que o servidor devolveu depois de um erro tem prioridade sobre o
   * valor gravado: é o que a usuária tinha acabado de digitar.
   */
  const valor = (campo: CampoLancamento) => {
    const bruto = estado.valores?.[campo] ?? lancamento?.[campo];

    return bruto == null ? "" : String(bruto);
  };

  function trocarTipo(novo: TipoLancamento) {
    setTipo(novo);
    // Categoria de entrada não vale para saída: a lista inteira troca.
    setCategoria("");
  }

  function trocarStatus(novo: StatusLancamento) {
    setStatus(novo);

    // Pago exige data de caixa (chk_lancamento_caixa). O padrão é a data
    // de competência — recebeu no mesmo dia —, e ela pode mudar.
    // Pendente limpa: o dinheiro ainda não andou.
    setDataCaixa(novo === "Pago" ? dataCaixa || dataCompetencia : "");
  }

  return (
    <form action={enviar} className="space-y-5">
      <input type="hidden" name="tipo" value={tipo} />
      <input type="hidden" name="status" value={status} />

      {estado.mensagem && (
        <p
          role="alert"
          className="rounded-xl border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-800"
        >
          {estado.mensagem}
        </p>
      )}

      <Segmentado
        rotulo="Tipo do lançamento"
        opcoes={TIPOS.map((item) => ({ valor: item, rotulo: item }))}
        selecionado={tipo}
        aoTrocar={trocarTipo}
        cores={{
          Entrada: "border-emerald-600 bg-emerald-600",
          Saída: "border-rose-600 bg-rose-600",
        }}
        bloqueado={daConta}
      />

      {/* O valor não passa pelo `valor()`: numeric vem do banco como
          número (180.00 chega como 180) e a máscara leria isso como
          centavos. `valorParaCampo` devolve as duas casas de volta. */}
      <CampoValor
        valorInicial={
          daConta
            ? valorParaCampo(lancamento?.valor)
            : (estado.valores?.valor ?? valorParaCampo(lancamento?.valor))
        }
        erro={estado.erros?.valor}
        travado={daConta ? MENSAGEM_CAMPO_TRAVADO_CONTA : undefined}
      />

      {entrada ? (
        <BuscaCliente
          clienteInicial={lancamento?.cliente ?? null}
          erro={estado.erros?.cliente_id}
          travado={daConta ? MENSAGEM_CAMPO_TRAVADO_CONTA : undefined}
        />
      ) : (
        <Campo rotulo="Fornecedor" erro={estado.erros?.fornecedor}>
          {(props) => (
            <input
              {...props}
              name="fornecedor"
              type="text"
              defaultValue={valor("fornecedor")}
              placeholder="WELLA, EDP, contadora…"
              autoCapitalize="words"
              autoComplete="off"
              enterKeyHint="next"
            />
          )}
        </Campo>
      )}

      <Campo rotulo="Descrição" erro={estado.erros?.descricao} obrigatorio>
        {(props) => (
          <input
            {...props}
            name="descricao"
            type="text"
            defaultValue={valor("descricao")}
            placeholder={entrada ? "Coloração + corte" : "Boleto de material"}
            autoCapitalize="sentences"
            autoComplete="off"
            enterKeyHint="next"
            required
          />
        )}
      </Campo>

      <Campo rotulo="Categoria" erro={estado.erros?.categoria} obrigatorio>
        {(props) => (
          <select
            {...props}
            name="categoria"
            value={categoria}
            onChange={(evento) => setCategoria(evento.target.value)}
            required
          >
            <option value="">Escolha…</option>
            {categorias
              .filter((item) => item.tipo === tipo)
              .map((item) => (
                <option key={item.id} value={item.nome}>
                  {item.nome}
                </option>
              ))}
          </select>
        )}
      </Campo>

      <Campo
        rotulo="Data de competência"
        erro={estado.erros?.data_competencia}
        obrigatorio
        ajuda={
          daConta
            ? MENSAGEM_COMPETENCIA_TRAVADA
            : "Quando o atendimento aconteceu."
        }
      >
        {(props) =>
          daConta ? (
            <>
              {/* Campo desabilitado não vai no FormData: a data segue no
                  escondido, e a action confere que não mudou. */}
              <input {...props} type="date" value={dataCompetencia} disabled />
              <input
                type="hidden"
                name="data_competencia"
                value={dataCompetencia}
              />
            </>
          ) : (
            <input
              {...props}
              name="data_competencia"
              type="date"
              value={dataCompetencia}
              onChange={(evento) => setDataCompetencia(evento.target.value)}
              required
            />
          )
        }
      </Campo>

      <Segmentado
        rotulo="Status"
        opcoes={STATUS.map((item) => ({ valor: item, rotulo: item }))}
        selecionado={status}
        aoTrocar={trocarStatus}
        cores={{
          Pago: "border-emerald-600 bg-emerald-600",
          Pendente: "border-amber-600 bg-amber-600",
        }}
      />

      <Campo
        rotulo="Data de caixa"
        erro={estado.erros?.data_caixa}
        obrigatorio={pago}
        ajuda={
          pago
            ? "Quando o dinheiro entrou ou saiu de fato."
            : "Pendente não tem data de caixa."
        }
      >
        {(props) => (
          <input
            {...props}
            name="data_caixa"
            type="date"
            value={dataCaixa}
            onChange={(evento) => setDataCaixa(evento.target.value)}
            disabled={!pago}
          />
        )}
      </Campo>

      <Campo rotulo="Forma de pagamento" erro={estado.erros?.forma_pagamento}>
        {(props) => (
          <select
            {...props}
            name="forma_pagamento"
            defaultValue={valor("forma_pagamento")}
          >
            <option value="">Não informada</option>
            {FORMAS_PAGAMENTO.map((forma) => (
              <option key={forma} value={forma}>
                {forma}
              </option>
            ))}
          </select>
        )}
      </Campo>

      <fieldset className="space-y-4 border-t border-neutral-200 pt-5">
        <legend className="sr-only">Dados complementares</legend>
        <p className="text-sm font-medium text-neutral-500">Opcional</p>

        <Campo rotulo="Instituição" erro={estado.erros?.instituicao}>
          {(props) => (
            <>
              <input
                {...props}
                name="instituicao"
                type="text"
                defaultValue={valor("instituicao")}
                list={idInstituicoes}
                placeholder="Nubank, SumUp…"
                autoCapitalize="words"
                autoComplete="off"
              />
              {/* Sugere o que ela já usou, em vez de obrigar a digitar. */}
              <datalist id={idInstituicoes}>
                {instituicoes.map((nome) => (
                  <option key={nome} value={nome} />
                ))}
              </datalist>
            </>
          )}
        </Campo>

        <Campo rotulo="Titularidade" erro={estado.erros?.titularidade}>
          {(props) => (
            <select
              {...props}
              name="titularidade"
              defaultValue={valor("titularidade")}
            >
              <option value="">Não informada</option>
              {TITULARIDADES.map((item) => (
                <option key={item} value={item}>
                  {item}
                </option>
              ))}
            </select>
          )}
        </Campo>

        <Campo
          rotulo="Parcelamento"
          erro={estado.erros?.parcelamento}
          ajuda={daConta ? MENSAGEM_CAMPO_TRAVADO_CONTA : undefined}
        >
          {(props) =>
            daConta ? (
              <>
                {/* Como a competência: o desabilitado não vai no
                    FormData, e o gravado segue no escondido. */}
                <input
                  {...props}
                  type="text"
                  value={lancamento?.parcelamento ?? ""}
                  placeholder="Sem parcela"
                  disabled
                />
                <input
                  type="hidden"
                  name="parcelamento"
                  value={lancamento?.parcelamento ?? ""}
                />
              </>
            ) : (
              <input
                {...props}
                name="parcelamento"
                type="text"
                defaultValue={valor("parcelamento")}
                placeholder="1/3"
                autoComplete="off"
              />
            )
          }
        </Campo>

        <Campo
          rotulo="Previsão de recebimento"
          erro={estado.erros?.data_prevista}
          ajuda="Quando o dinheiro deve cair. Só informativo."
        >
          {(props) => (
            <input
              {...props}
              name="data_prevista"
              type="date"
              defaultValue={valor("data_prevista")}
            />
          )}
        </Campo>

        <Campo rotulo="Observações" erro={estado.erros?.observacoes} multilinha>
          {(props) => (
            <textarea
              {...props}
              name="observacoes"
              defaultValue={valor("observacoes")}
              rows={3}
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

/**
 * Escolha entre duas opções, lado a lado. Um toque troca — mais rápido
 * que um select nativo, que no celular abre uma roleta.
 */
function Segmentado<T extends string>({
  rotulo,
  opcoes,
  selecionado,
  aoTrocar,
  cores,
  bloqueado = false,
}: {
  rotulo: string;
  opcoes: { valor: T; rotulo: string }[];
  selecionado: T;
  aoTrocar: (valor: T) => void;
  cores: Record<string, string>;
  /** Mostra a escolha sem deixar trocar (entrada de conta). */
  bloqueado?: boolean;
}) {
  return (
    <div role="group" aria-label={rotulo} className="flex gap-2">
      {opcoes.map((opcao) => {
        const ativo = opcao.valor === selecionado;

        return (
          <button
            key={opcao.valor}
            type="button"
            onClick={() => aoTrocar(opcao.valor)}
            aria-pressed={ativo}
            disabled={bloqueado}
            className={`h-12 flex-1 rounded-xl border font-medium ${
              ativo
                ? `${cores[opcao.valor]} text-white`
                : "border-neutral-300 bg-white text-neutral-600 active:bg-neutral-100 disabled:text-neutral-300"
            }`}
          >
            {opcao.rotulo}
          </button>
        );
      })}
    </div>
  );
}

type PropsControle = {
  id: string;
  className: string;
  "aria-invalid"?: true;
  "aria-describedby"?: string;
};

/**
 * Rótulo + controle + mensagem, com os ids já amarrados. Gêmeo do que o
 * formulário de clientes usa; mora aqui para não mexer naquele módulo.
 */
function Campo({
  rotulo,
  erro,
  ajuda,
  obrigatorio,
  multilinha,
  children,
}: {
  rotulo: string;
  erro?: string;
  ajuda?: string;
  obrigatorio?: boolean;
  multilinha?: boolean;
  children: (props: PropsControle) => React.ReactNode;
}) {
  const id = useId();
  const idErro = `${id}-erro`;
  const idAjuda = `${id}-ajuda`;

  const descricao = erro ? idErro : ajuda ? idAjuda : undefined;

  const props: PropsControle = {
    id,
    className: `${classeCampo} ${
      erro
        ? "border-rose-400 focus:border-rose-500"
        : "border-neutral-300 focus:border-rose-500"
    } ${multilinha ? "h-auto py-2.5 leading-relaxed" : ""}`,
    ...(erro ? { "aria-invalid": true as const } : {}),
    ...(descricao ? { "aria-describedby": descricao } : {}),
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

      {erro ? (
        <p id={idErro} className="mt-1 text-sm text-rose-700">
          {erro}
        </p>
      ) : (
        ajuda && (
          <p id={idAjuda} className="mt-1 text-xs text-neutral-500">
            {ajuda}
          </p>
        )
      )}
    </div>
  );
}
