"use server";

import { revalidatePath } from "next/cache";

import {
  categoriaDaConta,
  contaSchema,
  descricaoDaConta,
  errosDaConta,
  lerConta,
  parcelasDaForma,
  type CampoConta,
  type TipoItem,
} from "@/lib/atendimentos/conta";
import {
  listarProdutosParaConferencia,
  listarProdutosRevenda,
  listarServicos,
  obterAtendimento,
} from "@/lib/atendimentos/consultas";
import {
  classificarFalhaConta,
  registrarFalhaConta,
} from "@/lib/atendimentos/erros";
import {
  decidirProdutoPorNome,
  novoProdutoDoAtendimento,
  type ProdutoConferivel,
} from "@/lib/atendimentos/produtos";
import { exigirSessao } from "@/lib/auth";
import { MENSAGEM_CONTA_JA_ABERTA } from "@/lib/caixa/travas";
import {
  lerPecasParaConta,
  type PecaParaConta,
} from "@/lib/pecas-extensao/consultas";
import {
  MENSAGEM_PECA_REPETIDA_NA_CONTA,
  MENSAGEM_PECA_SUMIU_DA_CONTA,
  mensagemPecaDesmembradaNaConta,
  mensagemPecaEmOutraConta,
  pecaVendavelNaConta,
} from "@/lib/pecas-extensao/regras";

export type EstadoConta = {
  erros?: Partial<Record<CampoConta, string>>;
  mensagem?: string;
};

/** Linha pronta para `atendimento_itens`, já com o nome vindo do banco. */
type ItemResolvido = {
  tipo: TipoItem;
  servico_id: string | null;
  produto_id: string | null;
  peca_extensao_id: string | null;
  descricao: string;
  quantidade: number;
  valor_unitario: number;
  /** Só para escolher a categoria do lançamento; não vai para o banco. */
  categoria: string | null;
};

type ClienteSupabase = Awaited<ReturnType<typeof exigirSessao>>["supabase"];

type ProdutoResolvido =
  | { ok: true; id: string; nome: string }
  | { ok: false; mensagem: string };

/**
 * Converte o produto digitado na conta em `produto_id`.
 *
 * A decisão é a de `decidirProdutoPorNome`, refeita aqui com a tabela
 * relida — a tela só a antecipou. O `refId` vazio só passa pelo schema
 * com a confirmação que a tela pediu, então chegar aqui já é o "sim".
 *
 * O cadastro acontece ANTES do passo (a) do fechamento. Se algo depois
 * falhar, o produto fica no catálogo e a conta segue aberta; na nova
 * tentativa o mesmo nome casa com ele e é reaproveitado — nunca duplica.
 *
 * `todos` é mutado de propósito: o mesmo nome duas vezes na mesma conta
 * casa com o recém-criado em vez de tentar criar outro.
 */
async function resolverProdutoNovo(
  supabase: ClienteSupabase,
  nome: string,
  todos: ProdutoConferivel[],
): Promise<ProdutoResolvido> {
  const decisao = decidirProdutoPorNome(todos, nome);

  if (decisao.acao === "recusar") {
    return { ok: false, mensagem: decisao.mensagem };
  }

  if (decisao.acao === "reaproveitar") {
    // Nome canônico do banco, não o que veio do formulário.
    return { ok: true, id: decisao.produto.id, nome: decisao.produto.nome };
  }

  const { data, error } = await supabase
    .from("produtos")
    .insert(novoProdutoDoAtendimento(nome))
    .select("id, nome, tipo, ativo")
    .single();

  if (error) {
    return {
      ok: false,
      mensagem: `Não foi possível cadastrar "${nome}": ${error.message}`,
    };
  }

  const criado = data as ProdutoConferivel;

  todos.push(criado);

  return { ok: true, id: criado.id, nome: criado.nome };
}

/**
 * Confere as peças de extensão que a tela mandou, relidas do banco
 * (`lerPecasParaConta`). Devolve o motivo da recusa, ou null.
 *
 * A mesma regra da tela (`pecaVendavelNaConta`): a peça existe, não foi
 * desmembrada e não é item de OUTRO atendimento — a desta mesma conta
 * (reaberta) passa. A mesma peça duas vezes também é recusada aqui, antes
 * do índice único da 020 recusar no insert.
 */
function conferirPecas(
  ids: readonly string[],
  pecas: readonly PecaParaConta[],
  atendimentoId: string,
) {
  if (new Set(ids).size !== ids.length) return MENSAGEM_PECA_REPETIDA_NA_CONTA;

  for (const id of ids) {
    const peca = pecas.find((linha) => linha.id === id);

    if (!peca) return MENSAGEM_PECA_SUMIU_DA_CONTA;

    if (pecaVendavelNaConta(peca, atendimentoId)) continue;

    return peca.temFilhas
      ? mensagemPecaDesmembradaNaConta(peca.codigo)
      : mensagemPecaEmOutraConta(peca.codigo);
  }

  return null;
}

/**
 * Fecha a conta do atendimento: grava os itens e o dinheiro.
 *
 * A ORDEM IMPORTA, e é esta:
 *   a. apaga os `atendimento_itens` deste atendimento
 *   b. insere todos os itens num único insert
 *   c. insere todos os lançamentos num único insert
 *
 * Um insert com várias linhas é atômico; a sequência inteira não é, e
 * não há transação aqui de propósito — ganhá-la exigiria uma função RPC,
 * que é migration, que está fora desta sessão.
 *
 * Por isso os lançamentos vêm por último: "existe lançamento com este
 * atendimento_id" é o que significa conta fechada. Se (c) falhar, os
 * itens ficam gravados, a conta segue aberta, e tentar de novo funciona
 * porque (a) limpa antes — nunca duplica item.
 */
export async function fecharConta(
  clienteId: string,
  atendimentoId: string,
  _estado: EstadoConta,
  formData: FormData,
): Promise<EstadoConta> {
  const { supabase } = await exigirSessao();

  const validacao = contaSchema.safeParse(lerConta(formData));

  if (!validacao.success) {
    return { erros: errosDaConta(validacao.error) };
  }

  const conta = validacao.data;

  // O atendimento é relido no servidor: a tela pode estar velha, e é
  // daqui que saem a data de competência e o estado da conta.
  const atendimento = await obterAtendimento(clienteId, atendimentoId);

  if (!atendimento) {
    return {
      mensagem: "Este atendimento não existe mais. Volte e abra de novo.",
    };
  }

  // A conta fecha uma vez. Fechar de novo duplicaria o dinheiro no
  // Caixa, que é pior do que recusar.
  if (atendimento.fechada) {
    return {
      mensagem:
        "Esta conta já foi fechada. Recarregue a tela para ver o que está gravado.",
    };
  }

  // JANELA DE CORRIDA, conhecida e aceita aqui: a verificação acima é
  // leitura antes da escrita. Dois POSTs simultâneos no mesmo
  // atendimento — duas abas, dois aparelhos — passam os dois pela
  // verificação antes de qualquer um inserir, e o dinheiro entra
  // duplicado no Caixa. Fechar isso é trabalho do banco: índice único
  // PARCIAL em `lancamentos.atendimento_id`. Parcial porque conta
  // dividida grava N lançamentos legítimos no mesmo atendimento, então
  // o `where` precisa de um recorte que pegue uma linha só por conta.
  // É migration, e fica para uma sessão de migration.

  const temProdutoNovo = conta.itens.some((item) => !item.refId);
  const idsPecas = conta.itens
    .filter((item) => item.tipo === "peca_extensao")
    .map((item) => item.refId);

  const [servicos, produtos, todos, pecas] = await Promise.all([
    listarServicos({ incluirInativos: true }),
    listarProdutosRevenda(),
    // A tabela inteira só quando há nome a conferir.
    temProdutoNovo ? listarProdutosParaConferencia() : [],
    lerPecasParaConta(idsPecas),
  ]);

  // As peças são conferidas ANTES do laço: o laço pode cadastrar produto
  // novo, e uma peça recusada depois disso deixaria o cadastro feito à
  // toa.
  const recusaPeca = conferirPecas(idsPecas, pecas, atendimentoId);

  if (recusaPeca) {
    return { erros: { itens: recusaPeca } };
  }

  const itens: ItemResolvido[] = [];

  for (const item of conta.itens) {
    if (item.tipo === "peca_extensao") {
      // Existe: `conferirPecas` acabou de conferir.
      const peca = pecas.find((linha) => linha.id === item.refId)!;

      itens.push({
        tipo: "peca_extensao",
        servico_id: null,
        produto_id: null,
        peca_extensao_id: peca.id,
        // Snapshot do código vindo do banco, como o nome do serviço.
        descricao: `Extensão ${peca.codigo}`,
        // O schema já recusou tudo que não é 1 (`chk_item_peca_quantidade`).
        quantidade: 1,
        valor_unitario: item.valorUnitario,
        categoria: null,
      });

      continue;
    }

    if (item.tipo === "servico") {
      const servico = servicos.find((linha) => linha.id === item.refId);

      if (!servico) {
        return {
          erros: { itens: "Um dos serviços não está mais no catálogo." },
        };
      }

      itens.push({
        tipo: "servico",
        servico_id: servico.id,
        produto_id: null,
        peca_extensao_id: null,
        // Snapshot do nome vindo do banco, não do navegador: o item
        // sobrevive à renomeação do catálogo, e o POST não escolhe texto.
        descricao: servico.nome,
        quantidade: item.quantidade,
        valor_unitario: item.valorUnitario,
        categoria: servico.categoria,
      });

      continue;
    }

    let produto: { id: string; nome: string } | undefined;

    if (item.refId) {
      produto = produtos.find((linha) => linha.id === item.refId);
    } else {
      // Produto digitado na conta: o schema só deixa `refId` vazio
      // passar com nome e confirmação.
      const resolvido = await resolverProdutoNovo(supabase, item.nome, todos);

      if (!resolvido.ok) {
        return { erros: { itens: resolvido.mensagem } };
      }

      produto = resolvido;
    }

    if (!produto) {
      return { erros: { itens: "Um dos produtos não está mais no catálogo." } };
    }

    itens.push({
      tipo: "produto",
      servico_id: null,
      produto_id: produto.id,
      peca_extensao_id: null,
      descricao: produto.nome,
      quantidade: item.quantidade,
      valor_unitario: item.valorUnitario,
      categoria: null,
    });
  }

  // Só tipo e categoria: a categoria do lançamento é por unanimidade, e
  // valor nenhum entra nessa decisão.
  const classificaveis = itens.map((item) => ({
    tipo: item.tipo,
    categoria: item.categoria,
  }));

  // (a) — limpa o que estava lá. É o que deixa uma segunda tentativa,
  // depois de (c) falhar, não duplicar item.
  const { error: erroLimpeza } = await supabase
    .from("atendimento_itens")
    .delete()
    .eq("atendimento_id", atendimentoId);

  if (erroLimpeza) {
    registrarFalhaConta("limpar", erroLimpeza);

    return { mensagem: classificarFalhaConta("limpar", erroLimpeza).texto };
  }

  // (b) — um insert só: as linhas entram todas ou nenhuma.
  const { error: erroItens } = await supabase.from("atendimento_itens").insert(
    // Coluna por coluna: `categoria` existe só para escolher a do
    // lançamento e não é coluna de `atendimento_itens`.
    itens.map((item) => ({
      atendimento_id: atendimentoId,
      tipo: item.tipo,
      servico_id: item.servico_id,
      produto_id: item.produto_id,
      peca_extensao_id: item.peca_extensao_id,
      descricao: item.descricao,
      quantidade: item.quantidade,
      valor_unitario: item.valor_unitario,
    })),
  );

  if (erroItens) {
    registrarFalhaConta("itens", erroItens);

    return {
      mensagem: classificarFalhaConta("itens", erroItens, {
        codigoDaPeca: (id) =>
          pecas.find((peca) => peca.id === id)?.codigo ?? null,
      }).texto,
    };
  }

  // (c) — o dinheiro por último. Um lançamento por PARCELA de cada forma
  // de pagamento: a conta paga em 3x no crédito grava três linhas, todas
  // com este `atendimento_id` e a mesma competência. É o
  // `atendimento_id` que amarra as parcelas entre si — não existe coluna
  // de vínculo, e não precisa: a conta é o vínculo.
  const { error: erroLancamentos } = await supabase.from("lancamentos").insert(
    conta.formas.flatMap((forma) =>
      parcelasDaForma(forma, conta.data_caixa, atendimento.data).map((parcela) => ({
        // Competência é a data do atendimento, igual em todas as
        // parcelas: o serviço foi prestado num dia só.
        data_competencia: atendimento.data,
        // Crédito nasce Pendente e sem data de caixa, inclusive a
        // primeira parcela — ela confirma cada uma em "A receber", no dia
        // em que o dinheiro cai. O resto nasce Pago com a data da tela.
        data_caixa: parcela.data_caixa,
        // Só crédito: atendimento + n × 30 dias. Previsão, não caixa.
        data_prevista: parcela.data_prevista,
        status: parcela.status,
        tipo: "Entrada",
        categoria: categoriaDaConta(classificaveis),
        descricao: descricaoDaConta(itens),
        cliente_id: clienteId,
        atendimento_id: atendimentoId,
        forma_pagamento: parcela.forma_pagamento,
        instituicao: forma.instituicao,
        titularidade: forma.titularidade,
        // 'n/N' quando parcelou de verdade; null em 1x, porque "1/1"
        // afirmaria um parcelamento que não houve.
        parcelamento: parcela.parcelamento,
        valor: parcela.valor,
        // A mesma coluna que a planilha preenchia, para os relatórios por
        // mês continuarem batendo com o histórico importado.
        mes_competencia: atendimento.data.slice(0, 7),
        // `origem_registro` fica no default 'app'.
      })),
    ),
  );

  if (erroLancamentos) {
    registrarFalhaConta("lancamentos", erroLancamentos);

    return {
      mensagem: classificarFalhaConta("lancamentos", erroLancamentos).texto,
    };
  }

  // A conta aparece em quatro lugares: a tela do atendimento, a ficha da
  // cliente (histórico e total) e as duas listas do Caixa.
  revalidatePath(`/clientes/${clienteId}/atendimentos/${atendimentoId}`);
  revalidatePath(`/clientes/${clienteId}`);
  revalidatePath("/caixa");
  revalidatePath("/caixa/pendentes");

  // Sem redirect: ela fica onde está, e a tela volta já em modo fechado.
  return {};
}

/**
 * Reabre a conta: apaga os lançamentos dela, e só eles.
 *
 * Conta fechada é "existe lançamento com este atendimento_id"; sem eles,
 * a tela volta ao modo aberto e o `fecharConta` acima funciona sem
 * mudança — os itens ficam gravados e reaparecem na conta.
 *
 * UM delete, filtrado pelo `atendimento_id` EXATO. Nunca por "is not
 * null" nem por outra coluna: filtro a mais poderia deixar metade da
 * conta para trás, e filtro a menos apagaria a conta de todo mundo.
 * O `select('id')` conta o que saiu; zero é conta que já estava aberta
 * (outra aba, outro aparelho).
 *
 * A mensagem volta como valor: em produção o Next troca a de um erro
 * lançado no servidor por um texto genérico em inglês.
 */
export async function reabrirConta(
  clienteId: string,
  atendimentoId: string,
): Promise<{ erro?: string }> {
  const { supabase } = await exigirSessao();

  const { data, error } = await supabase
    .from("lancamentos")
    .delete()
    .eq("atendimento_id", atendimentoId)
    .select("id");

  if (error) {
    return { erro: `Não foi possível reabrir a conta: ${error.message}` };
  }

  const apagados = (data ?? []) as { id: string }[];

  if (apagados.length === 0) {
    return { erro: MENSAGEM_CONTA_JA_ABERTA };
  }

  // A conta, a ficha da cliente (fechada e total), o Caixa, A receber e a
  // edição de cada lançamento que deixou de existir.
  revalidatePath(`/clientes/${clienteId}/atendimentos/${atendimentoId}`);
  revalidatePath(`/clientes/${clienteId}`);
  revalidatePath("/caixa");
  revalidatePath("/caixa/pendentes");

  for (const { id } of apagados) {
    revalidatePath(`/caixa/${id}/editar`);
  }

  return {};
}
