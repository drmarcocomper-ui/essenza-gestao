"use client";

import { useId, useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Minus, Plus } from "lucide-react";

import {
  desmembrarPeca,
  type EstadoDesmembrar,
} from "@/app/(app)/produtos/extensao/actions";
import { hoje } from "@/lib/caixa/mes";
import { formatarMoeda, mascararMoeda, moedaParaNumero } from "@/lib/formatters";
import type { PecaExtensao } from "@/lib/pecas-extensao/consultas";
import {
  conferirCustos,
  indicesCodigoRepetido,
  MAXIMO_PARTES,
  MENSAGEM_CODIGO_REPETIDO_PARTES,
  MINIMO_PARTES,
  paraCentavos,
  sugerirCodigos,
  textoConferencia,
} from "@/lib/pecas-extensao/regras";
import type { CampoPeca } from "@/lib/pecas-extensao/schema";

import { Campo } from "./FormularioPeca";

type Parte = Record<CampoPeca, string>;

type Props = {
  mae: PecaExtensao;
  /** O preço de compra da mãe, já conferido não nulo pela página. */
  custoMae: number;
  cores: string[];
  texturas: string[];
  origens: string[];
};

/**
 * Cor, textura, origem, nº de origem e data de entrada nascem copiados
 * da mãe — o corte não muda nada disso. Medidas, preços e observações
 * nascem vazios: são da parte.
 */
function parteInicial(mae: PecaExtensao, codigo: string): Parte {
  return {
    codigo,
    cor: mae.cor ?? "",
    textura: mae.textura ?? "",
    gramas: "",
    comprimento_cm: "",
    preco_compra: "",
    preco_venda: "",
    origem: mae.origem ?? "",
    numero_origem: mae.numeroOrigem ?? "",
    data_entrada: mae.dataEntrada ?? "",
    observacoes: "",
  };
}

function gramas(valor: number | null) {
  return valor === null
    ? "— g"
    : `${valor.toLocaleString("pt-BR", { maximumFractionDigits: 2 })} g`;
}

/** Campo em branco ou ilegível fica fora da soma. */
function lerNumero(texto: string) {
  return texto.trim() === "" ? null : moedaParaNumero(texto);
}

const COR_SITUACAO = {
  fecha: "bg-emerald-100 text-emerald-800",
  faltam: "bg-amber-100 text-amber-900",
  sobram: "bg-rose-100 text-rose-800",
} as const;

/**
 * Corta a peça em 2 a 10 partes. A soma dos custos é conferida a cada
 * tecla, em centavos, e o botão só libera quando ela fecha com o custo
 * da mãe. É conveniência: a action confere tudo de novo.
 */
export default function FormularioDesmembrar({
  mae,
  custoMae,
  cores,
  texturas,
  origens,
}: Props) {
  const router = useRouter();
  const idCores = useId();
  const idTexturas = useId();
  const idOrigens = useId();

  const [partes, setPartes] = useState<Parte[]>(() =>
    sugerirCodigos(mae.codigo, MINIMO_PARTES).map((codigo) =>
      parteInicial(mae, codigo),
    ),
  );
  const [resposta, setResposta] = useState<EstadoDesmembrar>({});
  const [enviando, iniciar] = useTransition();

  function mudarQuantidade(quantidade: number) {
    setPartes((atuais) => {
      if (quantidade <= atuais.length) return atuais.slice(0, quantidade);

      // Só as partes novas recebem código sugerido: as de cima ficam
      // como ela deixou.
      const codigos = sugerirCodigos(mae.codigo, quantidade);

      return [
        ...atuais,
        ...codigos.slice(atuais.length).map((codigo) => parteInicial(mae, codigo)),
      ];
    });
  }

  function mudarCampo(indice: number, campo: CampoPeca, valor: string) {
    setPartes((atuais) =>
      atuais.map((parte, i) => (i === indice ? { ...parte, [campo]: valor } : parte)),
    );
  }

  const custos = partes.map((parte) => lerNumero(parte.preco_compra));
  const conferencia = conferirCustos(custos, custoMae);
  const faltaCusto = custos.some((custo) => custo === null);

  const somaGramas =
    partes.reduce(
      (soma, parte) => soma + paraCentavos(lerNumero(parte.gramas) ?? 0),
      0,
    ) / 100;

  const repetidos = new Set(indicesCodigoRepetido(partes.map((p) => p.codigo)));

  const podeConfirmar = conferencia.situacao === "fecha" && !faltaCusto && !enviando;

  function confirmar() {
    iniciar(async () => {
      setResposta({});

      try {
        const saida = await desmembrarPeca(mae.id, partes);

        if (saida.mensagem || saida.erros) {
          setResposta({
            ...saida,
            mensagem: saida.mensagem ?? "Confira os campos marcados nas partes.",
          });
          return;
        }

        router.push("/produtos");
      } catch {
        setResposta({ mensagem: "Não foi possível desmembrar. Tente de novo." });
      }
    });
  }

  return (
    <form
      onSubmit={(evento) => {
        evento.preventDefault();
        if (podeConfirmar) confirmar();
      }}
      className="space-y-5"
    >
      <dl className="grid grid-cols-3 gap-2 rounded-2xl border border-neutral-200 bg-white px-4 py-3 text-sm">
        <div className="min-w-0">
          <dt className="text-neutral-500">Código</dt>
          <dd className="truncate font-medium text-neutral-900">{mae.codigo}</dd>
        </div>
        <div>
          <dt className="text-neutral-500">Gramas</dt>
          <dd className="font-medium tabular-nums text-neutral-900">
            {gramas(mae.gramas)}
          </dd>
        </div>
        <div>
          <dt className="text-neutral-500">Custo</dt>
          <dd className="font-medium tabular-nums text-neutral-900">
            {formatarMoeda(custoMae)}
          </dd>
        </div>
      </dl>

      <div className="flex items-center justify-between">
        <span id="rotulo-quantidade" className="text-sm font-medium text-neutral-700">
          Quantas partes?
        </span>

        <div
          role="group"
          aria-labelledby="rotulo-quantidade"
          className="flex items-center gap-1"
        >
          <button
            type="button"
            onClick={() => mudarQuantidade(partes.length - 1)}
            disabled={partes.length <= MINIMO_PARTES}
            aria-label="Uma parte a menos"
            className="flex size-12 items-center justify-center rounded-xl border border-neutral-300 bg-white text-neutral-700 active:bg-neutral-100 disabled:opacity-40"
          >
            <Minus aria-hidden="true" className="size-5" />
          </button>

          <output
            aria-live="polite"
            className="w-10 text-center text-lg font-semibold tabular-nums text-neutral-900"
          >
            {partes.length}
          </output>

          <button
            type="button"
            onClick={() => mudarQuantidade(partes.length + 1)}
            disabled={partes.length >= MAXIMO_PARTES}
            aria-label="Uma parte a mais"
            className="flex size-12 items-center justify-center rounded-xl border border-neutral-300 bg-white text-neutral-700 active:bg-neutral-100 disabled:opacity-40"
          >
            <Plus aria-hidden="true" className="size-5" />
          </button>
        </div>
      </div>

      {/* Uma lista para cada campo com sugestão, compartilhada pelas partes. */}
      <datalist id={idCores}>
        {cores.map((cor) => (
          <option key={cor} value={cor} />
        ))}
      </datalist>
      <datalist id={idTexturas}>
        {texturas.map((textura) => (
          <option key={textura} value={textura} />
        ))}
      </datalist>
      <datalist id={idOrigens}>
        {origens.map((origem) => (
          <option key={origem} value={origem} />
        ))}
      </datalist>

      {partes.map((parte, indice) => {
        const erros = resposta.erros?.[indice] ?? {};
        const erroCodigo =
          erros.codigo ??
          (repetidos.has(indice) ? MENSAGEM_CODIGO_REPETIDO_PARTES : undefined);

        // O `children` do Campo é chamado como função, não montado como
        // componente: estes são só atalhos para não repetir o input.
        const texto = (campo: CampoPeca, extra: React.ComponentProps<"input"> = {}) => {
          function controle(props: React.ComponentProps<"input">) {
            return (
              <input
                {...props}
                type="text"
                value={parte[campo]}
                onChange={(evento) => mudarCampo(indice, campo, evento.target.value)}
                autoComplete="off"
                enterKeyHint="next"
                {...extra}
              />
            );
          }

          return controle;
        };

        // Máscara do Caixa: os dígitos entram pela direita.
        const preco = (campo: "preco_compra" | "preco_venda") => {
          function controle(props: React.ComponentProps<"input">) {
            return (
              <input
                {...props}
                type="text"
                inputMode="decimal"
                value={parte[campo]}
                onChange={(evento) =>
                  mudarCampo(indice, campo, mascararMoeda(evento.target.value))
                }
                placeholder="0,00"
                autoComplete="off"
                enterKeyHint="next"
              />
            );
          }

          return controle;
        };

        return (
          <fieldset
            key={indice}
            className="space-y-4 rounded-2xl border border-neutral-200 bg-white p-4"
          >
            <legend className="px-1 text-sm font-semibold text-neutral-900">
              Parte {indice + 1}
            </legend>

            <Campo rotulo="Código" erro={erroCodigo} obrigatorio>
              {texto("codigo", {
                autoCapitalize: "none",
                autoCorrect: "off",
                required: true,
              })}
            </Campo>

            <div className="grid grid-cols-2 gap-3">
              <Campo rotulo="Cor" erro={erros.cor}>
                {texto("cor", { list: idCores, autoCapitalize: "sentences" })}
              </Campo>

              <Campo rotulo="Textura" erro={erros.textura}>
                {texto("textura", {
                  list: idTexturas,
                  autoCapitalize: "sentences",
                })}
              </Campo>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <Campo rotulo="Gramas" erro={erros.gramas} sufixo="g">
                {texto("gramas", { inputMode: "decimal" })}
              </Campo>

              <Campo rotulo="Comprimento" erro={erros.comprimento_cm} sufixo="cm">
                {texto("comprimento_cm", { inputMode: "decimal" })}
              </Campo>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <Campo
                rotulo="Preço de compra"
                erro={erros.preco_compra}
                prefixo="R$"
                obrigatorio
              >
                {preco("preco_compra")}
              </Campo>

              <Campo rotulo="Preço de venda" erro={erros.preco_venda} prefixo="R$">
                {preco("preco_venda")}
              </Campo>
            </div>

            <Campo rotulo="Origem" erro={erros.origem}>
              {texto("origem", {
                list: idOrigens,
                placeholder: "Fornecedor",
                autoCapitalize: "words",
              })}
            </Campo>

            <Campo rotulo="Nº de origem" erro={erros.numero_origem}>
              {texto("numero_origem", {
                placeholder: "Lacre do fornecedor",
                autoCapitalize: "none",
                autoCorrect: "off",
              })}
            </Campo>

            <Campo rotulo="Data de entrada" erro={erros.data_entrada}>
              {texto("data_entrada", { type: "date", max: hoje() })}
            </Campo>

            <Campo rotulo="Observações" erro={erros.observacoes} multilinha>
              {(props) => (
                <textarea
                  {...props}
                  value={parte.observacoes}
                  onChange={(evento) =>
                    mudarCampo(indice, "observacoes", evento.target.value)
                  }
                  rows={2}
                />
              )}
            </Campo>
          </fieldset>
        );
      })}

      <Link
        href={`/produtos/extensao/${mae.id}`}
        className="flex h-12 items-center justify-center rounded-xl border border-neutral-300 bg-white font-medium text-neutral-700 active:bg-neutral-100"
      >
        Cancelar
      </Link>

      {/* Preso acima da BottomNav (h-14): a soma fica à vista enquanto ela digita. */}
      <div className="sticky bottom-[calc(3.75rem+env(safe-area-inset-bottom))] space-y-2 rounded-2xl border border-neutral-200 bg-white/95 p-3 shadow-lg backdrop-blur">
        <div aria-live="polite" className="space-y-1 text-sm tabular-nums">
          <p className="flex items-center justify-between gap-2">
            <span className="text-neutral-700">
              Custo: {formatarMoeda(conferencia.somaCentavos / 100)} de{" "}
              {formatarMoeda(custoMae)}
            </span>
            <span
              className={`shrink-0 rounded-full px-2 py-0.5 text-xs font-medium ${
                COR_SITUACAO[conferencia.situacao]
              }`}
            >
              {textoConferencia(conferencia)}
            </span>
          </p>

          <p className="text-xs text-neutral-500">
            Gramas: {gramas(somaGramas)} de {gramas(mae.gramas)}
          </p>

          {faltaCusto && (
            <p className="text-xs text-neutral-500">
              Informe o preço de compra de todas as partes.
            </p>
          )}
        </div>

        {resposta.mensagem && (
          <p
            role="alert"
            className="rounded-xl border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-800"
          >
            {resposta.mensagem}
          </p>
        )}

        <button
          type="submit"
          disabled={!podeConfirmar}
          className="h-12 w-full rounded-xl bg-rose-600 font-medium text-white active:bg-rose-700 disabled:opacity-50"
        >
          {enviando ? "Desmembrando…" : `Desmembrar em ${partes.length} partes`}
        </button>
      </div>
    </form>
  );
}
