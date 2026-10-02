"use server";

import { revalidatePath } from "next/cache";

import { exigirSessao } from "@/lib/auth";
import { obterCompra } from "@/lib/estoque/consultas";
import {
  BUCKET_NOTAS,
  caminhoNota,
  ehExtensaoNota,
} from "@/lib/estoque/nota";
import { MENSAGEM_PRODUTO_REPETIDO } from "@/lib/estoque/regras";
import {
  lerCompra,
  validarCompra,
  type CampoCompra,
  type CampoItemCompra,
  type DadosCompra,
} from "@/lib/estoque/schema";

type Supabase = Awaited<ReturnType<typeof exigirSessao>>["supabase"];

export type EstadoCompra = {
  mensagem?: string;
  erros?: Partial<Record<CampoCompra, string>>;
  /** Erros de cada linha, na ordem da tela. */
  errosItens?: Partial<Record<CampoItemCompra, string>>[];
  /** Gravou: a tela sobe a nota (se houver) e vai para a compra. */
  id?: string;
};

const MENSAGEM_COMPRA_NAO_ENCONTRADA = "Esta compra não existe mais.";

/** 23505 é unique_violation: aqui, só pode ser uq_compra_itens_compra_produto. */
function ehProdutoRepetido(erro: { code?: string } | null) {
  return erro?.code === "23505";
}

/**
 * Compra mexe no saldo de vários produtos de uma vez: a aba inteira
 * (lista, estoque, páginas de produto e de compra) é revalidada.
 */
function revalidarProdutos() {
  revalidatePath("/produtos", "layout");
}

/**
 * Só revenda ativa entra numa compra (021: a regra mora na aplicação).
 * `jaNaCompra` é a exceção da edição: uma linha cujo produto foi
 * desativado depois pode continuar como está.
 */
async function conferirProdutos(
  supabase: Supabase,
  dados: DadosCompra,
  jaNaCompra: ReadonlySet<string> = new Set(),
): Promise<Partial<Record<CampoItemCompra, string>>[] | null> {
  const ids = [...new Set(dados.itens.map((item) => item.produto_id))];

  const { data, error } = await supabase
    .from("produtos")
    .select("id, ativo")
    .in("id", ids)
    .eq("tipo", "revenda");

  // id que não é uuid (22P02) é um produto que não existe.
  if (error && error.code !== "22P02") {
    throw new Error(`Não foi possível conferir os produtos: ${error.message}`);
  }

  const ativoPorId = new Map(
    ((data ?? []) as { id: string; ativo: boolean }[]).map((p) => [p.id, p.ativo]),
  );

  const erros = dados.itens.map(
    (item): Partial<Record<CampoItemCompra, string>> => {
      const ativo = ativoPorId.get(item.produto_id);

      if (ativo === undefined) return { produto_id: "Produto não encontrado" };
      if (!ativo && !jaNaCompra.has(item.produto_id)) {
        return { produto_id: "Produto inativo" };
      }

      return {};
    },
  );

  return erros.some((erro) => Object.keys(erro).length > 0) ? erros : null;
}

function linhaDoItem(compraId: string, item: DadosCompra["itens"][number]) {
  return {
    compra_id: compraId,
    produto_id: item.produto_id,
    quantidade: item.quantidade,
    custo_unitario: item.custo_unitario,
  };
}

/**
 * Grava a compra e as linhas. Não gera lançamento: o boleto já vai ao
 * Caixa (021). Devolve o id; a nota, se houver, sobe depois, do
 * navegador, para o caminho {compra_id}/nota.<ext>.
 */
export async function criarCompra(recebida: unknown): Promise<EstadoCompra> {
  const { supabase } = await exigirSessao();

  const validacao = validarCompra(lerCompra(recebida));

  if (!validacao.ok) {
    const { mensagem, erros, errosItens } = validacao;
    return { mensagem, erros, errosItens };
  }

  const { itens, ...cabecalho } = validacao.dados;
  const errosProdutos = await conferirProdutos(supabase, validacao.dados);

  if (errosProdutos) return { errosItens: errosProdutos };

  const { data, error } = await supabase
    .from("compras")
    .insert(cabecalho)
    .select("id")
    .single();

  if (error) {
    return { mensagem: `Não foi possível salvar a compra: ${error.message}` };
  }

  const { error: erroItens } = await supabase
    .from("compra_itens")
    .insert(itens.map((item) => linhaDoItem(data.id, item)));

  if (erroItens) {
    // Sem transação no PostgREST: compra sem linhas seria pior que
    // nenhuma — sai inteira (cascade nas linhas que tenham entrado).
    await supabase.from("compras").delete().eq("id", data.id);

    return {
      mensagem: ehProdutoRepetido(erroItens)
        ? MENSAGEM_PRODUTO_REPETIDO
        : `Não foi possível salvar os produtos da compra: ${erroItens.message}`,
    };
  }

  revalidarProdutos();

  return { id: data.id };
}

/**
 * Cabeçalho e linhas. As linhas são comparadas por produto (é a chave
 * de uq_compra_itens_compra_produto): sai o que sumiu, muda o que mudou,
 * entra o que é novo — nessa ordem, para o índice único nunca ver o
 * mesmo produto duas vezes no meio do caminho.
 *
 * Sem transação no PostgREST: uma falha no meio deixa parte gravada, e o
 * recado diz isso.
 */
export async function atualizarCompra(
  id: string,
  recebida: unknown,
): Promise<EstadoCompra> {
  const { supabase } = await exigirSessao();

  const validacao = validarCompra(lerCompra(recebida));

  if (!validacao.ok) {
    const { mensagem, erros, errosItens } = validacao;
    return { mensagem, erros, errosItens };
  }

  const atual = await obterCompra(id);

  if (!atual) return { mensagem: MENSAGEM_COMPRA_NAO_ENCONTRADA };

  const atuaisPorProduto = new Map(
    atual.itens.map((item) => [item.produtoId, item]),
  );
  const errosProdutos = await conferirProdutos(
    supabase,
    validacao.dados,
    new Set(atuaisPorProduto.keys()),
  );

  if (errosProdutos) return { errosItens: errosProdutos };

  const { itens, ...cabecalho } = validacao.dados;

  const { data: alterada, error } = await supabase
    .from("compras")
    .update(cabecalho)
    .eq("id", id)
    .select("id");

  if (error) {
    return { mensagem: `Não foi possível salvar a compra: ${error.message}` };
  }

  if ((alterada ?? []).length === 0) {
    return { mensagem: MENSAGEM_COMPRA_NAO_ENCONTRADA };
  }

  const novosProdutos = new Set(itens.map((item) => item.produto_id));
  const removidas = atual.itens
    .filter((item) => !novosProdutos.has(item.produtoId))
    .map((item) => item.id);

  const parcial = (detalhe: string) => ({
    mensagem: `A compra foi salva só em parte (${detalhe}). Confira os produtos e salve de novo.`,
  });

  if (removidas.length > 0) {
    const { data: apagadas, error: erroApagar } = await supabase
      .from("compra_itens")
      .delete()
      .in("id", removidas)
      .eq("compra_id", id)
      .select("id");

    if (erroApagar || (apagadas ?? []).length !== removidas.length) {
      revalidarProdutos();
      return parcial(erroApagar?.message ?? "uma linha removida não saiu");
    }
  }

  const novas: DadosCompra["itens"] = [];

  for (const item of itens) {
    const existente = atuaisPorProduto.get(item.produto_id);

    if (!existente) {
      novas.push(item);
      continue;
    }

    if (
      existente.quantidade === item.quantidade &&
      existente.custoUnitario === item.custo_unitario
    ) {
      continue;
    }

    const { data: alterado, error: erroAlterar } = await supabase
      .from("compra_itens")
      .update({ quantidade: item.quantidade, custo_unitario: item.custo_unitario })
      .eq("id", existente.id)
      .eq("compra_id", id)
      .select("id");

    if (erroAlterar || (alterado ?? []).length === 0) {
      revalidarProdutos();
      return parcial(erroAlterar?.message ?? "uma linha alterada não foi encontrada");
    }
  }

  if (novas.length > 0) {
    const { error: erroInserir } = await supabase
      .from("compra_itens")
      .insert(novas.map((item) => linhaDoItem(id, item)));

    if (erroInserir) {
      revalidarProdutos();
      return ehProdutoRepetido(erroInserir)
        ? { mensagem: MENSAGEM_PRODUTO_REPETIDO }
        : parcial(erroInserir.message);
    }
  }

  revalidarProdutos();

  return { id };
}

/**
 * Apaga do bucket e confere que saiu. O Storage devolve lista vazia, sem
 * erro, tanto para "não existia" quanto para "a policy não deixou": a
 * listagem da pasta desempata.
 */
async function apagarArquivo(
  supabase: Supabase,
  caminho: string,
): Promise<string | null> {
  const { data, error } = await supabase.storage
    .from(BUCKET_NOTAS)
    .remove([caminho]);

  if (error) return error.message;
  if ((data ?? []).length > 0) return null;

  const [pasta, nome] = caminho.split("/");
  const { data: restantes, error: erroLista } = await supabase.storage
    .from(BUCKET_NOTAS)
    .list(pasta, { search: nome });

  if (erroLista) return erroLista.message;

  return (restantes ?? []).some((objeto) => objeto.name === nome)
    ? "o arquivo continua no armazenamento"
    : null;
}

/**
 * Liga à compra a nota que o navegador acabou de subir. O caminho é
 * recalculado aqui. Se a extensão mudou (foto → PDF), o arquivo antigo
 * sai do bucket depois que o novo já está ligado — nunca antes, para uma
 * falha não deixar a compra sem nota nenhuma.
 */
export async function registrarNota(
  compraId: string,
  extensao: string,
): Promise<{ erro?: string }> {
  if (!ehExtensaoNota(extensao)) return { erro: "Formato de nota inválido." };

  const { supabase } = await exigirSessao();

  const compra = await obterCompra(compraId);

  if (!compra) return { erro: MENSAGEM_COMPRA_NAO_ENCONTRADA };

  const caminho = caminhoNota(compra.id, extensao);

  const { data, error } = await supabase
    .from("compras")
    .update({ nota_path: caminho })
    .eq("id", compra.id)
    .select("id");

  if (error) return { erro: `Não foi possível ligar a nota: ${error.message}` };
  if ((data ?? []).length === 0) return { erro: MENSAGEM_COMPRA_NAO_ENCONTRADA };

  revalidarProdutos();

  if (compra.notaPath && compra.notaPath !== caminho) {
    const falha = await apagarArquivo(supabase, compra.notaPath);

    if (falha) {
      return {
        erro: `A nota nova foi salva, mas a antiga não foi apagada: ${falha}.`,
      };
    }
  }

  return {};
}

/** Tira a nota do bucket e da compra, nessa ordem. */
export async function removerNota(compraId: string): Promise<{ erro?: string }> {
  const { supabase } = await exigirSessao();

  const compra = await obterCompra(compraId);

  if (!compra) return { erro: MENSAGEM_COMPRA_NAO_ENCONTRADA };
  if (!compra.notaPath) return {};

  const falha = await apagarArquivo(supabase, compra.notaPath);

  if (falha) return { erro: `Não foi possível apagar a nota: ${falha}.` };

  const { data, error } = await supabase
    .from("compras")
    .update({ nota_path: null })
    .eq("id", compra.id)
    .select("id");

  if (error) return { erro: `Não foi possível apagar a nota: ${error.message}` };
  if ((data ?? []).length === 0) return { erro: MENSAGEM_COMPRA_NAO_ENCONTRADA };

  revalidarProdutos();

  return {};
}

/**
 * Primeiro o arquivo, pela API do Storage (apagar a linha de
 * storage.objects não apaga os bytes); depois a compra, e as linhas vão
 * junto pelo cascade. Se a nota não sair, a compra fica: melhor do que
 * deixar um arquivo sem dono no bucket.
 */
export async function excluirCompra(id: string): Promise<{ erro?: string }> {
  const { supabase } = await exigirSessao();

  const compra = await obterCompra(id);

  if (!compra) return { erro: MENSAGEM_COMPRA_NAO_ENCONTRADA };

  if (compra.notaPath) {
    const falha = await apagarArquivo(supabase, compra.notaPath);

    if (falha) {
      return { erro: `Não foi possível apagar a nota, e a compra ficou: ${falha}.` };
    }
  }

  const { data, error } = await supabase
    .from("compras")
    .delete()
    .eq("id", compra.id)
    .select("id");

  if (error) return { erro: `Não foi possível excluir: ${error.message}` };
  if ((data ?? []).length === 0) return { erro: MENSAGEM_COMPRA_NAO_ENCONTRADA };

  revalidarProdutos();

  return {};
}
