import { z } from "zod";

/**
 * Atendimento é só o registro do que foi feito: cliente, data e os
 * serviços. Nada de valor, forma de pagamento ou parcela — isso é
 * `lancamentos`, e a regra de competência ainda não foi decidida.
 */
export const atendimentoSchema = z.object({
  data: z
    .string()
    .trim()
    .refine((v) => z.iso.date().safeParse(v).success, {
      message: "Informe a data",
    }),

  observacao: z
    .string()
    .trim()
    .max(1000, "Máximo de 1000 caracteres")
    .transform((v) => (v === "" ? null : v)),
});

export type DadosAtendimento = z.infer<typeof atendimentoSchema>;

/**
 * Serviço escolhido no formulário.
 *
 * `id` vazio significa serviço que ela acabou de digitar: o catálogo
 * ainda não o tem e a action o cadastra antes de gravar o item. O item
 * de atendimento exige `servico_id` (chk_item_referencia da 001), então
 * não há caminho de texto solto.
 */
export const servicoEscolhidoSchema = z.object({
  id: z
    .string()
    .trim()
    .transform((v) => (v === "" ? null : v))
    .nullable()
    .refine((v) => v === null || z.uuid().safeParse(v).success, {
      message: "Serviço inválido",
    }),

  nome: z
    .string()
    .trim()
    .min(2, "Nome do serviço muito curto")
    .max(120, "Máximo de 120 caracteres"),
});

export const servicosSchema = z
  .array(servicoEscolhidoSchema)
  .min(1, "Escolha pelo menos um serviço");

export type ServicoEscolhido = z.infer<typeof servicoEscolhidoSchema>;

export const CAMPOS_ATENDIMENTO = ["data", "observacao"] as const;

export type CampoAtendimento = (typeof CAMPOS_ATENDIMENTO)[number];

export type CampoErroAtendimento = CampoAtendimento | "servicos";

/** FormData → objeto plano, só com os campos previstos. */
export function lerFormulario(formData: FormData) {
  return Object.fromEntries(
    CAMPOS_ATENDIMENTO.map((campo) => [
      campo,
      String(formData.get(campo) ?? ""),
    ]),
  ) as Record<CampoAtendimento, string>;
}

/** Duas listas paralelas: id (pode ser vazio) e nome. */
export function lerServicos(formData: FormData) {
  const ids = formData.getAll("servico_id").map(String);

  return formData
    .getAll("servico_nome")
    .map((nome, indice) => ({ id: ids[indice] ?? "", nome: String(nome) }))
    .filter((servico) => servico.nome.trim() !== "");
}

/** Achata os erros do Zod em `campo → primeira mensagem`. */
export function errosPorCampo(erro: z.ZodError) {
  const erros: Partial<Record<CampoErroAtendimento, string>> = {};

  for (const problema of erro.issues) {
    const campo = problema.path[0] as CampoErroAtendimento | undefined;

    if (campo && !erros[campo]) {
      erros[campo] = problema.message;
    }
  }

  return erros;
}
