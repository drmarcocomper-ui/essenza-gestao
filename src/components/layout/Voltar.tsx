import type { Route } from "next";
import Link from "next/link";
import { ChevronLeft } from "lucide-react";

/**
 * O "voltar" de toda página que não é raiz de aba. Instalado como PWA no
 * iPhone, o app não tem botão de voltar do navegador nem do sistema: sem
 * isto, a única saída é a BottomNav, que leva à raiz da aba.
 *
 * O destino é FIXO — a página mãe —, nunca `router.back()`: depois de
 * salvar, o histórico devolveria ao formulário enviado; aberta direto
 * (link, tela inicial), a página não tem histórico e o botão não faria
 * nada.
 *
 * O rótulo diz para onde vai ("‹ Caixa", "‹ Cliente"): ela lê o destino
 * antes de tocar.
 */
export default function Voltar({
  href,
  rotulo,
}: {
  href: Route;
  rotulo: string;
}) {
  return (
    <Link
      href={href}
      aria-label={`Voltar para ${rotulo}`}
      // -ml-2: o chevron alinha com a borda do conteúdo, e a área de
      // toque (min-h-11 = 44px) sobra para a esquerda.
      className="-mt-2 -ml-2 flex min-h-11 w-fit max-w-full items-center gap-0.5 rounded-xl pr-3 pl-1 text-rose-700 active:bg-rose-50"
    >
      <ChevronLeft aria-hidden="true" className="size-6 shrink-0" />
      <span className="truncate font-medium">{rotulo}</span>
    </Link>
  );
}
