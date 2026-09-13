"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import { exigirSessao } from "@/lib/auth";
import {
  atendimentoSchema,
  errosPorCampo,
  lerFormulario,
  lerServicos,
  servicosSchema,
  type CampoAtendimento,
  type CampoErroAtendimento,
  type ServicoEscolhido,
} from "@/lib/atendimentos/schema";

export type EstadoAtendimento = {
  erros?: Partial<Record<CampoErroAtendimento, string>>;
  mensagem?: string;
  valores?: Partial<Record<CampoAtendimento, string>>;
};

type ClienteSupabase = Awaited<ReturnType<typeof exigirSessao>>["supabase"];

/**
 * Converte os serviços escolhidos em ids do catálogo.
 *
 * `atendimento_itens` exige `servico_id` (chk_item_referencia da 001),
 * então serviço digitado na hora entra no catálogo antes de virar item.
 * Preço fica em zero: o catálogo aqui serve para nomear o que foi feito,
 * e tabela de preço não faz parte desta fase.
 */
async function resolverServicos(
  supabase: ClienteSupabase,
  escolhidos: ServicoEscolhido[],
) {
  const resolvidos: { id: string; nome: string }[] = [];

  for (const servico of escolhidos) {
    if (servico.id) {
      resolvidos.push({ id: servico.id, nome: servico.nome });
      continue;
    }

    // Digitou o nome de um serviço que já existe (com outra caixa, ou
    // porque o chip estava fora da tela): reusa em vez de duplicar.
    const { data: existente, error: erroBusca } = await supabase
      .from("servicos")
      .select("id, nome")
      .ilike("nome", servico.nome)
      .limit(1)
      .maybeSingle();

    if (erroBusca) {
      throw new Error(erroBusca.message);
    }

    if (existente) {
      resolvidos.push(existente as { id: string; nome: string });
      continue;
    }

    const { data: criado, error: erroCriacao } = await supabase
      .from("servicos")
      .insert({ nome: servico.nome })
      .select("id, nome")
      .single();

    if (erroCriacao) {
      throw new Error(erroCriacao.message);
    }

    resolvidos.push(criado as { id: string; nome: string });
  }

  return resolvidos;
}

/**
 * Registra o atendimento: quem, quando e o que foi feito.
 *
 * Não cria lançamento, não mexe em valor e não toca no Caixa — a regra
 * de parcelamento e competência ainda não foi decidida, e inventar uma
 * aqui sujaria o financeiro que já está em uso.
 */
export async function criarAtendimento(
  clienteId: string,
  _estado: EstadoAtendimento,
  formData: FormData,
): Promise<EstadoAtendimento> {
  const { supabase } = await exigirSessao();

  const bruto = lerFormulario(formData);
  const servicosBrutos = lerServicos(formData);
  const comFormula = String(formData.get("com_formula") ?? "") === "1";

  const validacao = atendimentoSchema.safeParse(bruto);
  const validacaoServicos = servicosSchema.safeParse(servicosBrutos);

  if (!validacao.success || !validacaoServicos.success) {
    return {
      erros: {
        ...(validacao.success ? {} : errosPorCampo(validacao.error)),
        ...(validacaoServicos.success
          ? {}
          : {
              servicos:
                validacaoServicos.error.issues[0]?.message ??
                "Escolha pelo menos um serviço",
            }),
      },
      valores: bruto,
    };
  }

  let servicos: { id: string; nome: string }[];

  try {
    servicos = await resolverServicos(supabase, validacaoServicos.data);
  } catch (erro) {
    return {
      mensagem: `Não foi possível salvar os serviços: ${
        erro instanceof Error ? erro.message : "erro desconhecido"
      }`,
      valores: bruto,
    };
  }

  const { data, error } = await supabase
    .from("atendimentos")
    // Sem `valor_total` e sem desconto: ficam no default 0. Atendimento
    // não é comanda nesta fase.
    .insert({ ...validacao.data, cliente_id: clienteId })
    .select("id")
    .single();

  if (error) {
    return {
      mensagem: `Não foi possível salvar o atendimento: ${error.message}`,
      valores: bruto,
    };
  }

  const { error: erroItens } = await supabase.from("atendimento_itens").insert(
    servicos.map((servico) => ({
      atendimento_id: data.id,
      tipo: "servico",
      servico_id: servico.id,
      // Snapshot do nome: o item sobrevive à renomeação do catálogo.
      descricao: servico.nome,
    })),
  );

  if (erroItens) {
    // Atendimento sem item nenhum não diz o que foi feito: desfaz.
    await supabase.from("atendimentos").delete().eq("id", data.id);

    return {
      mensagem: `Não foi possível salvar os serviços: ${erroItens.message}`,
      valores: bruto,
    };
  }

  revalidatePath(`/clientes/${clienteId}`);

  // Dois caminhos a partir daqui: coloração segue direto para a ficha de
  // fórmula, já amarrada neste atendimento; o resto volta para a cliente.
  redirect(
    comFormula
      ? `/clientes/${clienteId}/formulas/nova?atendimento=${data.id}`
      : `/clientes/${clienteId}`,
  );
}
