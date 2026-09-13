import { exigirSessao } from "@/lib/auth";

import type { Momento, TipoFormula, Unidade } from "./schema";
import { BUCKET_FORMULAS, SEGUNDOS_URL_ASSINADA } from "./storage";

export type ItemFormula = {
  id: string;
  descricao: string;
  quantidade: string;
  unidade: Unidade;
  ordem: number;
};

export type FotoFormula = {
  id: string;
  momento: Momento;
  storage_path: string;
  /** URL assinada; null quando o arquivo sumiu do bucket. */
  url: string | null;
};

export type Formula = {
  id: string;
  cliente_id: string;
  atendimento_id: string | null;
  data: string;
  tipo: TipoFormula;
  base_natural: string | null;
  resultado_alvo: string | null;
  volume_oxidante: number | null;
  tempo_pausa_min: number | null;
  tecnica: string | null;
  resultado: string | null;
  observacao: string | null;
};

export type FormulaNaLista = Formula & { miniatura: string | null };

export type FormulaCompleta = Formula & {
  itens: ItemFormula[];
  fotos: FotoFormula[];
};

const COLUNAS_FORMULA =
  "id, cliente_id, atendimento_id, data, tipo, base_natural, resultado_alvo, volume_oxidante, tempo_pausa_min, tecnica, resultado, observacao";

const COLUNAS_ITEM = "id, descricao, quantidade, unidade, ordem";

type ClienteSupabase = Awaited<ReturnType<typeof exigirSessao>>["supabase"];

/**
 * Assina em lote os caminhos pedidos.
 *
 * Uma chamada só para a página inteira: a lista de fórmulas de uma
 * cliente antiga tem dezenas de miniaturas, e uma requisição por foto
 * deixaria a ficha lenta justamente no celular.
 */
async function urlsAssinadas(
  supabase: ClienteSupabase,
  caminhos: string[],
): Promise<Map<string, string>> {
  const mapa = new Map<string, string>();

  if (caminhos.length === 0) return mapa;

  const { data, error } = await supabase.storage
    .from(BUCKET_FORMULAS)
    .createSignedUrls(caminhos, SEGUNDOS_URL_ASSINADA);

  // Foto é acessório: se o Storage falhar, a ficha continua abrindo com
  // a fórmula — que é o que ela precisa ler no meio do atendimento.
  if (error || !data) return mapa;

  for (const assinada of data) {
    if (assinada.path && assinada.signedUrl && !assinada.error) {
      mapa.set(assinada.path, assinada.signedUrl);
    }
  }

  return mapa;
}

/**
 * Histórico de fórmulas da cliente, da mais recente para a mais antiga.
 *
 * A miniatura é a foto do "depois" quando existe — é por ela que a
 * Kamylle reconhece o atendimento; o "antes" só entra quando não há
 * depois.
 */
export async function listarFormulas(
  clienteId: string,
): Promise<FormulaNaLista[]> {
  const { supabase } = await exigirSessao();

  const { data, error } = await supabase
    .from("formulas")
    .select(COLUNAS_FORMULA)
    .eq("cliente_id", clienteId)
    .order("data", { ascending: false })
    .order("criado_em", { ascending: false });

  if (error) {
    throw new Error(`Não foi possível carregar as fórmulas: ${error.message}`);
  }

  const formulas = (data ?? []) as Formula[];

  if (formulas.length === 0) return [];

  const { data: fotos, error: erroFotos } = await supabase
    .from("formula_fotos")
    .select("formula_id, momento, storage_path")
    .in(
      "formula_id",
      formulas.map((formula) => formula.id),
    );

  if (erroFotos) {
    throw new Error(`Não foi possível carregar as fotos: ${erroFotos.message}`);
  }

  const caminhoPorFormula = new Map<string, string>();

  for (const foto of (fotos ?? []) as {
    formula_id: string;
    momento: Momento;
    storage_path: string;
  }[]) {
    const atual = caminhoPorFormula.get(foto.formula_id);

    // 'depois' ganha de 'antes'; sem depois, fica o que veio primeiro.
    if (!atual || foto.momento === "depois") {
      caminhoPorFormula.set(foto.formula_id, foto.storage_path);
    }
  }

  const urls = await urlsAssinadas(supabase, [...caminhoPorFormula.values()]);

  return formulas.map((formula) => {
    const caminho = caminhoPorFormula.get(formula.id);

    return {
      ...formula,
      miniatura: caminho ? (urls.get(caminho) ?? null) : null,
    };
  });
}

/** Uma fórmula com a mistura e as fotos. Null quando não é desta cliente. */
export async function obterFormula(
  clienteId: string,
  id: string,
): Promise<FormulaCompleta | null> {
  const { supabase } = await exigirSessao();

  const { data, error } = await supabase
    .from("formulas")
    .select(COLUNAS_FORMULA)
    // O id da cliente vem da rota: sem este filtro, trocar o uuid na URL
    // abriria a fórmula de outra pessoa.
    .eq("cliente_id", clienteId)
    .eq("id", id)
    .maybeSingle();

  if (error) {
    throw new Error(`Não foi possível carregar a fórmula: ${error.message}`);
  }

  if (!data) return null;

  const formula = data as Formula;

  const [itens, fotos] = await Promise.all([
    itensDaFormula(supabase, formula.id),
    fotosDaFormula(supabase, formula.id),
  ]);

  return { ...formula, itens, fotos };
}

async function itensDaFormula(supabase: ClienteSupabase, formulaId: string) {
  const { data, error } = await supabase
    .from("formula_itens")
    .select(COLUNAS_ITEM)
    .eq("formula_id", formulaId)
    .order("ordem", { ascending: true });

  if (error) {
    throw new Error(`Não foi possível carregar a mistura: ${error.message}`);
  }

  return (data ?? []) as ItemFormula[];
}

async function fotosDaFormula(supabase: ClienteSupabase, formulaId: string) {
  const { data, error } = await supabase
    .from("formula_fotos")
    .select("id, momento, storage_path")
    .eq("formula_id", formulaId);

  if (error) {
    throw new Error(`Não foi possível carregar as fotos: ${error.message}`);
  }

  const linhas = (data ?? []) as Omit<FotoFormula, "url">[];

  const urls = await urlsAssinadas(
    supabase,
    linhas.map((foto) => foto.storage_path),
  );

  return linhas.map((foto) => ({
    ...foto,
    url: urls.get(foto.storage_path) ?? null,
  }));
}

/**
 * A fórmula mais recente da cliente, com a mistura — a fonte do botão
 * "repetir última fórmula". Sem fotos: elas não são copiadas.
 */
export async function ultimaFormula(clienteId: string) {
  const { supabase } = await exigirSessao();

  const { data, error } = await supabase
    .from("formulas")
    .select(COLUNAS_FORMULA)
    .eq("cliente_id", clienteId)
    .order("data", { ascending: false })
    .order("criado_em", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (error) {
    throw new Error(
      `Não foi possível carregar a última fórmula: ${error.message}`,
    );
  }

  if (!data) return null;

  const formula = data as Formula;

  return { ...formula, itens: await itensDaFormula(supabase, formula.id) };
}
