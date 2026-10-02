import type { NextRequest } from "next/server";

import { listarRelatorioAno } from "@/lib/caixa/consultas";
import { mesAtual } from "@/lib/caixa/mes";
import { gerarCsvAnual, nomeArquivoCsvAnual } from "@/lib/relatorio/csv";

/**
 * O CSV do ano, uma linha por mês, para mandar à contadora.
 *
 * Mesmo padrão de `/caixa/relatorio/csv`: o proxy barra quem não tem
 * sessão e `listarRelatorioAno` passa por `exigirSessao` de novo.
 */
export async function GET(request: NextRequest) {
  // Inválido ou ausente, o ano corrente — como o `?mes=` do Caixa.
  const pedido = request.nextUrl.searchParams.get("ano") ?? "";
  const ano = /^\d{4}$/.test(pedido) ? pedido : mesAtual().slice(0, 4);

  const csv = gerarCsvAnual(await listarRelatorioAno(ano), ano);

  return new Response(csv, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="${nomeArquivoCsvAnual(ano)}"`,
      // Dinheiro dela: nenhum cache guarda o arquivo.
      "Cache-Control": "private, no-store",
    },
  });
}
