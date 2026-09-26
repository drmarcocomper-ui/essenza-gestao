"use client";

import { useActionState, useId, useRef, useState } from "react";
import { Minus, Plus, X } from "lucide-react";

import type { EstadoConta } from "@/app/(app)/clientes/[id]/atendimentos/[atendimentoId]/actions";
import {
  ChipDeCatalogo,
  GrupoDeChips,
  MarcaDeEscolha,
} from "@/components/atendimentos/ChipsDeCatalogo";
import {
  diferencaConta,
  dividirEmParcelas,
  emCentavos,
  exigeDataDePagamento,
  exigeModalidade,
  exigeTitularidade,
  formatarCentavos,
  INSTITUICOES,
  modalidadeDe,
  MODALIDADES_CARTAO,
  PARCELAS_MAXIMO,
  ROTULO_MODALIDADE,
  TITULARIDADES_CONTA,
  totalItens,
  totalFormas,
  type Instituicao,
  type ModalidadeCartao,
  type TitularidadeConta,
  type TipoItem,
} from "@/lib/atendimentos/conta";
import type {
  ProdutoCatalogo,
  ServicoCatalogo,
} from "@/lib/atendimentos/consultas";
import {
  decidirProdutoPorNome,
  sugerirProdutos,
  type ProdutoConferivel,
} from "@/lib/atendimentos/produtos";
import { jaEscolhido as nomeJaEscolhido } from "@/lib/atendimentos/servicos";
import { normalizar } from "@/lib/busca";
import { hoje } from "@/lib/caixa/mes";
import { mascararMoeda, moedaParaNumero } from "@/lib/formatters";
import type { PecaVendavel } from "@/lib/pecas-extensao/consultas";
import {
  codigoContemTermo,
  descricaoDaPecaNaConta,
  resumoDaPeca,
} from "@/lib/pecas-extensao/regras";
import { agruparPorCategoria, ordenarPorNome } from "@/lib/servicos/grupos";

export type LinhaItem = {
  tipo: TipoItem;
  /** `servico_id`, `produto_id` ou `peca_extensao_id`. Vazio no produto novo. */
  refId: string;
  nome: string;
  quantidade: number;
  /** Mascarado, como ela digita. Vazio é "sem valor", nunca zero. */
  valor: string;
  /**
   * Produto fora do catálogo, confirmado na pergunta. A action cadastra
   * antes de gravar o item.
   */
  novo?: boolean;
  /**
   * Peça de extensão: "Castanho · 100 g · 55 cm", para ela conferir a
   * peça na conta. Só a tela usa; não viaja no formulário.
   */
  detalhe?: string;
};

/**
 * A chave da linha na tela. Produto novo ainda não tem id, então é o
 * nome normalizado que o distingue — o mesmo critério que impede o
 * mesmo nome de entrar duas vezes.
 */
function chaveDaLinha(linha: LinhaItem) {
  return linha.novo
    ? `novo:${normalizar(linha.nome)}`
    : `${linha.tipo}:${linha.refId}`;
}

/** Produto do catálogo como linha da conta, com o preço como sugestão. */
function linhaDoProduto(produto: ProdutoCatalogo): LinhaItem {
  return {
    tipo: "produto",
    refId: produto.id,
    nome: produto.nome,
    quantidade: 1,
    valor: paraCampo(produto.preco),
  };
}

/**
 * Peça de extensão como linha da conta: uma unidade, sempre, e o preço de
 * venda como sugestão — vazio quando a peça não tem, e ela digita.
 */
function linhaDaPeca(peca: PecaVendavel): LinhaItem {
  return {
    tipo: "peca_extensao",
    refId: peca.id,
    nome: descricaoDaPecaNaConta(peca.codigo),
    quantidade: 1,
    valor: paraCampo(peca.precoVenda),
    detalhe: resumoDaPeca(peca),
  };
}

/** Quantas peças a busca mostra de uma vez; o resto aparece digitando. */
const MAXIMO_PECAS_NA_LISTA = 20;

type LinhaForma = {
  chave: number;
  instituicao: Instituicao | "";
  titularidade: TitularidadeConta | "";
  /** Crédito ou débito. Só a maquininha pergunta; nas outras fica "". */
  modalidade: ModalidadeCartao | "";
  /** Vezes no crédito. 1 em tudo que não é crédito parcelado. */
  parcelas: number;
  valor: string;
};

type Props = {
  acao: (estado: EstadoConta, formData: FormData) => Promise<EstadoConta>;
  servicos: ServicoCatalogo[];
  produtos: ProdutoCatalogo[];
  /** A tabela `produtos` inteira, para conferir o nome digitado. */
  todosProdutos: ProdutoConferivel[];
  itensIniciais: LinhaItem[];
  /**
   * Peças que podem entrar nesta conta (`listarPecasVendaveis`): inteiras
   * e livres, ou já nesta conta. Vazio esconde o bloco Peças de extensão.
   */
  pecas: PecaVendavel[];
};

const ESTADO_INICIAL: EstadoConta = {};

const classeCampo =
  "h-12 w-full rounded-xl border border-neutral-300 bg-white px-3 text-base text-neutral-900 focus:border-rose-500 focus:ring-2 focus:ring-rose-200 focus:outline-none";

/**
 * A conta do atendimento — a tela que substitui a calculadora.
 *
 * Ela soma na frente da cliente, então tudo aqui é toque: os serviços
 * são uma lista agrupada por categoria (24 num monte só viram rolagem
 * pura), a quantidade tem botão de mais e menos, e o valor abre teclado
 * numérico com a máscara montando de centavo para a esquerda.
 *
 * O preço do catálogo entra como sugestão e continua editável: ela cobra
 * diferente quando quer. O que não tem preço entra VAZIO, nunca zero —
 * R$ 0,00 na tela lê como cortesia.
 *
 * Itens e formas de pagamento não se correspondem: a máscara não foi
 * paga no cartão e o corte no Pix. O que amarra as duas listas é o
 * total, e a diferença fica na tela o tempo todo.
 */
export default function FecharConta({
  acao,
  servicos,
  produtos,
  todosProdutos,
  itensIniciais,
  pecas,
}: Props) {
  const [estado, enviar, enviando] = useActionState(acao, ESTADO_INICIAL);

  const [linhas, setLinhas] = useState<LinhaItem[]>(itensIniciais);
  const [formas, setFormas] = useState<LinhaForma[]>([]);
  const [dataCaixa, setDataCaixa] = useState(hoje());

  const [outroProduto, setOutroProduto] = useState("");
  /** Nome à espera do "sim" para virar produto novo no catálogo. */
  const [perguntando, setPerguntando] = useState<string | null>(null);
  /** Por que o nome digitado não pode entrar (desativado, ambíguo...). */
  const [avisoProduto, setAvisoProduto] = useState<string | null>(null);
  /** O que ela digitou na busca de peça de extensão. */
  const [termoPeca, setTermoPeca] = useState("");

  // Duas formas podem ser da mesma instituição, então a chave não pode
  // sair do conteúdo da linha.
  const proximaChave = useRef(0);
  const idData = useId();
  const idOutroProduto = useId();
  const idBuscaPeca = useId();

  const itensValorados = linhas.map((linha) => ({
    quantidade: linha.quantidade,
    valorUnitario: moedaParaNumero(linha.valor) ?? 0,
  }));

  const formasValoradas = formas.map((forma) => ({
    valor: moedaParaNumero(forma.valor) ?? 0,
  }));

  const total = totalItens(itensValorados);
  const pago = totalFormas(formasValoradas);
  const diferenca = diferencaConta(itensValorados, formasValoradas);

  // A mesma regra que o schema usa no servidor. Em conta 100% crédito
  // nenhuma linha nasce Paga, e a data não teria onde ser gravada.
  const formasModalidade = formas.map((forma) => ({
    instituicao: forma.instituicao,
    modalidade: forma.modalidade || null,
  }));
  const pedeData = exigeDataDePagamento(formasModalidade);
  const temCredito = formasModalidade.some(
    (forma) => modalidadeDe(forma.instituicao, forma.modalidade) === "credito",
  );

  const escolhido = (tipo: string, refId: string) =>
    linhas.some((linha) => linha.tipo === tipo && linha.refId === refId);

  function alternar(linha: LinhaItem) {
    const chave = chaveDaLinha(linha);

    setLinhas((atuais) =>
      atuais.some((atual) => chaveDaLinha(atual) === chave)
        ? atuais.filter((atual) => chaveDaLinha(atual) !== chave)
        : [...atuais, linha],
    );
  }

  const produtosNovos = linhas.filter((linha) => linha.novo);

  const pecasEncontradas = pecas.filter((peca) =>
    codigoContemTermo(peca.codigo, termoPeca),
  );
  const pecasNaLista = pecasEncontradas.slice(0, MAXIMO_PECAS_NA_LISTA);

  /** Sugestões para a pergunta, sem o que já está na conta. */
  const sugestoes = perguntando
    ? sugerirProdutos(
        todosProdutos.filter((produto) => !escolhido("produto", produto.id)),
        perguntando,
      )
    : [];

  function limparOutroProduto() {
    setOutroProduto("");
    setPerguntando(null);
  }

  /** Entra o produto do catálogo — pelo nome digitado ou pela sugestão. */
  function adicionarDoCatalogo(id: string, nome: string) {
    const doCatalogo = produtos.find((produto) => produto.id === id);

    setLinhas((atuais) => [
      ...atuais,
      doCatalogo
        ? linhaDoProduto(doCatalogo)
        : linhaDoProduto({ id, nome, preco: null }),
    ]);
    limparOutroProduto();
  }

  /**
   * Mesmo caminho do serviço na 4A: o nome é conferido na tabela inteira
   * pelo nome normalizado antes de qualquer pergunta. O que casa com um
   * produto de venda ativo entra como ele; o que casa com algo que não
   * pode entrar vira aviso; só o que não casa com nada pergunta se é
   * produto novo. O servidor confere de novo ao salvar.
   */
  function adicionarOutroProduto() {
    const nome = outroProduto.trim();

    setAvisoProduto(null);

    const naConta = linhas.filter((linha) => linha.tipo === "produto");

    if (nome.length < 2 || nomeJaEscolhido(naConta, nome)) {
      limparOutroProduto();
      return;
    }

    const decisao = decidirProdutoPorNome(todosProdutos, nome);

    if (decisao.acao === "reaproveitar") {
      adicionarDoCatalogo(decisao.produto.id, decisao.produto.nome);
      return;
    }

    if (decisao.acao === "recusar") {
      setAvisoProduto(decisao.mensagem);
      return;
    }

    setPerguntando(nome);
  }

  function confirmarProdutoNovo() {
    if (!perguntando) return;

    setLinhas((atuais) => [
      ...atuais,
      {
        tipo: "produto",
        refId: "",
        nome: perguntando,
        quantidade: 1,
        // Sem preço: o valor desta venda é digitado aqui.
        valor: "",
        novo: true,
      },
    ]);
    limparOutroProduto();
  }

  function mudarLinha(indice: number, mudanca: Partial<LinhaItem>) {
    setLinhas((atuais) =>
      atuais.map((linha, posicao) =>
        posicao === indice ? { ...linha, ...mudanca } : linha,
      ),
    );
  }

  function mudarForma(chave: number, mudanca: Partial<LinhaForma>) {
    setFormas((atuais) =>
      atuais.map((forma) =>
        forma.chave === chave ? { ...forma, ...mudanca } : forma,
      ),
    );
  }

  /**
   * A forma nova já nasce com o que ainda falta receber. Numa conta de
   * uma forma só — que é a maioria — não sobra nada para digitar.
   */
  function adicionarForma() {
    const falta = -diferenca;

    setFormas((atuais) => [
      ...atuais,
      {
        chave: proximaChave.current++,
        instituicao: "",
        titularidade: "",
        modalidade: "",
        parcelas: 1,
        valor: falta > 0 ? mascararMoeda(String(falta)) : "",
      },
    ]);
  }

  /**
   * A frase que explica o botão desligado. Some assim que a conta fecha.
   * Botão cinza sem motivo escrito é ela olhando para a tela no meio do
   * atendimento sem saber o que falta.
   */
  const impedimento = motivoParaNaoFechar({ linhas, formas, diferenca });

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

      {/* Listas paralelas em campo escondido: o formulário é controlado
          por estado, e nenhum campo visível leva `name`. */}
      {linhas.map((linha) => (
        <div key={chaveDaLinha(linha)} hidden>
          <input type="hidden" name="item_tipo" value={linha.tipo} />
          <input type="hidden" name="item_ref" value={linha.refId} />
          {/* `item_novo` é o "sim" da pergunta: sem ele a action não
              cadastra produto. */}
          <input type="hidden" name="item_nome" value={linha.nome} />
          <input
            type="hidden"
            name="item_novo"
            value={linha.novo ? "1" : "0"}
          />
          <input
            type="hidden"
            name="item_quantidade"
            value={String(linha.quantidade)}
          />
          <input type="hidden" name="item_valor" value={linha.valor} />
        </div>
      ))}

      {formas.map((forma) => (
        <div key={forma.chave} hidden>
          <input
            type="hidden"
            name="forma_instituicao"
            value={forma.instituicao}
          />
          <input
            type="hidden"
            name="forma_titularidade"
            value={forma.titularidade}
          />
          <input
            type="hidden"
            name="forma_modalidade"
            value={forma.modalidade}
          />
          <input
            type="hidden"
            name="forma_parcelas"
            value={String(forma.parcelas)}
          />
          <input type="hidden" name="forma_valor" value={forma.valor} />
        </div>
      ))}

      <section className="space-y-2">
        <h3 className="text-sm font-medium text-neutral-500">
          O que foi feito
        </h3>

        {estado.erros?.itens && (
          <p role="alert" className="text-sm text-rose-700">
            {estado.erros.itens}
          </p>
        )}

        {agruparPorCategoria(servicos).map((grupo) => (
          <GrupoDeChips
            key={grupo.chave || "sem-categoria"}
            rotulo={grupo.rotulo}
            escolhidos={
              grupo.servicos.filter((servico) =>
                escolhido("servico", servico.id),
              ).length
            }
          >
            {grupo.servicos.map((servico) => (
              <ChipDeCatalogo
                key={servico.id}
                nome={servico.nome}
                marcado={escolhido("servico", servico.id)}
                semPreco={servico.preco === null}
                aoTocar={() =>
                  alternar({
                    tipo: "servico",
                    refId: servico.id,
                    nome: servico.nome,
                    quantidade: 1,
                    valor: paraCampo(servico.preco),
                  })
                }
              />
            ))}
          </GrupoDeChips>
        ))}

        {produtos.length > 0 && (
          <GrupoDeChips
            rotulo="Produtos"
            escolhidos={
              produtos.filter((produto) => escolhido("produto", produto.id))
                .length
            }
          >
            {ordenarPorNome(produtos).map((produto) => (
              <ChipDeCatalogo
                key={produto.id}
                nome={produto.nome}
                marcado={escolhido("produto", produto.id)}
                semPreco={produto.preco === null}
                aoTocar={() => alternar(linhaDoProduto(produto))}
              />
            ))}
          </GrupoDeChips>
        )}

        {/* O mesmo padrão do serviço novo na 4A: chip "· novo" com X,
            campo de nome e a pergunta antes de cadastrar. */}
        {produtosNovos.length > 0 && (
          <div className="flex flex-wrap gap-2">
            {produtosNovos.map((produto) => (
              <span
                key={chaveDaLinha(produto)}
                className="flex min-h-11 items-center gap-1.5 rounded-full border border-rose-600 bg-rose-600 pr-2 pl-4 text-sm font-medium text-white"
              >
                {produto.nome}
                <span className="text-xs font-normal text-rose-100">
                  · novo
                </span>
                <button
                  type="button"
                  onClick={() => alternar(produto)}
                  aria-label={`Tirar ${produto.nome}`}
                  className="flex size-9 items-center justify-center rounded-full active:bg-rose-700"
                >
                  <X aria-hidden="true" className="size-4" />
                </button>
              </span>
            ))}
          </div>
        )}

        <div className="flex gap-2">
          <label htmlFor={idOutroProduto} className="sr-only">
            Outro produto
          </label>

          <input
            id={idOutroProduto}
            type="text"
            value={outroProduto}
            onChange={(evento) => {
              setOutroProduto(evento.target.value);
              // Continuar digitando desfaz a pergunta e o aviso: eram
              // sobre o nome de um instante atrás.
              setPerguntando(null);
              setAvisoProduto(null);
            }}
            onKeyDown={(evento) => {
              // Enter aqui adiciona o produto, não fecha a conta pela
              // metade.
              if (evento.key === "Enter") {
                evento.preventDefault();
                adicionarOutroProduto();
              }
            }}
            placeholder="Outro produto"
            autoCapitalize="sentences"
            autoComplete="off"
            enterKeyHint="done"
            className={classeCampo}
          />

          <button
            type="button"
            onClick={adicionarOutroProduto}
            aria-label="Adicionar produto"
            className="flex size-12 shrink-0 items-center justify-center rounded-xl border border-neutral-300 bg-white text-neutral-700 active:bg-neutral-100"
          >
            <Plus aria-hidden="true" className="size-5" />
          </button>
        </div>

        {avisoProduto && (
          <p role="alert" className="text-sm text-rose-700">
            {avisoProduto}
          </p>
        )}

        {/* Catálogo nunca nasce em silêncio. E antes do "sim", o que já
            existe com nome parecido — "Glaze Drops" é o "Gloss Absolu
            Glaze drops" que já está lá. */}
        {perguntando && (
          <div className="space-y-3 rounded-xl border border-amber-200 bg-amber-50 p-3">
            <div>
              <p className="text-sm font-medium text-amber-900">
                Cadastrar “{perguntando}” como produto novo?
              </p>
              <p className="mt-1 text-xs text-amber-700">
                Entra no catálogo sem preço, marcado para você acertar
                depois. O valor desta venda você digita aqui na conta.
              </p>
            </div>

            {sugestoes.length > 0 && (
              <div className="space-y-2">
                <p className="text-xs font-medium text-amber-900">
                  Ou é um destes?
                </p>

                <div className="flex flex-wrap gap-2">
                  {sugestoes.map((produto) => (
                    <button
                      key={produto.id}
                      type="button"
                      onClick={() =>
                        adicionarDoCatalogo(produto.id, produto.nome)
                      }
                      className="flex min-h-11 items-center rounded-full border border-neutral-300 bg-white px-4 text-sm font-medium text-neutral-700 active:bg-neutral-100"
                    >
                      {produto.nome}
                    </button>
                  ))}
                </div>
              </div>
            )}

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
                onClick={confirmarProdutoNovo}
                className="h-11 flex-1 rounded-xl bg-amber-600 text-sm font-medium text-white active:bg-amber-700"
              >
                Cadastrar
              </button>
            </div>
          </div>
        )}

        {/* Peça de extensão: a peça única do estoque (018), não o produto
            de catálogo "Extensão capilar", que continua nos Produtos. Só
            aparece quando há peça que pode entrar nesta conta. Não se chama
            só "Extensão" porque esse já é o bloco da categoria de serviços
            (manutenção, revisão...), na mesma tela. */}
        {pecas.length > 0 && (
          <GrupoDeChips
            rotulo="Peças de extensão"
            escolhidos={
              linhas.filter((linha) => linha.tipo === "peca_extensao").length
            }
          >
            <div className="w-full">
              <label htmlFor={idBuscaPeca} className="sr-only">
                Buscar peça pelo código
              </label>

              <input
                id={idBuscaPeca}
                type="search"
                value={termoPeca}
                onChange={(evento) => setTermoPeca(evento.target.value)}
                onKeyDown={(evento) => {
                  // Enter aqui não fecha a conta pela metade.
                  if (evento.key === "Enter") evento.preventDefault();
                }}
                placeholder="Código da peça"
                autoCapitalize="none"
                autoCorrect="off"
                autoComplete="off"
                enterKeyHint="search"
                className={classeCampo}
              />
            </div>

            {pecasNaLista.length === 0 ? (
              <p className="w-full px-1 text-sm text-neutral-500">
                Nenhuma peça com esse código.
              </p>
            ) : (
              <ul className="w-full space-y-2">
                {pecasNaLista.map((peca) => {
                  const marcada = escolhido("peca_extensao", peca.id);

                  return (
                    <li key={peca.id}>
                      <button
                        type="button"
                        onClick={() => alternar(linhaDaPeca(peca))}
                        aria-pressed={marcada}
                        className={`flex min-h-11 w-full items-center gap-2 rounded-xl border px-3 py-2 text-left text-sm ${
                          marcada
                            ? "border-rose-600 bg-rose-600 text-white"
                            : "border-neutral-300 bg-white text-neutral-700 active:bg-neutral-100"
                        }`}
                      >
                        <MarcaDeEscolha marcado={marcada} />
                        <span className="ml-1 font-medium">{peca.codigo}</span>
                        <span
                          className={`min-w-0 truncate ${
                            marcada ? "text-rose-100" : "text-neutral-500"
                          }`}
                        >
                          · {resumoDaPeca(peca)}
                        </span>
                      </button>
                    </li>
                  );
                })}
              </ul>
            )}

            {pecasEncontradas.length > pecasNaLista.length && (
              <p className="w-full px-1 text-xs text-neutral-500">
                Mais {pecasEncontradas.length - pecasNaLista.length} — digite o
                código para achar.
              </p>
            )}
          </GrupoDeChips>
        )}
      </section>

      {linhas.length > 0 && (
        <section className="space-y-2">
          <h3 className="text-sm font-medium text-neutral-500">
            Itens ({linhas.length})
          </h3>

          <ul className="space-y-2">
            {linhas.map((linha, indice) => (
              <li
                key={chaveDaLinha(linha)}
                className="space-y-3 rounded-2xl border border-neutral-200 bg-white p-3"
              >
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0 flex-1">
                    <p className="font-medium text-neutral-900">
                      {linha.nome}
                      {linha.novo && (
                        <span className="ml-1.5 text-xs font-normal text-amber-700">
                          · novo
                        </span>
                      )}
                    </p>

                    {linha.detalhe && (
                      <p className="text-xs text-neutral-500 tabular-nums">
                        {linha.detalhe}
                      </p>
                    )}
                  </div>

                  <button
                    type="button"
                    onClick={() => alternar(linha)}
                    aria-label={`Tirar ${linha.nome} da conta`}
                    className="-m-1 flex size-11 shrink-0 items-center justify-center rounded-xl text-neutral-400 active:bg-neutral-100"
                  >
                    <X aria-hidden="true" className="size-5" />
                  </button>
                </div>

                <div className="flex items-center gap-3">
                  {/* Peça é uma unidade (020): sem mais e menos. */}
                  {linha.tipo !== "peca_extensao" && (
                    <Quantidade
                      nome={linha.nome}
                      valor={linha.quantidade}
                      aoTrocar={(quantidade) =>
                        mudarLinha(indice, { quantidade })
                      }
                    />
                  )}

                  <CampoMoeda
                    rotulo={`Valor de ${linha.nome}`}
                    valor={linha.valor}
                    aoTrocar={(valor) => mudarLinha(indice, { valor })}
                  />
                </div>
              </li>
            ))}
          </ul>
        </section>
      )}

      <section className="space-y-2">
        <h3 className="text-sm font-medium text-neutral-500">
          Como ela pagou
        </h3>

        {estado.erros?.formas && (
          <p role="alert" className="text-sm text-rose-700">
            {estado.erros.formas}
          </p>
        )}

        <ul className="space-y-2">
          {formas.map((forma) => (
            <li
              key={forma.chave}
              className="space-y-3 rounded-2xl border border-neutral-200 bg-white p-3"
            >
              <div className="flex items-center gap-2">
                <label className="sr-only" htmlFor={`instituicao-${forma.chave}`}>
                  Forma de pagamento
                </label>

                <select
                  id={`instituicao-${forma.chave}`}
                  value={forma.instituicao}
                  onChange={(evento) =>
                    mudarForma(forma.chave, {
                      instituicao: evento.target.value as Instituicao | "",
                      // Trocar a instituição joga fora a titularidade e a
                      // modalidade antigas: eram resposta de outra
                      // pergunta, e parcelamento de maquininha não segue
                      // para o Pix.
                      titularidade: "",
                      modalidade: "",
                      parcelas: 1,
                    })
                  }
                  className={`${classeCampo} flex-1`}
                >
                  <option value="">Escolha…</option>
                  {INSTITUICOES.map((instituicao) => (
                    <option key={instituicao} value={instituicao}>
                      {instituicao}
                    </option>
                  ))}
                </select>

                <button
                  type="button"
                  onClick={() =>
                    setFormas((atuais) =>
                      atuais.filter((atual) => atual.chave !== forma.chave),
                    )
                  }
                  aria-label="Tirar esta forma de pagamento"
                  className="flex size-11 shrink-0 items-center justify-center rounded-xl text-neutral-400 active:bg-neutral-100"
                >
                  <X aria-hidden="true" className="size-5" />
                </button>
              </div>

              {/* Só onde a mesma marca tem as duas contas. Nas outras a
                  pergunta não existe, e nada é gravado por acidente. */}
              {exigeTitularidade(forma.instituicao) && (
                <div
                  role="group"
                  aria-label={`Titularidade do ${forma.instituicao}`}
                  className="flex gap-2"
                >
                  {TITULARIDADES_CONTA.map((titularidade) => {
                    const ativo = forma.titularidade === titularidade;

                    return (
                      <button
                        key={titularidade}
                        type="button"
                        onClick={() =>
                          mudarForma(forma.chave, { titularidade })
                        }
                        aria-pressed={ativo}
                        className={`h-11 flex-1 rounded-xl border font-medium ${
                          ativo
                            ? "border-rose-600 bg-rose-600 text-white"
                            : "border-neutral-300 bg-white text-neutral-600 active:bg-neutral-100"
                        }`}
                      >
                        {titularidade}
                      </button>
                    );
                  })}
                </div>
              )}

              {/* Só na maquininha. É a única instituição que passa as
                  duas coisas, e a única que não diz sozinha como o
                  dinheiro andou. */}
              {exigeModalidade(forma.instituicao) && (
                <div
                  role="group"
                  aria-label={`Cartão na ${forma.instituicao}`}
                  className="flex gap-2"
                >
                  {MODALIDADES_CARTAO.map((modalidade) => {
                    const ativo = forma.modalidade === modalidade;

                    return (
                      <button
                        key={modalidade}
                        type="button"
                        onClick={() =>
                          mudarForma(forma.chave, {
                            modalidade,
                            // Débito não parcela: o número que ficou na
                            // tela não pode sobreviver à troca.
                            parcelas:
                              modalidade === "credito" ? forma.parcelas : 1,
                          })
                        }
                        aria-pressed={ativo}
                        className={`h-11 flex-1 rounded-xl border font-medium ${
                          ativo
                            ? "border-rose-600 bg-rose-600 text-white"
                            : "border-neutral-300 bg-white text-neutral-600 active:bg-neutral-100"
                        }`}
                      >
                        {ROTULO_MODALIDADE[modalidade]}
                      </button>
                    );
                  })}
                </div>
              )}

              <CampoMoeda
                rotulo="Valor desta forma de pagamento"
                valor={forma.valor}
                aoTrocar={(valor) => mudarForma(forma.chave, { valor })}
              />

              {forma.modalidade === "credito" && (
                <Parcelamento
                  chave={forma.chave}
                  parcelas={forma.parcelas}
                  valor={forma.valor}
                  aoTrocar={(parcelas) => mudarForma(forma.chave, { parcelas })}
                />
              )}
            </li>
          ))}
        </ul>

        <button
          type="button"
          onClick={adicionarForma}
          className="flex h-12 w-full items-center justify-center gap-2 rounded-xl border border-dashed border-neutral-300 bg-white font-medium text-neutral-700 active:bg-neutral-100"
        >
          <Plus aria-hidden="true" className="size-5" />
          {formas.length === 0 ? "Forma de pagamento" : "Dividir em outra"}
        </button>
      </section>

      {/* A data só vale para o que nasce Pago. Sem nada assim na conta,
          o campo sai da tela — cinza ou opcional ainda pareceria que ela
          está dizendo quando o dinheiro entrou. */}
      {pedeData ? (
        <div>
          <label
            htmlFor={idData}
            className="mb-1.5 block text-sm font-medium text-neutral-700"
          >
            Data do pagamento (do que entrou hoje){" "}
            <span className="text-rose-600">*</span>
          </label>

          <input
            id={idData}
            name="data_caixa"
            type="date"
            value={dataCaixa}
            max={hoje()}
            onChange={(evento) => setDataCaixa(evento.target.value)}
            required
            className={classeCampo}
          />

          {temCredito && (
            <p className="mt-1 text-xs text-neutral-500">
              As parcelas do crédito não usam esta data — você confirma cada
              uma em A receber, no dia em que cair.
            </p>
          )}

          {estado.erros?.data_caixa && (
            <p className="mt-1 text-sm text-rose-700">
              {estado.erros.data_caixa}
            </p>
          )}
        </div>
      ) : (
        <p className="rounded-xl border border-neutral-200 bg-neutral-50 px-3 py-2 text-sm text-neutral-700">
          Nada entra no caixa hoje. As parcelas vão para A receber e você
          confirma cada uma no dia em que cair.
        </p>
      )}

      {/* O lugar onde ela confere antes de dizer o preço em voz alta. */}
      <section className="space-y-1 rounded-2xl border border-neutral-200 bg-white p-4">
        <Soma rotulo="Total" centavos={total} destaque />
        <Soma rotulo="Pago" centavos={pago} />

        {diferenca !== 0 && (
          <Soma
            rotulo={diferenca < 0 ? "Falta" : "Sobra"}
            centavos={Math.abs(diferenca)}
            cor={diferenca < 0 ? "text-amber-700" : "text-rose-700"}
          />
        )}
      </section>

      <div className="space-y-2 pt-1">
        {impedimento && (
          <p className="text-center text-sm text-neutral-500">{impedimento}</p>
        )}

        <button
          type="submit"
          disabled={enviando || impedimento !== null}
          className="h-14 w-full rounded-xl bg-rose-600 text-lg font-medium text-white active:bg-rose-700 disabled:bg-neutral-300"
        >
          {enviando ? "Fechando…" : "Fechar conta"}
        </button>
      </div>
    </form>
  );
}

/**
 * Por que o botão está desligado, na ordem em que ela resolveria.
 * Null quer dizer que a conta fecha.
 */
function motivoParaNaoFechar({
  linhas,
  formas,
  diferenca,
}: {
  linhas: LinhaItem[];
  formas: LinhaForma[];
  diferenca: number;
}) {
  if (linhas.length === 0) return "Escolha o que foi feito.";

  const semValor = linhas.find((linha) => moedaParaNumero(linha.valor) === null);

  if (semValor) return `Falta o valor de ${semValor.nome}.`;

  if (formas.length === 0) return "Diga por onde ela pagou.";

  if (formas.some((forma) => forma.instituicao === "")) {
    return "Escolha a forma de pagamento.";
  }

  const semTitular = formas.find(
    (forma) => exigeTitularidade(forma.instituicao) && forma.titularidade === "",
  );

  if (semTitular) return `Diga se o ${semTitular.instituicao} é PF ou PJ.`;

  const semModalidade = formas.find(
    (forma) => exigeModalidade(forma.instituicao) && forma.modalidade === "",
  );

  if (semModalidade) {
    return `Diga se o ${semModalidade.instituicao} foi crédito ou débito.`;
  }

  if (formas.some((forma) => moedaParaNumero(forma.valor) === null)) {
    return "Falta o valor de uma forma de pagamento.";
  }

  if (diferenca < 0) {
    return `Faltam ${formatarCentavos(-diferenca)} nas formas de pagamento.`;
  }

  if (diferenca > 0) {
    return `Sobram ${formatarCentavos(diferenca)} nas formas de pagamento.`;
  }

  return null;
}

/** Preço do catálogo no campo. Sem preço fica VAZIO, nunca "0,00". */
function paraCampo(preco: number | null) {
  if (preco === null) return "";

  return preco.toLocaleString("pt-BR", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}

/**
 * Em quantas vezes ela passou no crédito.
 *
 * O resumo embaixo é o que ela confere em voz alta na frente da cliente
 * — e é onde a sobra de centavo aparece, em vez de virar surpresa no
 * extrato. Parcelado, só aparece com valor digitado: "3× de R$ 0,00"
 * leria como cortesia parcelada.
 */
function Parcelamento({
  chave,
  parcelas,
  valor,
  aoTrocar,
}: {
  chave: number;
  parcelas: number;
  valor: string;
  aoTrocar: (parcelas: number) => void;
}) {
  const resumo = resumoDasParcelas(valor, parcelas);

  return (
    <div className="space-y-1">
      <label
        htmlFor={`parcelas-${chave}`}
        className="block text-sm font-medium text-neutral-700"
      >
        Em quantas vezes
      </label>

      <select
        id={`parcelas-${chave}`}
        value={parcelas}
        onChange={(evento) => aoTrocar(Number(evento.target.value))}
        className={classeCampo}
      >
        {Array.from({ length: PARCELAS_MAXIMO }, (_, indice) => indice + 1).map(
          (vezes) => (
            <option key={vezes} value={vezes}>
              {vezes === 1 ? "1× (à vista)" : `${vezes}×`}
            </option>
          ),
        )}
      </select>

      {resumo && (
        <p className="text-xs text-neutral-500 tabular-nums">{resumo}</p>
      )}
    </div>
  );
}

/**
 * A linha embaixo do "Em quantas vezes".
 *
 * Parcelado: "3× de R$ 209,96 (última R$ 209,98)". Null sem valor
 * digitado.
 *
 * À vista no crédito o dinheiro também não entra hoje, e é isso que a
 * linha diz. Nenhuma data é calculada — quem informa o dia é ela.
 */
function resumoDasParcelas(valor: string, parcelas: number) {
  if (parcelas < 2) {
    return "Entra em ~30 dias — você confirma em A receber.";
  }

  const numero = moedaParaNumero(valor);

  if (numero === null) return null;

  const valores = dividirEmParcelas(numero, parcelas);
  const primeira = emCentavos(valores[0]);
  const ultima = emCentavos(valores[valores.length - 1]);
  const texto = `${parcelas}× de ${formatarCentavos(primeira)}`;

  return primeira === ultima
    ? texto
    : `${texto} (última ${formatarCentavos(ultima)})`;
}

/** Mais e menos, com alvo de 44px. Digitar número com uma mão é pior. */
function Quantidade({
  nome,
  valor,
  aoTrocar,
}: {
  nome: string;
  valor: number;
  aoTrocar: (valor: number) => void;
}) {
  return (
    <div className="flex shrink-0 items-center rounded-xl border border-neutral-300 bg-white">
      <button
        type="button"
        onClick={() => aoTrocar(Math.max(1, valor - 1))}
        disabled={valor <= 1}
        aria-label={`Menos um ${nome}`}
        className="flex size-11 items-center justify-center rounded-l-xl text-neutral-600 active:bg-neutral-100 disabled:text-neutral-300"
      >
        <Minus aria-hidden="true" className="size-4" />
      </button>

      <span
        aria-label={`Quantidade de ${nome}`}
        className="w-7 text-center font-medium text-neutral-900 tabular-nums"
      >
        {valor}
      </span>

      <button
        type="button"
        onClick={() => aoTrocar(Math.min(99, valor + 1))}
        aria-label={`Mais um ${nome}`}
        className="flex size-11 items-center justify-center rounded-r-xl text-neutral-600 active:bg-neutral-100"
      >
        <Plus aria-hidden="true" className="size-4" />
      </button>
    </div>
  );
}

/**
 * O campo de valor, no mesmo padrão do Caixa: teclado numérico e máscara
 * montando da direita para a esquerda — ela digita 18000 e sai 180,00.
 *
 * Vazio continua vazio: o placeholder é cinza e não é um valor.
 */
function CampoMoeda({
  rotulo,
  valor,
  aoTrocar,
}: {
  rotulo: string;
  valor: string;
  aoTrocar: (valor: string) => void;
}) {
  return (
    <div className="relative min-w-0 flex-1">
      <span
        aria-hidden="true"
        className="pointer-events-none absolute top-1/2 left-3 -translate-y-1/2 font-medium text-neutral-400"
      >
        R$
      </span>

      <input
        type="text"
        inputMode="decimal"
        aria-label={rotulo}
        value={valor}
        onChange={(evento) => aoTrocar(mascararMoeda(evento.target.value))}
        placeholder="0,00"
        autoComplete="off"
        className="h-12 w-full rounded-xl border border-neutral-300 bg-white pr-3 pl-10 text-right text-lg font-semibold text-neutral-900 tabular-nums placeholder:font-normal placeholder:text-neutral-300 focus:border-rose-500 focus:ring-2 focus:ring-rose-200 focus:outline-none"
      />
    </div>
  );
}

function Soma({
  rotulo,
  centavos,
  destaque,
  cor,
}: {
  rotulo: string;
  centavos: number;
  destaque?: boolean;
  cor?: string;
}) {
  return (
    <div className="flex items-baseline justify-between gap-3">
      <span className={`text-sm ${cor ?? "text-neutral-500"}`}>{rotulo}</span>

      <span
        className={`tabular-nums ${cor ?? "text-neutral-900"} ${
          destaque ? "text-2xl font-semibold" : "text-base"
        }`}
      >
        {formatarCentavos(centavos)}
      </span>
    </div>
  );
}
