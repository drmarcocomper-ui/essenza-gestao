"use server";

import { revalidatePath } from "next/cache";

import {
  categoriaDaConta,
  contaSchema,
  descricaoDaConta,
  errosDaConta,
  FORMA_POR_INSTITUICAO,
  lerConta,
  type CampoConta,
  type Instituicao,
} from "@/lib/atendimentos/conta";
import {
  listarProdutosRevenda,
  listarServicos,
  obterAtendimento,
} from "@/lib/atendimentos/consultas";
import {
  classificarFalhaConta,
  registrarFalhaConta,
} from "@/lib/atendimentos/erros";
import { exigirSessao } from "@/lib/auth";

export type EstadoConta = {
  erros?: Partial<Record<CampoConta, string>>;
  mensagem?: string;
};

/** Linha pronta para `atendimento_itens`, já com o nome vindo do banco. */
type ItemResolvido = {
  tipo: "servico" | "produto";
  servico_id: string | null;
  produto_id: string | null;
  descricao: string;
  quantidade: number;
  valor_unitario: number;
  /** Só para escolher a categoria do lançamento; não vai para o banco. */
  categoria: string | null;
};

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

  const [servicos, produtos] = await Promise.all([
    listarServicos({ incluirInativos: true }),
    listarProdutosRevenda(),
  ]);

  const itens: ItemResolvido[] = [];

  for (const item of conta.itens) {
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
        // Snapshot do nome vindo do banco, não do navegador: o item
        // sobrevive à renomeação do catálogo, e o POST não escolhe texto.
        descricao: servico.nome,
        quantidade: item.quantidade,
        valor_unitario: item.valorUnitario,
        categoria: servico.categoria,
      });

      continue;
    }

    const produto = produtos.find((linha) => linha.id === item.refId);

    if (!produto) {
      return { erros: { itens: "Um dos produtos não está mais no catálogo." } };
    }

    itens.push({
      tipo: "produto",
      servico_id: null,
      produto_id: produto.id,
      descricao: produto.nome,
      quantidade: item.quantidade,
      valor_unitario: item.valorUnitario,
      categoria: null,
    });
  }

  const classificaveis = itens.map((item) => ({
    tipo: item.tipo,
    categoria: item.categoria,
    quantidade: item.quantidade,
    valorUnitario: item.valor_unitario,
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
      descricao: item.descricao,
      quantidade: item.quantidade,
      valor_unitario: item.valor_unitario,
    })),
  );

  if (erroItens) {
    registrarFalhaConta("itens", erroItens);

    return { mensagem: classificarFalhaConta("itens", erroItens).texto };
  }

  // (c) — o dinheiro por último. Um lançamento por forma de pagamento,
  // cada um com sua instituição e titularidade.
  const { error: erroLancamentos } = await supabase.from("lancamentos").insert(
    conta.formas.map((forma) => ({
      // Competência é a data do atendimento; caixa é a data do pagamento.
      data_competencia: atendimento.data,
      data_caixa: conta.data_caixa,
      // Status 'Pago' exige data de caixa (chk_lancamento_caixa), que
      // sempre existe aqui — a tela pergunta e o schema obriga.
      status: "Pago",
      tipo: "Entrada",
      categoria: categoriaDaConta(classificaveis),
      descricao: descricaoDaConta(itens),
      cliente_id: clienteId,
      atendimento_id: atendimentoId,
      forma_pagamento:
        FORMA_POR_INSTITUICAO[forma.instituicao as Instituicao] ?? null,
      instituicao: forma.instituicao,
      titularidade: forma.titularidade,
      valor: forma.valor,
      // A mesma coluna que a planilha preenchia, para os relatórios por
      // mês continuarem batendo com o histórico importado.
      mes_competencia: atendimento.data.slice(0, 7),
      // `origem_registro` fica no default 'app'. `parcelamento` fica
      // null: a decisão de parcelamento ainda não foi tomada, e campo
      // preenchido por adivinhação é pior que campo vazio.
    })),
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
