import type { Metadata } from "next";

import { criarCliente } from "@/app/(app)/clientes/actions";
import FormularioCliente from "@/components/clientes/FormularioCliente";

export const metadata: Metadata = {
  title: "Nova cliente — Essenza",
};

export default function NovaClientePage() {
  return (
    <div className="space-y-4">
      <h2 className="text-lg font-semibold text-neutral-900">Nova cliente</h2>

      <FormularioCliente
        acao={criarCliente}
        rotuloEnviar="Cadastrar"
        cancelarHref="/clientes"
      />
    </div>
  );
}
