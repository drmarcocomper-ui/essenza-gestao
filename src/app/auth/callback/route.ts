import { NextResponse, type NextRequest } from "next/server";

import { createClient } from "@/lib/supabase/server";

/**
 * Destino do magic link: troca o `code` por sessão (cookies gravados pelo
 * cliente de server) e manda para /hoje.
 */
export async function GET(request: NextRequest) {
  const { searchParams, origin } = request.nextUrl;
  const code = searchParams.get("code");

  if (!code) {
    // Link expirado ou já usado: o Supabase manda error/error_description.
    return NextResponse.redirect(`${origin}/login?erro=link_invalido`);
  }

  const supabase = await createClient();
  const { error } = await supabase.auth.exchangeCodeForSession(code);

  if (error) {
    return NextResponse.redirect(`${origin}/login?erro=link_invalido`);
  }

  return NextResponse.redirect(`${origin}/hoje`);
}
