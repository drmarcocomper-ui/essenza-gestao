import { lerParcela } from "@/lib/caixa/parcela";

/**
 * "Parcela 2/3". Sem ele, as parcelas da mesma venda são linhas
 * idênticas: mesmo nome, mesma data, mesmo valor.
 *
 * Não renderiza nada quando `parcelamento` não é `n/N` — null, ou a data
 * ISO que parte do histórico importado tem nessa coluna.
 */
export default function ChipParcela({
  parcelamento,
  className = "",
}: {
  parcelamento: string | null;
  className?: string;
}) {
  const parcela = lerParcela(parcelamento);

  if (!parcela) return null;

  return (
    <span
      className={`inline-block rounded-full bg-neutral-100 px-2 py-0.5 text-xs text-neutral-600 tabular-nums ${className}`}
    >
      Parcela {parcela.rotulo}
    </span>
  );
}
