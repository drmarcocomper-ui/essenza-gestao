import { totalItens, totalLinha } from "@/lib/atendimentos/conta";
import { formatarData, formatarMoeda, telefoneWhatsApp } from "@/lib/formatters";

export type ItemDaMensagem = {
  /** O mesmo rótulo da página: "Escova", "Extensão 1254"… */
  descricao: string;
  quantidade: number;
  valorUnitario: number;
};

/**
 * "R$ 150,00" com espaço comum: o Intl separa com espaço não quebrável,
 * que no WhatsApp copiado e colado vira caractere estranho.
 */
function moeda(centavos: number) {
  return formatarMoeda(centavos / 100).replace(/ /g, " ");
}

/**
 * O resumo do atendimento que ela manda à cliente pelo WhatsApp.
 *
 * Só o que a cliente consumiu e quanto deu: nada de forma de pagamento,
 * parcela, instituição ou PF/PJ — isso é o caixa dela, não da cliente.
 * Item a zero sai "cortesia": "R$ 0,00" numa mensagem lê como erro.
 */
export function mensagemDoAtendimento({
  cliente,
  data,
  itens,
}: {
  cliente: { nome: string };
  data: string;
  itens: readonly ItemDaMensagem[];
}) {
  const primeiroNome = cliente.nome.trim().split(/\s+/)[0] ?? "";

  const linhas = itens.map((item) => {
    const valor = totalLinha(item);
    const quantidade = item.quantidade > 1 ? `${item.quantidade}× ` : "";

    return `• ${quantidade}${item.descricao} — ${valor === 0 ? "cortesia" : moeda(valor)}`;
  });

  return [
    `Olá, ${primeiroNome}! Segue o resumo do seu atendimento de ${formatarData(data)} na Essenza:`,
    "",
    ...linhas,
    "",
    `Total: ${moeda(totalItens(itens))}`,
    "Obrigada pela preferência! 💛",
  ].join("\n");
}

/**
 * Link wa.me com o texto pronto. Sem telefone válido, abre o WhatsApp
 * para ela escolher o contato.
 */
export function linkDaMensagem(
  telefone: string | null | undefined,
  texto: string,
) {
  const numero = telefoneWhatsApp(telefone);

  return `https://wa.me/${numero ?? ""}?text=${encodeURIComponent(texto)}`;
}
