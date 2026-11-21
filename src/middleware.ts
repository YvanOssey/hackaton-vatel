import { NextResponse, type NextRequest } from "next/server";

const PROTECTED = ["/espace", "/famille", "/caisse", "/cuisine", "/admin", "/mot-de-passe"];

/** Première barrière (présence du cookie). Les droits réels sont contrôlés côté serveur dans chaque page et action. */
export function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl;
  if (PROTECTED.some((p) => pathname === p || pathname.startsWith(`${p}/`)) && !req.cookies.get("cc_session")) {
    const url = req.nextUrl.clone();
    url.pathname = "/connexion";
    url.search = "";
    return NextResponse.redirect(url);
  }
  return NextResponse.next();
}

export const config = { matcher: ["/((?!_next/|favicon.ico|api/).*)"] };
