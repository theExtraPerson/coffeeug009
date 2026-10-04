import { createServerClient, type SetAllCookies } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

/** Screens that require a session. Everything else is public. */
const PROTECTED = [
  "/invite",
  "/team",
  "/me",
  "/deposit",
  "/withdraw",
  "/records",
  "/orders",
  "/admin",
];

export async function middleware(request: NextRequest) {
  let response = NextResponse.next({ request });

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anon = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !anon) return response;

  const supabase = createServerClient(url, anon, {
    cookies: {
      getAll() {
        return request.cookies.getAll();
      },
      setAll(cookiesToSet: Parameters<SetAllCookies>[0]) {
        cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value));
        response = NextResponse.next({ request });
        cookiesToSet.forEach(({ name, value, options }) =>
          response.cookies.set(name, value, options),
        );
      },
    },
  });

  const {
    data: { user },
  } = await supabase.auth.getUser();

  const path = request.nextUrl.pathname;
  // /invite is the member's own share screen. /invite/CODE is the public link
  // a friend opens, and it has to keep the inviter's permanent code.
  const publicInvite = /^\/invite\/[A-Za-z0-9]{4,10}$/.test(path);
  const needsAuth =
    !publicInvite && PROTECTED.some((p) => path === p || path.startsWith(`${p}/`));

  if (needsAuth && !user) {
    const target = request.nextUrl.clone();
    target.pathname = "/login";
    return NextResponse.redirect(target);
  }

  // A signed-in member following an invite link goes to the invite landing so
  // the code is still applied; otherwise straight to the wallet.
  if ((path === "/login" || path === "/register") && user) {
    const invite =
      request.nextUrl.searchParams.get("ref") ||
      request.nextUrl.searchParams.get("invite") ||
      request.nextUrl.searchParams.get("code");
    const target = request.nextUrl.clone();
    if (invite && /^[A-Za-z0-9]{4,10}$/.test(invite)) {
      target.pathname = `/invite/${invite.toUpperCase()}`;
      target.search = "";
      return NextResponse.redirect(target);
    }
    target.pathname = "/";
    target.search = "";
    return NextResponse.redirect(target);
  }

  return response;
}

export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|sw.js|manifest.json|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)",
  ],
};
