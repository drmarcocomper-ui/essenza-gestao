"use client";

import { useActionState, useId, useState } from "react";
import Link from "next/link";
import { Plus, X } from "lucide-react";

import type { EstadoFormula } from "@/app/(app)/clientes/[id]/formulas/actions";
import { hoje } from "@/lib/caixa/mes";
import { formatarData } from "@/lib/formatters";
import type { ValoresFormula } from "@/lib/formulas/repetir";
import {
  ROTULO_TIPO,
  TIPOS_FORMULA,
  UNIDADES,
  type CampoFormula,
  type ItemBruto,
} from "@/lib/formulas/schema";

export type FormulaAnterior = {
  data: string;
  resultado: string | null;
  observacao: string | null;
};

type Props = {
  acao: (estado: EstadoFormula, formData: FormData) => Promise<EstadoFormula>;
  /** Valores vindos de "repetir": tudo editável, nada salvo ainda. */
  inicial?: ValoresFormula | null;
  /** Resultado e ajuste da fórmula repetida, como leitura. */
  anterior?: FormulaAnterior | null;
  atendimentoId?: string | null;
  cancelarHref: string;
};

const ESTADO_INICIAL: EstadoFormula = {};

const classeCampo =
  "h-12 w-full rounded-xl border bg-white px-3 text-base text-neutral-900 placeholder:text-neutral-400 focus:ring-2 focus:ring-rose-200 focus:outline-none";

const LINHA_VAZIA: ItemBruto = { descricao: "", quantidade: "", unidade: "g" };

/**
 * A ficha de coloração.
 *
 * A ordem é a da ficha de papel que ela já preenche — base, tom, volume,
 * pausa, resultado. Os campos numéricos abrem o teclado de números, para
 * ela digitar com o polegar, de pé, no meio do atendimento.
 */
export default function FormularioFormula({
  acao,
  inicial,
  anterior,
  atendimentoId,
  cancelarHref,
}: Props) {
  const [estado, enviar, enviando] = useActionState(acao, ESTADO_INICIAL);

  const [itens, setItens] = useState<ItemBruto[]>(() =>
    inicial?.itens.length
      ? inicial.itens.map((item) => ({ ...item }))
      : [{ ...LINHA_VAZIA }],
  );

  const valoresRepetidos: Partial<Record<CampoFormula, string>> = inicial
    ? {
        tipo: inicial.tipo,
        base_natural: inicial.base_natural,
        resultado_alvo: inicial.resultado_alvo,
        volume_oxidante: inicial.volume_oxidante,
        tempo_pausa_min: inicial.tempo_pausa_min,
        tecnica: inicial.tecnica,
      }
    : {};

  // O que o servidor devolveu depois de um erro tem prioridade sobre o
  // valor repetido: é o que a usuária tinha acabado de digitar.
  const valor = (campo: CampoFormula) =>
    estado.valores?.[campo] ?? valoresRepetidos[campo] ?? "";

  function alterarItem(indice: number, mudanca: Partial<ItemBruto>) {
    setItens((atuais) =>
      atuais.map((item, i) => (i === indice ? { ...item, ...mudanca } : item)),
    );
  }

  function removerItem(indice: number) {
    // Nunca fica sem nenhuma linha: sem campo na tela ela não teria por
    // onde recomeçar a mistura.
    setItens((atuais) =>
      atuais.length === 1
        ? [{ ...LINHA_VAZIA }]
        : atuais.filter((_, i) => i !== indice),
    );
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

      {anterior && (
        <section className="rounded-2xl border border-amber-200 bg-amber-50 p-4">
          <p className="text-sm font-medium text-amber-900">
            Repetindo a fórmula de {formatarData(anterior.data)}
          </p>

          {anterior.resultado && (
            <p className="mt-2 text-sm text-amber-900">
              <span className="font-medium">Saiu assim: </span>
              {anterior.resultado}
            </p>
          )}

          {anterior.observacao && (
            <p className="mt-1 text-sm text-amber-900">
              <span className="font-medium">Ajuste anotado: </span>
              {anterior.observacao}
            </p>
          )}

          <p className="mt-2 text-xs text-amber-700">
            Confira e mude o que precisar. Nada foi salvo ainda.
          </p>
        </section>
      )}

      {/* O vínculo com o atendimento vem da rota, não de campo visível. */}
      <input type="hidden" name="atendimento_id" value={atendimentoId ?? ""} />

      <Campo rotulo="Tipo" erro={estado.erros?.tipo} obrigatorio>
        {(props) => (
          <select
            {...props}
            name="tipo"
            defaultValue={valor("tipo") || "coloracao"}
          >
            {TIPOS_FORMULA.map((tipo) => (
              <option key={tipo} value={tipo}>
                {ROTULO_TIPO[tipo]}
              </option>
            ))}
          </select>
        )}
      </Campo>

      <Campo rotulo="Data" erro={estado.erros?.data} obrigatorio>
        {(props) => (
          <input
            {...props}
            name="data"
            type="date"
            defaultValue={valor("data") || hoje()}
            required
          />
        )}
      </Campo>

      <div className="flex gap-3">
        <div className="w-28 shrink-0">
          <Campo rotulo="Base" erro={estado.erros?.base_natural}>
            {(props) => (
              <input
                {...props}
                name="base_natural"
                type="text"
                defaultValue={valor("base_natural")}
                placeholder="5"
                inputMode="decimal"
                autoCapitalize="off"
                autoComplete="off"
              />
            )}
          </Campo>
        </div>

        <div className="min-w-0 flex-1">
          <Campo rotulo="Tom desejado" erro={estado.erros?.resultado_alvo}>
            {(props) => (
              <input
                {...props}
                name="resultado_alvo"
                type="text"
                defaultValue={valor("resultado_alvo")}
                placeholder="7.1 loiro médio"
                autoCapitalize="off"
                autoComplete="off"
              />
            )}
          </Campo>
        </div>
      </div>

      <div className="flex gap-3">
        <div className="min-w-0 flex-1">
          <Campo rotulo="Oxidante (vol)" erro={estado.erros?.volume_oxidante}>
            {(props) => (
              <input
                {...props}
                name="volume_oxidante"
                type="text"
                defaultValue={valor("volume_oxidante")}
                placeholder="20"
                inputMode="numeric"
                autoComplete="off"
              />
            )}
          </Campo>
        </div>

        <div className="min-w-0 flex-1">
          <Campo rotulo="Pausa (min)" erro={estado.erros?.tempo_pausa_min}>
            {(props) => (
              <input
                {...props}
                name="tempo_pausa_min"
                type="text"
                defaultValue={valor("tempo_pausa_min")}
                placeholder="35"
                inputMode="numeric"
                autoComplete="off"
              />
            )}
          </Campo>
        </div>
      </div>

      <Campo rotulo="Técnica" erro={estado.erros?.tecnica}>
        {(props) => (
          <input
            {...props}
            name="tecnica"
            type="text"
            defaultValue={valor("tecnica")}
            placeholder="Papel alumínio, touca, babyliss…"
            autoCapitalize="sentences"
            autoComplete="off"
          />
        )}
      </Campo>

      <fieldset className="space-y-3 border-t border-neutral-200 pt-5">
        <legend className="sr-only">Mistura</legend>

        <div className="flex items-baseline justify-between">
          <p className="text-sm font-medium text-neutral-700">Mistura</p>
          <p className="text-xs text-neutral-500">Produto e quantidade</p>
        </div>

        {estado.erros?.itens && (
          <p role="alert" className="text-sm text-rose-700">
            {estado.erros.itens}
          </p>
        )}

        {itens.map((item, indice) => (
          <LinhaItem
            // A lista é reordenável só por remoção; o índice basta e
            // mantém o foco no campo certo enquanto ela digita.
            key={indice}
            item={item}
            indice={indice}
            unica={itens.length === 1}
            onAlterar={alterarItem}
            onRemover={removerItem}
          />
        ))}

        <button
          type="button"
          onClick={() => setItens((atuais) => [...atuais, { ...LINHA_VAZIA }])}
          className="flex h-12 w-full items-center justify-center gap-2 rounded-xl border border-dashed border-neutral-300 font-medium text-neutral-600 active:bg-neutral-100"
        >
          <Plus aria-hidden="true" className="size-5" />
          Adicionar produto
        </button>
      </fieldset>

      <div className="space-y-4 border-t border-neutral-200 pt-5">
        <Campo rotulo="Resultado" erro={estado.erros?.resultado} multilinha>
          {(props) => (
            <textarea
              {...props}
              name="resultado"
              defaultValue={valor("resultado")}
              rows={3}
              placeholder="Como saiu de fato"
            />
          )}
        </Campo>

        <Campo
          rotulo="Ajuste para a próxima"
          erro={estado.erros?.observacao}
          multilinha
        >
          {(props) => (
            <textarea
              {...props}
              name="observacao"
              defaultValue={valor("observacao")}
              rows={3}
              placeholder="O que mudar da próxima vez"
            />
          )}
        </Campo>
      </div>

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
          {enviando ? "Salvando…" : "Salvar fórmula"}
        </button>
      </div>
    </form>
  );
}

/** Uma linha da mistura: produto, quantidade e unidade. */
function LinhaItem({
  item,
  indice,
  unica,
  onAlterar,
  onRemover,
}: {
  item: ItemBruto;
  indice: number;
  unica: boolean;
  onAlterar: (indice: number, mudanca: Partial<ItemBruto>) => void;
  onRemover: (indice: number) => void;
}) {
  const id = useId();

  return (
    <div className="rounded-xl border border-neutral-200 bg-white p-3">
      <label htmlFor={id} className="sr-only">
        Produto {indice + 1}
      </label>

      <input
        id={id}
        name="item_descricao"
        type="text"
        value={item.descricao}
        onChange={(evento) =>
          onAlterar(indice, { descricao: evento.target.value })
        }
        placeholder="Wella Koleston 7.1"
        autoCapitalize="sentences"
        autoComplete="off"
        className={`${classeCampo} border-neutral-300 focus:border-rose-500`}
      />

      <div className="mt-2 flex gap-2">
        <input
          name="item_quantidade"
          type="text"
          value={item.quantidade}
          onChange={(evento) =>
            onAlterar(indice, { quantidade: evento.target.value })
          }
          placeholder="60"
          inputMode="decimal"
          autoComplete="off"
          aria-label={`Quantidade do produto ${indice + 1}`}
          className={`${classeCampo} w-24 shrink-0 border-neutral-300 text-center tabular-nums focus:border-rose-500`}
        />

        <select
          name="item_unidade"
          value={item.unidade}
          onChange={(evento) =>
            onAlterar(indice, { unidade: evento.target.value })
          }
          aria-label={`Unidade do produto ${indice + 1}`}
          className={`${classeCampo} w-20 shrink-0 border-neutral-300 px-2 focus:border-rose-500`}
        >
          {UNIDADES.map((unidade) => (
            <option key={unidade} value={unidade}>
              {unidade}
            </option>
          ))}
        </select>

        <button
          type="button"
          onClick={() => onRemover(indice)}
          aria-label={`Remover produto ${indice + 1}`}
          disabled={unica && item.descricao === "" && item.quantidade === ""}
          className="ml-auto flex size-12 items-center justify-center rounded-xl border border-neutral-300 text-neutral-500 active:bg-neutral-100 disabled:opacity-40"
        >
          <X aria-hidden="true" className="size-5" />
        </button>
      </div>
    </div>
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
    ...(erro
      ? { "aria-invalid": true as const, "aria-describedby": idErro }
      : {}),
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
