"use client";

import { useId, useRef, useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Paperclip, Plus, Trash2 } from "lucide-react";

import type { EstadoCompra } from "@/app/(app)/produtos/compras/actions";
import { enviarNota } from "@/components/produtos/enviarNota";
import { Campo } from "@/components/produtos/FormularioPeca";
import { ACEITA_NOTA } from "@/components/produtos/NotaCompra";
import { hoje } from "@/lib/caixa/mes";
import type { CompraDetalhe } from "@/lib/estoque/consultas";
import {
  indicesProdutoRepetido,
  MENSAGEM_PRODUTO_REPETIDO,
  totalDaCompra,
} from "@/lib/estoque/regras";
import { MAXIMO_ITENS } from "@/lib/estoque/schema";
import {
  formatarMoeda,
  mascararMoeda,
  moedaParaNumero,
  valorParaCampo,
} from "@/lib/formatters";

export type ProdutoParaCompra = {
  id: string;
  nome: string;
  marca: string | null;
  /** Só aparece inativo na edição, numa linha que já era da compra. */
  ativo: boolean;
};

type Linha = {
  chave: number;
  produto_id: string;
  quantidade: string;
  custo_unitario: string;
};

type Props = {
  acao: (compra: unknown) => Promise<EstadoCompra>;
  produtos: ProdutoParaCompra[];
  fornecedores: string[];
  compra?: CompraDetalhe;
  /** Nova compra: a nota vai junto. Na edição, ela mora no detalhe. */
  comNota?: boolean;
  cancelarHref: "/produtos/compras" | `/produtos/compras/${string}`;
  rotuloEnviar: string;
};

let proximaChave = 0;

function linhaVazia(): Linha {
  return { chave: proximaChave++, produto_id: "", quantidade: "", custo_unitario: "" };
}

/**
 * Nova compra e edição: fornecedor (com os já usados de sugestão), data,
 * as linhas de produto + quantidade + custo, e a nota na compra nova.
 *
 * O mesmo produto não entra duas vezes: a linha repetida avisa na hora,
 * e a action e o banco recusam de novo.
 */
export default function FormularioCompra({
  acao,
  produtos,
  fornecedores,
  compra,
  comNota = false,
  cancelarHref,
  rotuloEnviar,
}: Props) {
  const router = useRouter();
  const idFornecedores = useId();
  const [enviando, iniciar] = useTransition();
  const [estado, setEstado] = useState<EstadoCompra>({});

  const [fornecedor, setFornecedor] = useState(compra?.fornecedor ?? "");
  const [data, setData] = useState(compra?.data ?? hoje());
  const [observacoes, setObservacoes] = useState(compra?.observacoes ?? "");
  const [arquivo, setArquivo] = useState<File | null>(null);
  const entradaNota = useRef<HTMLInputElement>(null);
  const [linhas, setLinhas] = useState<Linha[]>(() =>
    compra && compra.itens.length > 0
      ? compra.itens.map((item) => ({
          chave: proximaChave++,
          produto_id: item.produtoId,
          quantidade: String(item.quantidade),
          custo_unitario: mascararMoeda(valorParaCampo(item.custoUnitario)),
        }))
      : [linhaVazia()],
  );

  const repetidas = indicesProdutoRepetido(linhas.map((l) => l.produto_id));

  const total = totalDaCompra(
    linhas.flatMap((linha) => {
      const quantidade = Number(linha.quantidade);
      const custo = moedaParaNumero(linha.custo_unitario);

      return Number.isInteger(quantidade) && quantidade > 0 && custo !== null
        ? [{ quantidade, custoUnitario: custo }]
        : [];
    }),
  );

  function alterar(chave: number, mudanca: Partial<Linha>) {
    setLinhas((atuais) =>
      atuais.map((linha) => (linha.chave === chave ? { ...linha, ...mudanca } : linha)),
    );
  }

  function enviar(evento: React.FormEvent<HTMLFormElement>) {
    evento.preventDefault();

    // A linha repetida já está avisando; não adianta ir ao servidor.
    if (repetidas.size > 0) return;

    iniciar(async () => {
      try {
        const resultado = await acao({
          fornecedor,
          data,
          observacoes,
          itens: linhas.map(({ produto_id, quantidade, custo_unitario }) => ({
            produto_id,
            quantidade,
            custo_unitario,
          })),
        });

        if (!resultado.id) {
          setEstado(resultado);
          return;
        }

        // A compra está salva. A nota sobe agora; se falhar, o detalhe
        // da compra avisa e oferece mandar de novo.
        const falha = arquivo ? await enviarNota(resultado.id, arquivo) : null;

        router.push(
          `/produtos/compras/${resultado.id}${falha ? "?nota=falhou" : ""}`,
        );
      } catch {
        setEstado({ mensagem: "Não foi possível salvar. Tente de novo." });
      }
    });
  }

  return (
    <form onSubmit={enviar} className="space-y-5" noValidate>
      {estado.mensagem && (
        <p
          role="alert"
          className="rounded-xl border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-800"
        >
          {estado.mensagem}
        </p>
      )}

      <Campo rotulo="Fornecedor" erro={estado.erros?.fornecedor} obrigatorio>
        {(props) => (
          <>
            <input
              {...props}
              name="fornecedor"
              type="text"
              value={fornecedor}
              onChange={(evento) => setFornecedor(evento.target.value)}
              list={idFornecedores}
              autoCapitalize="words"
              autoComplete="off"
              enterKeyHint="next"
            />
            {/* Sugere quem ela já usou, em vez de obrigar a digitar. */}
            <datalist id={idFornecedores}>
              {fornecedores.map((nome) => (
                <option key={nome} value={nome} />
              ))}
            </datalist>
          </>
        )}
      </Campo>

      <Campo rotulo="Data da compra" erro={estado.erros?.data} obrigatorio>
        {(props) => (
          <input
            {...props}
            name="data"
            type="date"
            value={data}
            onChange={(evento) => setData(evento.target.value)}
            // Só dica para o calendário; quem recusa o futuro é o schema.
            max={hoje()}
          />
        )}
      </Campo>

      <fieldset className="space-y-3">
        <legend className="mb-1.5 text-sm font-medium text-neutral-700">
          Produtos<span className="text-rose-600"> *</span>
        </legend>

        {linhas.map((linha, indice) => {
          const erros = estado.errosItens?.[indice] ?? {};
          const erroProduto =
            erros.produto_id ??
            (repetidas.has(indice) ? MENSAGEM_PRODUTO_REPETIDO : undefined);

          return (
            <div
              key={linha.chave}
              className="space-y-3 rounded-2xl border border-neutral-200 bg-white p-3"
            >
              <div className="flex items-end gap-2">
                <div className="min-w-0 flex-1">
                  <Campo rotulo={`Produto ${indice + 1}`} erro={erroProduto}>
                    {(props) => (
                      <select
                        {...props}
                        value={linha.produto_id}
                        onChange={(evento) =>
                          alterar(linha.chave, { produto_id: evento.target.value })
                        }
                      >
                        <option value="">Escolha o produto</option>
                        {produtos.map((produto) => (
                          <option key={produto.id} value={produto.id}>
                            {produto.nome}
                            {produto.marca ? ` (${produto.marca})` : ""}
                            {produto.ativo ? "" : " — inativo"}
                          </option>
                        ))}
                      </select>
                    )}
                  </Campo>
                </div>

                {linhas.length > 1 && (
                  <button
                    type="button"
                    onClick={() =>
                      setLinhas((atuais) =>
                        atuais.filter((l) => l.chave !== linha.chave),
                      )
                    }
                    aria-label={`Tirar o produto ${indice + 1}`}
                    className={`flex size-12 shrink-0 items-center justify-center rounded-xl text-neutral-500 active:bg-neutral-100 ${
                      erroProduto ? "mb-6" : ""
                    }`}
                  >
                    <Trash2 aria-hidden="true" className="size-5" />
                  </button>
                )}
              </div>

              <div className="grid grid-cols-2 gap-3">
                <Campo rotulo="Quantidade" erro={erros.quantidade} sufixo="un">
                  {(props) => (
                    <input
                      {...props}
                      type="text"
                      // Frasco se compra inteiro: teclado só de números.
                      inputMode="numeric"
                      value={linha.quantidade}
                      onChange={(evento) =>
                        alterar(linha.chave, { quantidade: evento.target.value })
                      }
                      autoComplete="off"
                    />
                  )}
                </Campo>

                <Campo
                  rotulo="Custo unitário"
                  erro={erros.custo_unitario}
                  prefixo="R$"
                >
                  {(props) => (
                    <input
                      {...props}
                      type="text"
                      inputMode="decimal"
                      value={linha.custo_unitario}
                      onChange={(evento) =>
                        alterar(linha.chave, {
                          custo_unitario: mascararMoeda(evento.target.value),
                        })
                      }
                      placeholder="0,00"
                      autoComplete="off"
                    />
                  )}
                </Campo>
              </div>
            </div>
          );
        })}

        {linhas.length < MAXIMO_ITENS && (
          <button
            type="button"
            onClick={() => setLinhas((atuais) => [...atuais, linhaVazia()])}
            className="flex h-12 w-full items-center justify-center gap-2 rounded-xl border border-dashed border-neutral-300 font-medium text-rose-700 active:bg-rose-50"
          >
            <Plus aria-hidden="true" className="size-5" />
            Mais um produto
          </button>
        )}

        <p className="flex items-center justify-between px-1 text-sm text-neutral-600">
          Total da compra
          <span className="font-semibold tabular-nums text-neutral-900">
            {formatarMoeda(total)}
          </span>
        </p>
      </fieldset>

      <Campo rotulo="Observações" erro={estado.erros?.observacoes} multilinha>
        {(props) => (
          <textarea
            {...props}
            name="observacoes"
            value={observacoes}
            onChange={(evento) => setObservacoes(evento.target.value)}
            rows={2}
          />
        )}
      </Campo>

      {comNota && (
        <div>
          <p className="mb-1.5 text-sm font-medium text-neutral-700">
            Nota fiscal
          </p>

          <input
            ref={entradaNota}
            id="nota-nova-compra"
            type="file"
            accept={ACEITA_NOTA}
            className="sr-only"
            onChange={(evento) => setArquivo(evento.target.files?.[0] ?? null)}
          />

          <label
            htmlFor="nota-nova-compra"
            className="flex min-h-12 w-full items-center justify-center gap-2 rounded-xl border border-neutral-300 bg-white px-3 text-center font-medium text-neutral-700 active:bg-neutral-100"
          >
            <Paperclip aria-hidden="true" className="size-5 shrink-0" />
            <span className="truncate">
              {arquivo ? arquivo.name : "Anexar foto ou PDF (opcional)"}
            </span>
          </label>

          {arquivo && (
            <button
              type="button"
              onClick={() => {
                setArquivo(null);
                // Libera o input para escolher o mesmo arquivo de novo.
                if (entradaNota.current) entradaNota.current.value = "";
              }}
              className="mt-1 flex h-11 w-full items-center justify-center text-sm font-medium text-neutral-500 active:bg-neutral-100"
            >
              Sem nota
            </button>
          )}
        </div>
      )}

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
