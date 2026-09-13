import Link from "next/link";

import {
  linkCaixa,
  type FiltrosCaixa as Filtros,
  type SlugStatus,
  type SlugTipo,
} from "@/lib/caixa/url";

/**
 * Filtros de tipo e de status. Cada pílula é um link para a mesma lista
 * com outro filtro: um toque só, sem estado no cliente.
 */
export default function FiltrosCaixa({ filtros }: { filtros: Filtros }) {
  const tipos: { slug: SlugTipo; rotulo: string }[] = [
    { slug: "todos", rotulo: "Tudo" },
    { slug: "entrada", rotulo: "Entradas" },
    { slug: "saida", rotulo: "Saídas" },
  ];

  const status: { slug: SlugStatus; rotulo: string }[] = [
    { slug: "todos", rotulo: "Todos" },
    { slug: "pago", rotulo: "Pagos" },
    { slug: "pendente", rotulo: "Pendentes" },
  ];

  return (
    <div className="space-y-2">
      <Grupo rotulo="Filtrar por tipo">
        {tipos.map(({ slug, rotulo }) => (
          <Pilula
            key={slug}
            href={linkCaixa({ ...filtros, tipo: slug })}
            ativo={filtros.tipo === slug}
          >
            {rotulo}
          </Pilula>
        ))}
      </Grupo>

      <Grupo rotulo="Filtrar por status">
        {status.map(({ slug, rotulo }) => (
          <Pilula
            key={slug}
            href={linkCaixa({ ...filtros, status: slug })}
            ativo={filtros.status === slug}
          >
            {rotulo}
          </Pilula>
        ))}
      </Grupo>
    </div>
  );
}

function Grupo({
  rotulo,
  children,
}: {
  rotulo: string;
  children: React.ReactNode;
}) {
  return (
    <div role="group" aria-label={rotulo} className="flex gap-2">
      {children}
    </div>
  );
}

function Pilula({
  href,
  ativo,
  children,
}: {
  href: string;
  ativo: boolean;
  children: React.ReactNode;
}) {
  return (
    <Link
      href={href}
      aria-current={ativo ? "true" : undefined}
      scroll={false}
      className={`flex min-h-11 flex-1 items-center justify-center rounded-xl border px-2 text-sm font-medium ${
        ativo
          ? "border-rose-600 bg-rose-600 text-white"
          : "border-neutral-300 bg-white text-neutral-600 active:bg-neutral-100"
      }`}
    >
      {children}
    </Link>
  );
}
