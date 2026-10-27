import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

const PUBLIC_PATHS = [
  "/login",
  "/signup",
  "/forgot-password",
  "/auth/callback",
  "/auth/reset-password",
];

export async function updateSession(request: NextRequest) {
  let supabaseResponse = NextResponse.next({ request });

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (!url || !key) {
    // Allow browsing auth pages without config; protect app routes with a soft redirect.
    const path = request.nextUrl.pathname;
    const isPublic =
      PUBLIC_PATHS.some((p) => path.startsWith(p)) ||
      path.startsWith("/api/webhooks") ||
      path === "/";
    if (!isPublic && !path.startsWith("/_next") && !path.startsWith("/favicon")) {
      const redirectUrl = request.nextUrl.clone();
      redirectUrl.pathname = "/login";
      return NextResponse.redirect(redirectUrl);
    }
    return supabaseResponse;
  }

  const supabase = createServerClient(url, key, {
    cookies: {
      getAll() {
        return request.cookies.getAll();
      },
      setAll(cookiesToSet) {
        cookiesToSet.forEach(({ name, value }) =>
          request.cookies.set(name, value),
        );
        supabaseResponse = NextResponse.next({ request });
        cookiesToSet.forEach(({ name, value, options }) =>
          supabaseResponse.cookies.set(name, value, options),
        );
      },
    },
  });

  const {
    data: { user },
  } = await supabase.auth.getUser();

  const path = request.nextUrl.pathname;
  const isAuthPage = PUBLIC_PATHS.some((p) => path.startsWith(p));
  const isWebhook = path.startsWith("/api/webhooks");
  const isStatic =
    path.startsWith("/_next") ||
    path.startsWith("/favicon") ||
    path.endsWith(".png") ||
    path.endsWith(".svg");

  const isApi = path.startsWith("/api/");

  if (!user && !isAuthPage && !isWebhook && !isStatic && path !== "/") {
    if (isApi) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    const redirectUrl = request.nextUrl.clone();
    redirectUrl.pathname = "/login";
    redirectUrl.searchParams.set("next", path);
    return NextResponse.redirect(redirectUrl);
  }

  if (user && (isAuthPage || path === "/")) {
    const redirectUrl = request.nextUrl.clone();
    redirectUrl.pathname = "/trips";
    return NextResponse.redirect(redirectUrl);
  }

  return supabaseResponse;
}
