"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import { listarServicos } from "@/lib/atendimentos/consultas";
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
import { acharServicoPorNome } from "@/lib/atendimentos/servicos";
import { exigirSessao } from "@/lib/auth";

export type EstadoAtendimento = {
  erros?: Partial<Record<CampoErroAtendimento, string>>;
  mensagem?: string;
  valores?: Partial<Record<CampoAtendimento, string>>;
};

type ClienteSupabase = Awaited<ReturnType<typeof exigirSessao>>["supabase"];

type ServicoResolvido = { id: string; nome: string };

type Resolucao =
  | { ok: true; servicos: ServicoResolvido[] }
  | { ok: false; mensagem: string };

/**
 * Converte os serviços escolhidos em ids do catálogo.
 *
 * `atendimento_itens` exige `servico_id` (chk_item_referencia da 001),
 * então serviço digitado na hora precisa entrar no catálogo antes de
 * virar item. Três defesas contra o catálogo virar lixo:
 *
 * 1. O nome é comparado NORMALIZADO (sem acento, sem caixa, sem espaço
 *    sobrando) contra o catálogo inteiro, inativos incluídos —
 *    "Coloração", "coloracao" e "Coloração " são a mesma linha.
 * 2. Criar exige a confirmação que a tela pediu. Um POST direto na
 *    action, sem passar pela UI, é recusado em vez de cadastrar.
 * 3. O nome gravado no item vem do catálogo, não do navegador.
 *
 * Preço fica em zero e `origem_registro` em 'atendimento' (migration
 * 008): é assim que ela acha depois o que falta precificar.
 */
async function resolverServicos(
  supabase: ClienteSupabase,
  escolhidos: ServicoEscolhido[],
): Promise<Resolucao> {
  // Uma leitura só do catálogo, com inativos: reusar um serviço inativo
  // é melhor que criar uma segunda linha com o mesmo nome.
  const catalogo = await listarServicos({ incluirInativos: true });

  const resolvidos: ServicoResolvido[] = [];

  for (const servico of escolhidos) {
    const jaResolvido = (id: string) =>
      resolvidos.some((resolvido) => resolvido.id === id);

    if (servico.id) {
      const doCatalogo = catalogo.find((linha) => linha.id === servico.id);

      if (!doCatalogo) {
        return {
          ok: false,
          mensagem: "Um dos serviços escolhidos não está mais no catálogo.",
        };
      }

      // Nome canônico do banco, não o que veio do formulário.
      if (!jaResolvido(doCatalogo.id)) {
        resolvidos.push({ id: doCatalogo.id, nome: doCatalogo.nome });
      }

      continue;
    }

    const existente = acharServicoPorNome(catalogo, servico.nome);

    if (existente) {
      if (!jaResolvido(existente.id)) {
        resolvidos.push({ id: existente.id, nome: existente.nome });
      }

      continue;
    }

    if (!servico.confirmadoNovo) {
      return {
        ok: false,
        mensagem: `Confirme o cadastro de "${servico.nome}" como serviço novo antes de salvar.`,
      };
    }

    const { data: criado, error } = await supabase
      .from("servicos")
      .insert({ nome: servico.nome, origem_registro: "atendimento" })
      .select("id, nome")
      .single();

    if (error) {
      return {
        ok: false,
        mensagem: `Não foi possível cadastrar "${servico.nome}": ${error.message}`,
      };
    }

    const novo = criado as ServicoResolvido;

    // Entra no catálogo em memória: se ela digitou o mesmo nome duas
    // vezes na mesma tela, a segunda casa com a primeira.
    catalogo.push({ ...novo, semPreco: true });
    resolvidos.push(novo);
  }

  return { ok: true, servicos: resolvidos };
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

  const resolucao = await resolverServicos(supabase, validacaoServicos.data);

  if (!resolucao.ok) {
    // Erro de serviço aparece junto dos chips, que é onde ela resolve.
    return {
      erros: { servicos: resolucao.mensagem },
      valores: bruto,
    };
  }

  const servicos = resolucao.servicos;

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
