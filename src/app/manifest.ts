import type { MetadataRoute } from "next";

/**
 * Manifesto do PWA: o que o celular lê ao fixar o app na tela inicial.
 *
 * `display: standalone` tira a barra do navegador — é o que faz a tela de
 * atendimento caber inteira. `orientation: portrait` porque a usuária opera
 * de pé, com uma mão; paisagem só atrapalharia.
 */
export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Essenza Gestão",
    short_name: "Essenza",
    description: "Gestão do salão",
    lang: "pt-BR",
    start_url: "/",
    scope: "/",
    display: "standalone",
    orientation: "portrait",
    // O app não tem cor de marca no chrome: header, body e a barra do
    // navegador são brancos (ver viewport.themeColor no layout). O rosé
    // aparece só em botões, então não serve de theme_color. Mantendo as
    // duas em branco, a splash do Android combina com a primeira tela.
    background_color: "#ffffff",
    theme_color: "#ffffff",
    icons: [
      { src: "/icon-192.png", sizes: "192x192", type: "image/png", purpose: "any" },
      { src: "/icon-512.png", sizes: "512x512", type: "image/png", purpose: "any" },
      // Maskable separado: o Android recorta este em círculo/squircle, e o
      // ícone "any" ficaria com as bordas comidas se fizesse os dois papéis.
      {
        src: "/icon-maskable-512.png",
        sizes: "512x512",
        type: "image/png",
        purpose: "maskable",
      },
    ],
  };
}
