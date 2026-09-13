/*
 * Service worker do Essenza, escrito à mão. Sem workbox, sem build step.
 *
 * O app é autenticado e single-tenant: cachear resposta de página serviria
 * dado de uma sessão para outra, ou mostraria tela de app para quem já foi
 * deslogado. Por isso a regra é estreita de propósito — só entra em cache o
 * que é imutável e público: o bundle de /_next/static (nome com hash) e
 * imagem/fonte de public/. Todo o resto vai para a rede, sempre.
 *
 * O listener de 'fetch' precisa existir mesmo quando não intercepta nada:
 * é um dos critérios do Chrome para oferecer a instalação.
 */

// Subir a versão invalida o cache inteiro no próximo activate.
const CACHE = "essenza-static-v1";

const EXTENSOES = [".png", ".svg", ".ico", ".webp", ".woff2"];

/** Só o que é imutável e não tem dado de ninguém dentro. */
function podeCachear(url) {
  if (url.pathname.startsWith("/_next/static/")) return true;

  return EXTENSOES.some((extensao) => url.pathname.endsWith(extensao));
}

self.addEventListener("install", (evento) => {
  // Nada é pré-cacheado: os nomes têm hash e mudam a cada build. O cache
  // se enche sozinho, conforme a navegação.
  evento.waitUntil(self.skipWaiting());
});

self.addEventListener("activate", (evento) => {
  evento.waitUntil(
    (async () => {
      const nomes = await caches.keys();

      await Promise.all(
        nomes.filter((nome) => nome !== CACHE).map((nome) => caches.delete(nome)),
      );

      await self.clients.claim();
    })(),
  );
});

self.addEventListener("fetch", (evento) => {
  const { request } = evento;

  if (request.method !== "GET") return;

  // Navegação nunca é interceptada: HTML de página autenticada não pode sair
  // do cache. Sem respondWith, o browser busca na rede como se o SW não
  // existisse. Isto vem antes de tudo, de propósito.
  if (request.mode === "navigate") return;

  let url;

  try {
    url = new URL(request.url);
  } catch {
    return;
  }

  // Supabase (auth, PostgREST, storage) e qualquer outra origem: passa direto.
  if (url.origin !== self.location.origin) return;

  // Rota de API do próprio app também é dado, não estático.
  if (url.pathname.startsWith("/api/")) return;

  if (!podeCachear(url)) return;

  evento.respondWith(
    (async () => {
      const cacheado = await caches.match(request);

      if (cacheado) return cacheado;

      const resposta = await fetch(request);

      // Só guarda resposta própria e boa. `opaque` (status 0) não dá para
      // inspecionar e ocuparia o cache à toa.
      if (resposta.ok && resposta.type === "basic") {
        const cache = await caches.open(CACHE);

        cache.put(request, resposta.clone());
      }

      return resposta;
    })(),
  );
});
