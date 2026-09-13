"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import { exigirSessao } from "@/lib/auth";
import {
  listarClientes,
  type FiltroClientes,
  type PaginaClientes,
} from "@/lib/clientes/consultas";
import {
  clienteSchema,
  errosPorCampo,
  lerFormulario,
  type CampoCliente,
} from "@/lib/clientes/schema";

export type EstadoFormulario = {
  erros?: Partial<Record<CampoCliente, string>>;
  mensagem?: string;
  /** O que a usuária já tinha digitado, para o formulário não se apagar. */
  valores?: Partial<Record<CampoCliente, string>>;
};

/** Data de hoje no fuso do salão, no formato que a coluna `date` espera. */
function hoje() {
  return new Date().toLocaleDateString("en-CA", {
    timeZone: "America/Sao_Paulo",
  });
}

export async function criarCliente(
  _estado: EstadoFormulario,
  formData: FormData,
): Promise<EstadoFormulario> {
  const { supabase } = await exigirSessao();

  const bruto = lerFormulario(formData);
  const validacao = clienteSchema.safeParse(bruto);

  if (!validacao.success) {
    return { erros: errosPorCampo(validacao.error), valores: bruto };
  }

  const { data, error } = await supabase
    .from("clientes")
    // `data_cadastro` é fato, não campo de formulário: a cliente entrou
    // na base hoje. `id_externo` fica null — só o import da planilha usa.
    .insert({ ...validacao.data, data_cadastro: hoje() })
    .select("id")
    .single();

  if (error) {
    return {
      mensagem: `Não foi possível cadastrar: ${error.message}`,
      valores: bruto,
    };
  }

  revalidatePath("/clientes");
  redirect(`/clientes/${data.id}`);
}

export async function atualizarCliente(
  id: string,
  _estado: EstadoFormulario,
  formData: FormData,
): Promise<EstadoFormulario> {
  const { supabase } = await exigirSessao();

  const bruto = lerFormulario(formData);
  const validacao = clienteSchema.safeParse(bruto);

  if (!validacao.success) {
    return { erros: errosPorCampo(validacao.error), valores: bruto };
  }

  const { error } = await supabase
    .from("clientes")
    .update(validacao.data)
    .eq("id", id);

  if (error) {
    return {
      mensagem: `Não foi possível salvar: ${error.message}`,
      valores: bruto,
    };
  }

  revalidatePath("/clientes");
  revalidatePath(`/clientes/${id}`);
  redirect(`/clientes/${id}`);
}

/**
 * Cliente não é excluída: sai da lista ficando inativa, e pode voltar.
 * Histórico e lançamentos continuam intactos.
 */
export async function alternarAtivo(id: string, ativo: boolean) {
  const { supabase } = await exigirSessao();

  const { error } = await supabase
    .from("clientes")
    .update({ ativo })
    .eq("id", id);

  if (error) {
    throw new Error(`Não foi possível atualizar a cliente: ${error.message}`);
  }

  revalidatePath("/clientes");
  revalidatePath(`/clientes/${id}`);
}

/** Próxima página da lista, para o botão "Carregar mais". */
export async function carregarMaisClientes(
  filtro: FiltroClientes,
): Promise<PaginaClientes> {
  return listarClientes(filtro);
}
