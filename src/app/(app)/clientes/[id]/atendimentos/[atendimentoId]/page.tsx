import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, FlaskConical, Lock, Plus } from "lucide-react";

import {
  fecharConta,
  reabrirConta,
} from "@/app/(app)/clientes/[id]/atendimentos/[atendimentoId]/actions";
import FecharConta, {
  type LinhaItem,
} from "@/components/atendimentos/FecharConta";
import ReabrirConta from "@/components/atendimentos/ReabrirConta";
import ChipParcela from "@/components/caixa/ChipParcela";
import { emCentavos, totalLinha } from "@/lib/atendimentos/conta";
import {
  listarProdutosParaConferencia,
  listarProdutosRevenda,
  listarServicos,
  obterAtendimento,
  type AtendimentoDetalhe,
} from "@/lib/atendimentos/consultas";
import { resumoReabertura } from "@/lib/atendimentos/reabertura";
import { obterCliente } from "@/lib/clientes/consultas";
import { formatarData, formatarDiaMes, formatarMoeda } from "@/lib/formatters";
import { listarPecasVendaveis } from "@/lib/pecas-extensao/consultas";
import { resumoDaPeca } from "@/lib/pecas-extensao/regras";

export async function generateMetadata({
  params,
}: PageProps<"/clientes/[id]/atendimentos/[atendimentoId]">): Promise<Metadata> {
  const { id, atendimentoId } = await params;
  const atendimento = await obterAtendimento(id, atendimentoId);

  return {
    title: atendimento
      ? `Atendimento de ${formatarData(atendimento.data)} — Essenza`
      : "Atendimento — Essenza",
  };
}

export default async function AtendimentoPage({
  params,
}: PageProps<"/clientes/[id]/atendimentos/[atendimentoId]">) {
  const { id, atendimentoId } = await params;

  const [cliente, atendimento] = await Promise.all([
    obterCliente(id),
    obterAtendimento(id, atendimentoId),
  ]);

  if (!cliente || !atendimento) {
    notFound();
  }

  // O catálogo só é lido quando a conta ainda abre: fechada, os nomes e
  // os valores saem do que está gravado.
  const [servicos, produtos, todosProdutos, pecas] = atendimento.fechada
    ? [[], [], [], []]
    : await Promise.all([
        listarServicos(),
        listarProdutosRevenda(),
        // Para a tela antecipar a conferência do produto digitado.
        listarProdutosParaConferencia(),
        // Peças que podem entrar nesta conta, com a desta conta inclusive.
        listarPecasVendaveis(atendimento.id),
      ]);

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <Link
          href={`/clientes/${cliente.id}`}
          aria-label="Voltar para a cliente"
          className="flex size-11 shrink-0 items-center justify-center rounded-xl border border-neutral-300 text-neutral-600 active:bg-neutral-100"
        >
          <ArrowLeft aria-hidden="true" className="size-5" />
        </Link>

        <div className="min-w-0">
          <h2 className="truncate text-lg font-semibold text-neutral-900">
            {formatarData(atendimento.data)}
          </h2>
          <p className="truncate text-sm text-neutral-500">{cliente.nome}</p>
        </div>
      </div>

      {atendimento.observacao && (
        <p className="rounded-2xl border border-neutral-200 bg-white px-4 py-3 text-sm whitespace-pre-line text-neutral-700">
          {atendimento.observacao}
        </p>
      )}

      {/* A ficha de coloração continua editável depois da conta fechada:
          resultado e ajuste para a próxima só aparecem depois. */}
      <Link
        href={
          atendimento.formulaId
            ? `/clientes/${cliente.id}/formulas/${atendimento.formulaId}`
            : `/clientes/${cliente.id}/formulas/nova?atendimento=${atendimento.id}`
        }
        className="flex h-12 w-full items-center justify-center gap-2 rounded-xl border border-rose-600 bg-white font-medium text-rose-700 active:bg-rose-50"
      >
        {atendimento.formulaId ? (
          <FlaskConical aria-hidden="true" className="size-5" />
        ) : (
          <Plus aria-hidden="true" className="size-5" />
        )}
        {atendimento.formulaId ? "Ver fórmula" : "Registrar fórmula"}
      </Link>

      {atendimento.fechada ? (
        <ContaFechada
          atendimento={atendimento}
          // Os dois ids amarrados no servidor, como no fechamento.
          reabrir={reabrirConta.bind(null, cliente.id, atendimento.id)}
        />
      ) : (
        <FecharConta
          // Os dois ids vêm amarrados no servidor: não trafegam em campo
          // escondido, que o navegador poderia trocar.
          acao={fecharConta.bind(null, cliente.id, atendimento.id)}
          servicos={servicos}
          produtos={produtos}
          todosProdutos={todosProdutos}
          itensIniciais={itensIniciais(atendimento, servicos, produtos)}
          pecas={pecas}
        />
      )}
    </div>
  );
}

/**
 * O que a conta já traz preenchido quando ela abre a tela.
 *
 * Os itens vêm do registro do atendimento (4A), que grava serviço sem
 * valor — `valor_unitario` fica no default 0 da 001. Zero ali é "ainda
 * não precificado", então o preço sugerido vem do catálogo, e o que o
 * catálogo não tem fica VAZIO: R$ 0,00 na tela lê como cortesia.
 *
 * A consequência é conhecida: se a gravação dos lançamentos falhar
 * DEPOIS de os itens entrarem, e algum item tiver sido fechado em zero
 * de propósito (cortesia), a segunda tentativa reabre com o preço do
 * catálogo e ela zera de novo. É o caso raro; o comum é o item de 4A
 * chegando aqui em zero, e esse não pode mostrar valor nenhum.
 *
 * A peça de extensão é outra história: a 4A não a oferece, então o item
 * de peça só existe porque esta conta já foi fechada (e reaberta) ou
 * tentou fechar. O valor dele é o que ela digitou — zero incluído, que
 * aí é cortesia de verdade — e volta como está.
 */
function itensIniciais(
  atendimento: AtendimentoDetalhe,
  servicos: { id: string; preco: number | null }[],
  produtos: { id: string; preco: number | null }[],
): LinhaItem[] {
  return atendimento.itens.map((item) => {
    if (item.tipo === "peca_extensao") {
      return {
        tipo: item.tipo,
        refId: item.pecaExtensaoId ?? "",
        nome: item.descricao,
        quantidade: 1,
        valor: paraCampo(item.valorUnitario),
        detalhe: item.peca ? resumoDaPeca(item.peca) : undefined,
      };
    }

    const doCatalogo =
      item.tipo === "servico"
        ? servicos.find((servico) => servico.id === item.servicoId)
        : produtos.find((produto) => produto.id === item.produtoId);

    const preco =
      item.valorUnitario > 0 ? item.valorUnitario : (doCatalogo?.preco ?? null);

    return {
      tipo: item.tipo,
      refId: (item.tipo === "servico" ? item.servicoId : item.produtoId) ?? "",
      nome: item.descricao,
      quantidade: item.quantidade > 0 ? Math.round(item.quantidade) : 1,
      valor: preco === null ? "" : paraCampo(preco),
    };
  });
}

function paraCampo(valor: number) {
  return valor.toLocaleString("pt-BR", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}

/**
 * A conta fechada, só leitura.
 *
 * O dinheiro da conta não se conserta pelo Caixa: lá o lançamento de
 * conta não é excluído nem muda de valor (src/lib/caixa/travas.ts). O
 * caminho é reabrir aqui — apaga os lançamentos, mantém os itens — e
 * fechar de novo.
 */
function ContaFechada({
  atendimento,
  reabrir,
}: {
  atendimento: AtendimentoDetalhe;
  reabrir: () => Promise<{ erro?: string }>;
}) {
  const total = atendimento.itens.reduce(
    (soma, item) => soma + totalLinha(item),
    0,
  );

  const recebido = atendimento.formas.reduce(
    (soma, forma) => soma + emCentavos(forma.valor),
    0,
  );

  return (
    <section className="space-y-4">
      <div className="flex items-center gap-2 text-sm font-medium text-emerald-700">
        <Lock aria-hidden="true" className="size-4" />
        Conta fechada
      </div>

      <ul className="divide-y divide-neutral-100 overflow-hidden rounded-2xl border border-neutral-200 bg-white">
        {atendimento.itens.map((item) => (
          <li key={item.id} className="flex items-center gap-3 px-4 py-3">
            {item.peca ? (
              // A peça vendida leva à ficha dela: é lá que se vê de onde
              // veio, quanto custou e em que conta entrou.
              <Link
                href={`/produtos/extensao/${item.peca.id}`}
                className="-my-1 flex min-h-11 min-w-0 flex-1 flex-col justify-center rounded-lg active:bg-neutral-100"
              >
                <span className="text-rose-700">{item.descricao}</span>
                <span className="text-xs text-neutral-500 tabular-nums">
                  {resumoDaPeca(item.peca)}
                </span>
              </Link>
            ) : (
              <span className="min-w-0 flex-1 text-neutral-900">
                {item.quantidade > 1 && (
                  <span className="text-neutral-500 tabular-nums">
                    {item.quantidade}×{" "}
                  </span>
                )}
                {item.descricao}
              </span>
            )}

            <span className="shrink-0 text-neutral-900 tabular-nums">
              {formatarMoeda(item.valorUnitario * item.quantidade)}
            </span>
          </li>
        ))}

        <li className="flex gap-3 bg-neutral-50 px-4 py-3 font-semibold">
          <span className="flex-1 text-neutral-900">Total</span>
          <span className="text-neutral-900 tabular-nums">
            {formatarMoeda(total / 100)}
          </span>
        </li>
      </ul>

      <ul className="divide-y divide-neutral-100 overflow-hidden rounded-2xl border border-neutral-200 bg-white">
        {atendimento.formas.map((forma) => (
          <li key={forma.id} className="flex items-baseline gap-3 px-4 py-3">
            <span className="min-w-0 flex-1">
              <span className="text-neutral-900">
                {forma.instituicao ?? "Sem instituição"}
              </span>

              {forma.titularidade && (
                <span className="ml-2 rounded-full bg-neutral-100 px-2 py-0.5 text-xs font-medium text-neutral-600">
                  {forma.titularidade}
                </span>
              )}

              {/* Parcela e estado de cada linha: sem eles, "SumUp · PJ ·
                  R$ 209,96" três vezes não diz que são 1/3, 2/3 e 3/3,
                  nem que ainda não entraram. Pendente não mostra data de
                  caixa — ainda não caiu; a previsão fica em "A receber". */}
              <span className="mt-1 flex flex-wrap items-center gap-2 text-xs">
                <ChipParcela parcelamento={forma.parcelamento} />

                {forma.status === "Pendente" ? (
                  <span className="font-medium text-amber-700">A receber</span>
                ) : (
                  forma.dataCaixa && (
                    <span className="text-neutral-500 tabular-nums">
                      Recebido em {formatarDiaMes(forma.dataCaixa)}
                    </span>
                  )
                )}
              </span>
            </span>

            <span className="shrink-0 text-neutral-900 tabular-nums">
              {formatarMoeda(forma.valor)}
            </span>
          </li>
        ))}
      </ul>

      {/* Itens e formas foram gravados na mesma passada e batem por
          construção. Se um dia não baterem — lançamento editado no Caixa,
          por exemplo —, é melhor ela ver o descompasso do que a tela
          esconder. */}
      {recebido !== total && (
        <p className="rounded-xl border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-900">
          Os lançamentos somam {formatarMoeda(recebido / 100)}, diferente do
          total dos itens. Para acertar, reabra a conta.
        </p>
      )}

      <ReabrirConta acao={reabrir} resumo={resumoReabertura(atendimento.formas)} />
    </section>
  );
}
