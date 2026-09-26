import { CalendarCheck, Package, Users, Wallet } from "lucide-react";
import type { LucideIcon } from "lucide-react";

export type ItemNav = {
  href: string;
  label: string;
  icone: LucideIcon;
};

/** As 4 seções do app. Fonte única para a BottomNav e para o título do header. */
export const ITENS_NAV: ItemNav[] = [
  { href: "/hoje", label: "Hoje", icone: CalendarCheck },
  { href: "/clientes", label: "Clientes", icone: Users },
  { href: "/caixa", label: "Caixa", icone: Wallet },
  { href: "/produtos", label: "Produtos", icone: Package },
];

export function itemAtivo(pathname: string) {
  return ITENS_NAV.find(
    (item) => pathname === item.href || pathname.startsWith(`${item.href}/`),
  );
}
