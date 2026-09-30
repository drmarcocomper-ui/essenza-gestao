import type { Metadata } from "next";

import { criarCliente } from "@/app/(app)/clientes/actions";
import FormularioCliente from "@/components/clientes/FormularioCliente";
import Voltar from "@/components/layout/Voltar";

export const metadata: Metadata = {
  title: "Nova cliente — Essenza",
};

export default function NovaClientePage() {
  return (
    <div className="space-y-4">
      <Voltar href="/clientes" rotulo="Clientes" />

      <h2 className="text-lg font-semibold text-neutral-900">Nova cliente</h2>

      <FormularioCliente
        acao={criarCliente}
        rotuloEnviar="Cadastrar"
        cancelarHref="/clientes"
      />
    </div>
  );
}
