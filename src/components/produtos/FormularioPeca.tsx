"use client";

import { useActionState, useId, useState } from "react";
import Link from "next/link";

import type { EstadoFormularioPeca } from "@/app/(app)/produtos/extensao/actions";
import { hoje } from "@/lib/caixa/mes";
import { mascararMoeda, valorParaCampo } from "@/lib/formatters";
import type { PecaExtensao } from "@/lib/pecas-extensao/consultas";
import { MENSAGEM_CODIGO_TRAVADO } from "@/lib/pecas-extensao/regras";
import type { CampoPeca } from "@/lib/pecas-extensao/schema";

type Props = {
  acao: (
    estado: EstadoFormularioPeca,
    formData: FormData,
  ) => Promise<EstadoFormularioPeca>;
  peca?: PecaExtensao;
  /** Peça desmembrada: o código fica só para leitura. */
  codigoTravado?: boolean;
  /** Mãe ou parte de desmembramento: o preço de compra fica só para leitura, com este motivo. */
  motivoCustoTravado?: string | null;
  cores: string[];
  texturas: string[];
  origens: string[];
  rotuloEnviar: string;
};

const ESTADO_INICIAL: EstadoFormularioPeca = {};

const classeCampo =
  "h-12 w-full rounded-xl border bg-white px-3 text-base text-neutral-900 placeholder:text-neutral-400 focus:ring-2 focus:ring-rose-200 focus:outline-none";

const AJUDA_PRECO = "Em branco é “não informado”; 0,00 é zero.";

/** 12.5 → "12,5", sem separador de milhar: o campo volta como ela digitaria. */
function medidaParaCampo(valor: number | null | undefined) {
  if (valor == null) return "";

  return valor.toLocaleString("pt-BR", {
    maximumFractionDigits: 2,
    useGrouping: false,
  });
}

/** Cadastro e edição usam o mesmo formulário — muda só a server action. */
export default function FormularioPeca({
  acao,
  peca,
  codigoTravado = false,
  motivoCustoTravado = null,
  cores,
  texturas,
  origens,
  rotuloEnviar,
}: Props) {
  const [estado, enviar, enviando] = useActionState(acao, ESTADO_INICIAL);
  const idCores = useId();
  const idTexturas = useId();
  const idOrigens = useId();

  // Controlados por causa da máscara (a mesma do Caixa: os dígitos entram
  // pela direita). Sobrevivem a um erro do servidor, que não remonta o form.
  const [precoCompra, setPrecoCompra] = useState(() =>
    mascararMoeda(valorParaCampo(peca?.precoCompra)),
  );
  const [precoVenda, setPrecoVenda] = useState(() =>
    mascararMoeda(valorParaCampo(peca?.precoVenda)),
  );

  function valor(campo: CampoPeca, inicial: string | null | undefined) {
    return estado.valores?.[campo] ?? inicial ?? "";
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

      <Campo
        rotulo="Código"
        erro={estado.erros?.codigo}
        ajuda={codigoTravado ? MENSAGEM_CODIGO_TRAVADO : undefined}
        obrigatorio
      >
        {(props) => (
          <input
            {...props}
            name="codigo"
            type="text"
            // Travado é readOnly, não disabled: o valor ainda vai no
            // envio, e a action confere que ele não mudou.
            defaultValue={codigoTravado ? peca?.codigo : valor("codigo", peca?.codigo)}
            readOnly={codigoTravado}
            placeholder="1254"
            autoCapitalize="none"
            autoCorrect="off"
            autoComplete="off"
            enterKeyHint="next"
            required
            className={`${props.className} ${
              codigoTravado ? "bg-neutral-100 text-neutral-600" : ""
            }`}
          />
        )}
      </Campo>

      <Campo rotulo="Cor" erro={estado.erros?.cor}>
        {(props) => (
          <>
            <input
              {...props}
              name="cor"
              type="text"
              defaultValue={valor("cor", peca?.cor)}
              list={idCores}
              autoCapitalize="sentences"
              autoComplete="off"
              enterKeyHint="next"
            />
            {/* Sugere o que ela já usou, em vez de obrigar a digitar. */}
            <datalist id={idCores}>
              {cores.map((cor) => (
                <option key={cor} value={cor} />
              ))}
            </datalist>
          </>
        )}
      </Campo>

      <Campo rotulo="Textura" erro={estado.erros?.textura}>
        {(props) => (
          <>
            <input
              {...props}
              name="textura"
              type="text"
              defaultValue={valor("textura", peca?.textura)}
              list={idTexturas}
              autoCapitalize="sentences"
              autoComplete="off"
              enterKeyHint="next"
            />
            <datalist id={idTexturas}>
              {texturas.map((textura) => (
                <option key={textura} value={textura} />
              ))}
            </datalist>
          </>
        )}
      </Campo>

      <div className="grid grid-cols-2 gap-3">
        <Campo rotulo="Gramas" erro={estado.erros?.gramas} sufixo="g">
          {(props) => (
            <input
              {...props}
              name="gramas"
              type="text"
              inputMode="decimal"
              defaultValue={valor("gramas", medidaParaCampo(peca?.gramas))}
              autoComplete="off"
              enterKeyHint="next"
            />
          )}
        </Campo>

        <Campo
          rotulo="Comprimento"
          erro={estado.erros?.comprimento_cm}
          sufixo="cm"
        >
          {(props) => (
            <input
              {...props}
              name="comprimento_cm"
              type="text"
              inputMode="decimal"
              defaultValue={valor(
                "comprimento_cm",
                medidaParaCampo(peca?.comprimentoCm),
              )}
              autoComplete="off"
              enterKeyHint="next"
            />
          )}
        </Campo>
      </div>

      <Campo
        rotulo="Preço de compra"
        erro={estado.erros?.preco_compra}
        ajuda={motivoCustoTravado ?? AJUDA_PRECO}
        prefixo="R$"
      >
        {(props) => (
          <input
            {...props}
            name="preco_compra"
            type="text"
            inputMode="decimal"
            // Travado é readOnly, como o código: o valor vai no envio e a
            // action confere que ele não mudou.
            value={precoCompra}
            readOnly={motivoCustoTravado !== null}
            onChange={(evento) =>
              setPrecoCompra(mascararMoeda(evento.target.value))
            }
            placeholder="0,00"
            autoComplete="off"
            enterKeyHint="next"
            className={`${props.className} ${
              motivoCustoTravado !== null ? "bg-neutral-100 text-neutral-600" : ""
            }`}
          />
        )}
      </Campo>

      <Campo
        rotulo="Preço de venda"
        erro={estado.erros?.preco_venda}
        ajuda={AJUDA_PRECO}
        prefixo="R$"
      >
        {(props) => (
          <input
            {...props}
            name="preco_venda"
            type="text"
            inputMode="decimal"
            value={precoVenda}
            onChange={(evento) =>
              setPrecoVenda(mascararMoeda(evento.target.value))
            }
            placeholder="0,00"
            autoComplete="off"
            enterKeyHint="next"
          />
        )}
      </Campo>

      <Campo rotulo="Origem" erro={estado.erros?.origem}>
        {(props) => (
          <>
            <input
              {...props}
              name="origem"
              type="text"
              defaultValue={valor("origem", peca?.origem)}
              list={idOrigens}
              placeholder="Fornecedor"
              autoCapitalize="words"
              autoComplete="off"
              enterKeyHint="next"
            />
            <datalist id={idOrigens}>
              {origens.map((origem) => (
                <option key={origem} value={origem} />
              ))}
            </datalist>
          </>
        )}
      </Campo>

      <Campo rotulo="Nº de origem" erro={estado.erros?.numero_origem}>
        {(props) => (
          <input
            {...props}
            name="numero_origem"
            type="text"
            defaultValue={valor("numero_origem", peca?.numeroOrigem)}
            placeholder="Lacre do fornecedor"
            autoCapitalize="none"
            autoCorrect="off"
            autoComplete="off"
            enterKeyHint="next"
          />
        )}
      </Campo>

      <Campo rotulo="Data de entrada" erro={estado.erros?.data_entrada}>
        {(props) => (
          <input
            {...props}
            name="data_entrada"
            type="date"
            // Nasce vazia na peça nova: data não informada é NULL, e
            // "hoje" preenchido sozinho seria um dado que ela não deu.
            defaultValue={valor("data_entrada", peca?.dataEntrada)}
            // Só dica para o calendário; quem recusa o futuro é o schema.
            max={hoje()}
          />
        )}
      </Campo>

      <Campo rotulo="Observações" erro={estado.erros?.observacoes} multilinha>
        {(props) => (
          <textarea
            {...props}
            name="observacoes"
            defaultValue={valor("observacoes", peca?.observacoes)}
            rows={3}
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
  sufixo,
  multilinha,
  children,
}: {
  rotulo: string;
  erro?: string;
  ajuda?: string;
  obrigatorio?: boolean;
  prefixo?: string;
  sufixo?: string;
  multilinha?: boolean;
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
    } ${prefixo ? "pl-11 tabular-nums" : ""} ${sufixo ? "pr-11 tabular-nums" : ""} ${
      multilinha ? "h-auto py-2.5 leading-relaxed" : ""
    }`,
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

        {sufixo && (
          <span
            aria-hidden="true"
            className="pointer-events-none absolute top-1/2 right-3 -translate-y-1/2 text-neutral-400"
          >
            {sufixo}
          </span>
        )}
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
