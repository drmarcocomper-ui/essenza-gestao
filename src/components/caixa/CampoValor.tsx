"use client";

import { useId, useState } from "react";

import { mascararMoeda } from "@/lib/formatters";

/**
 * O campo mais usado da tela, e por isso o maior.
 *
 * `inputMode="decimal"` abre o teclado numérico, e a máscara monta o
 * valor da direita para a esquerda: ela digita 18000 e sai 180,00, sem
 * precisar acertar a vírgula com o polegar.
 */
export default function CampoValor({
  valorInicial = "",
  erro,
  travado,
}: {
  valorInicial?: string;
  erro?: string;
  /** Quando vem, o valor é só leitura, e o texto diz por quê. */
  travado?: string;
}) {
  const id = useId();
  const idErro = `${id}-erro`;
  const [valor, setValor] = useState(() => mascararMoeda(valorInicial));

  return (
    <div>
      <label
        htmlFor={id}
        className="mb-1.5 block text-sm font-medium text-neutral-700"
      >
        Valor <span className="text-rose-600">*</span>
      </label>

      <div className="relative">
        <span
          aria-hidden="true"
          className="pointer-events-none absolute top-1/2 left-4 -translate-y-1/2 text-lg font-medium text-neutral-400"
        >
          R$
        </span>

        <input
          id={id}
          name="valor"
          type="text"
          inputMode="decimal"
          value={valor}
          onChange={(evento) => setValor(mascararMoeda(evento.target.value))}
          // Só leitura, não desabilitado: o valor segue no FormData, e a
          // action confere que não mudou.
          readOnly={Boolean(travado)}
          placeholder="0,00"
          enterKeyHint="next"
          autoComplete="off"
          aria-invalid={erro ? true : undefined}
          aria-describedby={erro ? idErro : undefined}
          className={`h-16 w-full rounded-xl border pr-4 pl-12 text-2xl font-semibold tabular-nums placeholder:font-normal placeholder:text-neutral-300 focus:ring-2 focus:ring-rose-200 focus:outline-none ${
            travado
              ? "bg-neutral-100 text-neutral-500"
              : "bg-white text-neutral-900"
          } ${
            erro
              ? "border-rose-400 focus:border-rose-500"
              : "border-neutral-300 focus:border-rose-500"
          }`}
        />
      </div>

      {/* Cortesia entra com 0,00 para o atendimento não sumir do histórico. */}
      <p className="mt-1 text-xs text-neutral-500">
        {travado ?? "Cortesia? Deixe 0,00."}
      </p>

      {erro && (
        <p id={idErro} className="mt-1 text-sm text-rose-700">
          {erro}
        </p>
      )}
    </div>
  );
}
