"use client";

import { useActionState, useId, useRef, useState } from "react";
import { Minus, Plus, X } from "lucide-react";

import type { EstadoConta } from "@/app/(app)/clientes/[id]/atendimentos/[atendimentoId]/actions";
import {
  ChipDeCatalogo,
  GrupoDeChips,
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
} from "@/lib/atendimentos/conta";
import type {
  ProdutoCatalogo,
  ServicoCatalogo,
} from "@/lib/atendimentos/consultas";
import { hoje } from "@/lib/caixa/mes";
import { mascararMoeda, moedaParaNumero } from "@/lib/formatters";
import { agruparPorCategoria } from "@/lib/servicos/grupos";

export type LinhaItem = {
  tipo: "servico" | "produto";
  /** `servico_id` ou `produto_id`. É a chave da linha na tela. */
  refId: string;
  nome: string;
  quantidade: number;
  /** Mascarado, como ela digita. Vazio é "sem valor", nunca zero. */
  valor: string;
};

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
  itensIniciais: LinhaItem[];
};

const ESTADO_INICIAL: EstadoConta = {};

const classeCampo =
  "h-12 w-full rounded-xl border border-neutral-300 bg-white px-3 text-base text-neutral-900 focus:border-rose-500 focus:ring-2 focus:ring-rose-200 focus:outline-none";

/**
 * A conta do atendimento — a tela que substitui a calculadora.
 *
 * Ela soma na frente da cliente, então tudo aqui é toque: os serviços
 * são chips agrupados por categoria (24 num monte só viram rolagem
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
  itensIniciais,
}: Props) {
  const [estado, enviar, enviando] = useActionState(acao, ESTADO_INICIAL);

  const [linhas, setLinhas] = useState<LinhaItem[]>(itensIniciais);
  const [formas, setFormas] = useState<LinhaForma[]>([]);
  const [dataCaixa, setDataCaixa] = useState(hoje());

  // Duas formas podem ser da mesma instituição, então a chave não pode
  // sair do conteúdo da linha.
  const proximaChave = useRef(0);
  const idData = useId();

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
    setLinhas((atuais) =>
      atuais.some(
        (atual) => atual.tipo === linha.tipo && atual.refId === linha.refId,
      )
        ? atuais.filter(
            (atual) =>
              !(atual.tipo === linha.tipo && atual.refId === linha.refId),
          )
        : [...atuais, linha],
    );
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
        <div key={`${linha.tipo}:${linha.refId}`} hidden>
          <input type="hidden" name="item_tipo" value={linha.tipo} />
          <input type="hidden" name="item_ref" value={linha.refId} />
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
            {produtos.map((produto) => (
              <ChipDeCatalogo
                key={produto.id}
                nome={produto.nome}
                marcado={escolhido("produto", produto.id)}
                semPreco={produto.preco === null}
                aoTocar={() =>
                  alternar({
                    tipo: "produto",
                    refId: produto.id,
                    nome: produto.nome,
                    quantidade: 1,
                    valor: paraCampo(produto.preco),
                  })
                }
              />
            ))}
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
                key={`${linha.tipo}:${linha.refId}`}
                className="space-y-3 rounded-2xl border border-neutral-200 bg-white p-3"
              >
                <div className="flex items-start justify-between gap-2">
                  <p className="min-w-0 flex-1 font-medium text-neutral-900">
                    {linha.nome}
                  </p>

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
                  <Quantidade
                    nome={linha.nome}
                    valor={linha.quantidade}
                    aoTrocar={(quantidade) =>
                      mudarLinha(indice, { quantidade })
                    }
                  />

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
