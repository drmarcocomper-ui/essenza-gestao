import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

import { supabaseEnv } from "@/lib/supabase/env";

/*
 * Antigo `middleware.ts`. No Next 16 a convenção é `proxy.ts` — mesmo
 * comportamento, sempre no runtime Node.
 */

/**
 * Rotas acessíveis sem sessão. Todo o resto (ou seja, tudo sob `(app)`)
 * exige login. Lista de exceções em vez de lista de protegidas: rota nova
 * nasce protegida por padrão.
 */
const ROTAS_PUBLICAS = ["/login"];

function ehRotaPublica(pathname: string) {
  return ROTAS_PUBLICAS.some(
    (rota) => pathname === rota || pathname.startsWith(`${rota}/`),
  );
}

export default async function proxy(request: NextRequest) {
  const { url, anonKey } = supabaseEnv();

  let response = NextResponse.next({ request });

  const supabase = createServerClient(url, anonKey, {
    cookies: {
      getAll() {
        return request.cookies.getAll();
      },
      setAll(cookiesToSet, headers) {
        cookiesToSet.forEach(({ name, value }) => {
          request.cookies.set(name, value);
        });
        response = NextResponse.next({ request });
        cookiesToSet.forEach(({ name, value, options }) => {
          response.cookies.set(name, value, options);
        });
        // Resposta que escreve cookie de auth não pode ser cacheada por CDN.
        Object.entries(headers).forEach(([chave, valor]) => {
          response.headers.set(chave, valor);
        });
      },
    },
  });

  // Precisa vir antes de qualquer resposta ser montada: é o que faz o
  // refresh do token e grava os cookies novos via setAll.
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const { pathname } = request.nextUrl;

  if (!user && !ehRotaPublica(pathname)) {
    const destino = request.nextUrl.clone();
    destino.pathname = "/login";
    destino.search = "";
    return redirecionar(destino, response);
  }

  if (user && pathname === "/login") {
    const destino = request.nextUrl.clone();
    destino.pathname = "/hoje";
    destino.search = "";
    return redirecionar(destino, response);
  }

  return response;
}

/**
 * Redireciona preservando os cookies que o refresh de sessão acabou de
 * gravar em `response` — sem isso a sessão renovada se perde.
 */
function redirecionar(destino: URL, response: NextResponse) {
  const redirect = NextResponse.redirect(destino);

  response.cookies.getAll().forEach((cookie) => {
    redirect.cookies.set(cookie);
  });

  return redirect;
}

export const config = {
  matcher: [
    /*
     * Tudo, menos arquivos estáticos e imagens:
     * - _next/static, _next/image
     * - favicon e assets de imagem na raiz de /public
     * - sw.js e manifest.webmanifest, os dois arquivos do PWA
     *
     * Os dois do PWA precisam sair daqui: o browser busca o manifest sem
     * cookie (credentials omitidos) e recusa registrar um service worker
     * cujo script responde redirect. Passando pelo proxy, ambos voltavam
     * 307 para /login e o app não instalava. Nenhum dos dois carrega dado
     * de ninguém — e o sw.js nunca cacheia navegação nem Supabase.
     *
     * As duas exclusões são ancoradas em $: sem a âncora, /sw.js/qualquer
     * coisa também escaparia do proxy.
     */
    "/((?!_next/static|_next/image|favicon.ico|sw\\.js$|manifest\\.webmanifest$|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico)$).*)",
  ],
};
