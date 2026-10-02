import { registrarNota } from "@/app/(app)/produtos/compras/actions";
import {
  BUCKET_NOTAS,
  caminhoNota,
  falhaDaNota,
  prepararNota,
  type EtapaNota,
  type FalhaNota,
} from "@/lib/estoque/nota";
import { createClient } from "@/lib/supabase/client";

/**
 * Prepara (foto reduzida; PDF como está), sobe para {compra_id}/nota.<ext>
 * e liga à compra. Só no navegador. Devolve a falha já traduzida, ou
 * null se deu certo.
 *
 * Upsert: trocar a nota do mesmo formato sobrescreve o mesmo caminho; se
 * o formato mudou, `registrarNota` apaga o arquivo antigo.
 */
export async function enviarNota(
  compraId: string,
  arquivo: File,
): Promise<FalhaNota | null> {
  let etapa: EtapaNota = "preparar";

  try {
    const nota = await prepararNota(arquivo);

    etapa = "enviar";

    const { error } = await createClient()
      .storage.from(BUCKET_NOTAS)
      .upload(caminhoNota(compraId, nota.extensao), nota.arquivo, {
        contentType: nota.contentType,
        upsert: true,
      });

    if (error) throw error;

    etapa = "registrar";

    const { erro } = await registrarNota(compraId, nota.extensao);

    return erro ? { texto: erro, podeTentarDeNovo: true } : null;
  } catch (falha) {
    // O erro real vai para o console fora de produção, como nas fotos.
    if (process.env.NODE_ENV !== "production") {
      console.error(`Falha ao ${etapa} a nota:`, falha);
    }

    return falhaDaNota(
      etapa,
      falha,
      // navigator.onLine só é confiável no negativo.
      typeof navigator === "undefined" ? true : navigator.onLine,
    );
  }
}
