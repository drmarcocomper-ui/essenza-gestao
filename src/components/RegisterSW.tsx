"use client";

import { useEffect } from "react";

/**
 * Registra o service worker — só em produção.
 *
 * Em desenvolvimento o registro é desfeito: com `next dev`, um SW ativo de
 * um build anterior serve bundle velho e o que aparece na tela deixa de
 * corresponder ao código. Desregistrar aqui conserta a máquina de quem já
 * abriu o app em produção e depois voltou a desenvolver nela.
 */
export default function RegisterSW() {
  useEffect(() => {
    if (!("serviceWorker" in navigator)) return;

    if (process.env.NODE_ENV !== "production") {
      navigator.serviceWorker
        .getRegistrations()
        .then((registros) => {
          for (const registro of registros) {
            registro.unregister();
          }
        })
        .catch(() => {
          // Sem SW registrado não há o que limpar.
        });

      return;
    }

    navigator.serviceWorker.register("/sw.js").catch((erro) => {
      // Falhar aqui não quebra o app: ele só deixa de ser instalável.
      console.error("Falha ao registrar o service worker:", erro);
    });
  }, []);

  return null;
}
