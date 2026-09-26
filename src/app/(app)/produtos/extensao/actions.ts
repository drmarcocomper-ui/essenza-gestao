"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import { exigirSessao } from "@/lib/auth";
import {
  listarCodigos,
  obterPeca,
  pecaTemFilhas,
} from "@/lib/pecas-extensao/consultas";
import {
  codigoDoDuplicado,
  conferirCustos,
  encontrarCodigoDuplicado,
  indicesCodigoRepetido,
  MAXIMO_PARTES,
  mensagemCodigoDuplicado,
  mensagemSomaNaoFecha,
  mesmoPreco,
  MENSAGEM_CODIGO_REPETIDO_PARTES,
  MENSAGEM_CODIGO_TRAVADO,
  MENSAGEM_CUSTO_PARTE_OBRIGATORIO,
  MENSAGEM_DESMEMBRAR_SEM_CUSTO,
  MENSAGEM_EXCLUSAO_TRAVADA,
  MENSAGEM_PECA_NAO_ENCONTRADA,
  MENSAGEM_QUANTIDADE_PARTES,
  MINIMO_PARTES,
  travasDaPeca,
} from "@/lib/pecas-extensao/regras";
import {
  errosPorCampo,
  lerCampos,
  lerFormulario,
  novaParte,
  novaPeca,
  pecaSchema,
  type CampoPeca,
  type DadosPeca,
} from "@/lib/pecas-extensao/schema";

export type EstadoFormularioPeca = {
  erros?: Partial<Record<CampoPeca, string>>;
  mensagem?: string;
  /** O que a usuária já tinha digitado, para o formulário não se apagar. */
  valores?: Partial<Record<CampoPeca, string>>;
};

/** 23505 é unique_violation: aqui, só pode ser o índice do código (018). */
function ehDuplicado(erro: { code?: string } | null) {
  return erro?.code === "23505";
}

/** 23503 é foreign_key_violation: a peça ganhou parte entre a tela e o toque. */
function temParte(erro: { code?: string } | null) {
  return erro?.code === "23503";
}

export async function criarPeca(
  _estado: EstadoFormularioPeca,
  formData: FormData,
): Promise<EstadoFormularioPeca> {
  const { supabase } = await exigirSessao();

  const bruto = lerFormulario(formData);
  const validacao = pecaSchema.safeParse(bruto);

  if (!validacao.success) {
    return { erros: errosPorCampo(validacao.error), valores: bruto };
  }

  const { codigo } = validacao.data;
  const existente = encontrarCodigoDuplicado(await listarCodigos(), codigo);

  if (existente) {
    return {
      erros: { codigo: mensagemCodigoDuplicado(existente.codigo) },
      valores: bruto,
    };
  }

  const { error } = await supabase
    .from("pecas_extensao")
    .insert(novaPeca(validacao.data));

  if (error) {
    return ehDuplicado(error)
      ? { erros: { codigo: mensagemCodigoDuplicado(codigo) }, valores: bruto }
      : { mensagem: `Não foi possível cadastrar: ${error.message}`, valores: bruto };
  }

  revalidatePath("/produtos");
  redirect("/produtos");
}

/**
 * Os campos do formulário, e só eles: `peca_mae_id` nunca entra num
 * update (ver 018). O código só muda em peça sem partes, e o preço de
 * compra só em peça que não é mãe nem parte de desmembramento —
 * reavaliado aqui, não só travado na tela.
 */
export async function atualizarPeca(
  id: string,
  _estado: EstadoFormularioPeca,
  formData: FormData,
): Promise<EstadoFormularioPeca> {
  const { supabase } = await exigirSessao();

  const bruto = lerFormulario(formData);
  const validacao = pecaSchema.safeParse(bruto);

  if (!validacao.success) {
    return { erros: errosPorCampo(validacao.error), valores: bruto };
  }

  const peca = await obterPeca(id);

  if (!peca) {
    return { mensagem: MENSAGEM_PECA_NAO_ENCONTRADA, valores: bruto };
  }

  const { codigo, preco_compra, ...resto } = validacao.data;
  const travas = travasDaPeca({ ...peca, temFilhas: await pecaTemFilhas(id) });
  const custoMudou = !mesmoPreco(preco_compra, peca.precoCompra);

  if (travas.codigoTravado && codigo !== peca.codigo) {
    return { erros: { codigo: MENSAGEM_CODIGO_TRAVADO }, valores: bruto };
  }

  if (travas.motivoCustoTravado && custoMudou) {
    return {
      erros: { preco_compra: travas.motivoCustoTravado },
      valores: bruto,
    };
  }

  const existente = encontrarCodigoDuplicado(await listarCodigos(), codigo, id);

  if (existente) {
    return {
      erros: { codigo: mensagemCodigoDuplicado(existente.codigo) },
      valores: bruto,
    };
  }

  // Código e custo iguais ao gravado não vão no update: nada a mudar, e
  // assim uma peça desmembrada no meio do caminho não tem nenhum dos dois
  // tocado.
  const alteracao = {
    ...resto,
    ...(codigo !== peca.codigo ? { codigo } : {}),
    ...(custoMudou ? { preco_compra } : {}),
  };

  const { error } = await supabase
    .from("pecas_extensao")
    .update(alteracao)
    .eq("id", id);

  if (error) {
    return ehDuplicado(error)
      ? { erros: { codigo: mensagemCodigoDuplicado(codigo) }, valores: bruto }
      : { mensagem: `Não foi possível salvar: ${error.message}`, valores: bruto };
  }

  revalidatePath("/produtos");
  revalidatePath(`/produtos/extensao/${id}`);
  redirect("/produtos");
}

/**
 * Exclusão física: peça não tem `ativo` (018). Só de peça sem partes e
 * que não é parte — conferido aqui, e o `on delete restrict` da 018 é a
 * rede de baixo para a primeira regra. Parte sai só pelo Desfazer da mãe.
 *
 * Devolve o recado em vez de redirecionar: a volta para a lista é do
 * cliente, como no Caixa.
 */
export async function excluirPeca(id: string): Promise<{ erro?: string }> {
  const { supabase } = await exigirSessao();

  const peca = await obterPeca(id);

  if (!peca) {
    return { erro: MENSAGEM_PECA_NAO_ENCONTRADA };
  }

  const { motivoExclusaoTravada } = travasDaPeca({
    ...peca,
    temFilhas: await pecaTemFilhas(id),
  });

  if (motivoExclusaoTravada) {
    return { erro: motivoExclusaoTravada };
  }

  const { error } = await supabase.from("pecas_extensao").delete().eq("id", id);

  if (error) {
    return {
      erro: temParte(error)
        ? MENSAGEM_EXCLUSAO_TRAVADA
        : `Não foi possível excluir: ${error.message}`,
    };
  }

  revalidatePath("/produtos");

  return {};
}

export type EstadoDesmembrar = {
  mensagem?: string;
  /** Erros de cada parte, na ordem da tela. */
  erros?: Partial<Record<CampoPeca, string>>[];
};

/**
 * Corta a peça em partes: cada parte é uma linha nova com `peca_mae_id`
 * apontando para a mãe. Revalida tudo o que a tela já conferiu — a tela
 * é conveniência, a regra mora aqui:
 *
 *   - a mãe existe, não tem partes e tem preço de compra;
 *   - de 2 a 10 partes, cada uma válida pelo schema do cadastro e com
 *     preço de compra;
 *   - códigos distintos entre as partes e livres no banco;
 *   - a soma dos custos, em centavos inteiros, é o custo da mãe.
 *
 * Todas as partes vão num insert só, de várias linhas: é um comando só
 * no Postgres, então ou todas entram ou nenhuma.
 *
 * Recebe objeto, não FormData (a tela monta as partes em estado), e não
 * confia na forma dele. Devolve `{}` no sucesso; a volta para a lista é
 * do cliente, como na exclusão.
 */
export async function desmembrarPeca(
  maeId: string,
  partesRecebidas: unknown,
): Promise<EstadoDesmembrar> {
  const { supabase } = await exigirSessao();

  if (
    !Array.isArray(partesRecebidas) ||
    partesRecebidas.length < MINIMO_PARTES ||
    partesRecebidas.length > MAXIMO_PARTES
  ) {
    return { mensagem: MENSAGEM_QUANTIDADE_PARTES };
  }

  const mae = await obterPeca(maeId);

  if (!mae) {
    return { mensagem: MENSAGEM_PECA_NAO_ENCONTRADA };
  }

  const { motivoNaoDesmembra } = travasDaPeca({
    ...mae,
    temFilhas: await pecaTemFilhas(mae.id),
  });
  const custoMae = mae.precoCompra;

  if (motivoNaoDesmembra || custoMae === null) {
    return { mensagem: motivoNaoDesmembra ?? MENSAGEM_DESMEMBRAR_SEM_CUSTO };
  }

  const brutas = partesRecebidas.map(lerCampos);
  const erros = brutas.map((): Partial<Record<CampoPeca, string>> => ({}));
  const partes: DadosPeca[] = [];

  brutas.forEach((bruta, indice) => {
    const validacao = pecaSchema.safeParse(bruta);

    if (!validacao.success) {
      erros[indice] = errosPorCampo(validacao.error);
      return;
    }

    if (validacao.data.preco_compra === null) {
      erros[indice].preco_compra = MENSAGEM_CUSTO_PARTE_OBRIGATORIO;
    }

    partes[indice] = validacao.data;
  });

  for (const indice of indicesCodigoRepetido(brutas.map((b) => b.codigo))) {
    erros[indice].codigo ??= MENSAGEM_CODIGO_REPETIDO_PARTES;
  }

  const temErro = () => erros.some((erro) => Object.keys(erro).length > 0);

  if (temErro()) {
    return { erros };
  }

  const conferencia = conferirCustos(
    partes.map((parte) => parte.preco_compra),
    custoMae,
  );

  if (conferencia.situacao !== "fecha") {
    return { mensagem: mensagemSomaNaoFecha(conferencia) };
  }

  const codigosGravados = await listarCodigos();

  partes.forEach((parte, indice) => {
    const existente = encontrarCodigoDuplicado(codigosGravados, parte.codigo);

    if (existente) {
      erros[indice].codigo = mensagemCodigoDuplicado(existente.codigo);
    }
  });

  if (temErro()) {
    return { erros };
  }

  const { error } = await supabase
    .from("pecas_extensao")
    .insert(partes.map((parte) => novaParte(parte, mae.id)));

  if (error) {
    if (ehDuplicado(error)) {
      const codigo = codigoDoDuplicado(
        error.details,
        partes.map((parte) => parte.codigo),
      );

      return {
        mensagem: codigo
          ? mensagemCodigoDuplicado(codigo)
          : "Já existe peça com um desses códigos.",
      };
    }

    // 23503 aqui é a mãe que sumiu entre a tela e o toque.
    return {
      mensagem: temParte(error)
        ? MENSAGEM_PECA_NAO_ENCONTRADA
        : `Não foi possível desmembrar: ${error.message}`,
    };
  }

  revalidatePath("/produtos");
  revalidatePath(`/produtos/extensao/${mae.id}`);

  return {};
}
