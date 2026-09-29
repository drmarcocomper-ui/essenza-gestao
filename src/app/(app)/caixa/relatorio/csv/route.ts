import type { NextRequest } from "next/server";

import { listarRelatorioMes } from "@/lib/caixa/consultas";
import { lerFiltros } from "@/lib/caixa/url";
import { gerarCsv, nomeArquivoCsv } from "@/lib/relatorio/csv";

/**
 * O CSV do relatório do mês, para mandar à contadora.
 *
 * Autenticada como as páginas: o proxy barra quem não tem sessão, e
 * `listarRelatorioMes` passa por `exigirSessao` de novo — rota GET pode
 * ser chamada direto, fora da tela.
 */
export async function GET(request: NextRequest) {
  const { mes } = lerFiltros({
    mes: request.nextUrl.searchParams.get("mes") ?? undefined,
  });

  const csv = gerarCsv(await listarRelatorioMes(mes));

  return new Response(csv, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="${nomeArquivoCsv(mes)}"`,
      // Dinheiro dela: nenhum cache guarda o arquivo.
      "Cache-Control": "private, no-store",
    },
  });
}
