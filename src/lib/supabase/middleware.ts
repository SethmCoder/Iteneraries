import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";
import { DEMO_COOKIE, isDemoModeEnabled } from "@/lib/demo-config";

const PUBLIC_PATHS = [
  "/login",
  "/signup",
  "/forgot-password",
  "/auth/callback",
  "/auth/reset-password",
];

function hasDemoCookie(request: NextRequest): boolean {
  return (
    isDemoModeEnabled() && request.cookies.get(DEMO_COOKIE)?.value === "1"
  );
}

export async function updateSession(request: NextRequest) {
  let supabaseResponse = NextResponse.next({ request });

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  const path = request.nextUrl.pathname;
  const demoSession = hasDemoCookie(request);
  const isAuthPage = PUBLIC_PATHS.some((p) => path.startsWith(p));
  const isWebhook = path.startsWith("/api/webhooks");
  const isDemoApi = path.startsWith("/api/demo/");
  const isStatic =
    path.startsWith("/_next") ||
    path.startsWith("/favicon") ||
    path.endsWith(".png") ||
    path.endsWith(".svg");
  const isApi = path.startsWith("/api/");

  if (!url || !key) {
    const isPublic =
      PUBLIC_PATHS.some((p) => path.startsWith(p)) ||
      isWebhook ||
      isDemoApi ||
      path === "/";

    if (demoSession && (isAuthPage || path === "/")) {
      const redirectUrl = request.nextUrl.clone();
      redirectUrl.pathname = "/trips";
      return NextResponse.redirect(redirectUrl);
    }

    if (!isPublic && !isStatic && !demoSession) {
      if (isApi) {
        return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
      }
      const redirectUrl = request.nextUrl.clone();
      redirectUrl.pathname = "/login";
      redirectUrl.searchParams.set("next", path);
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

  if (
    !user &&
    !demoSession &&
    !isAuthPage &&
    !isWebhook &&
    !isDemoApi &&
    !isStatic &&
    path !== "/"
  ) {
    if (isApi) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    const redirectUrl = request.nextUrl.clone();
    redirectUrl.pathname = "/login";
    redirectUrl.searchParams.set("next", path);
    return NextResponse.redirect(redirectUrl);
  }

  if ((user || demoSession) && (isAuthPage || path === "/")) {
    const redirectUrl = request.nextUrl.clone();
    redirectUrl.pathname = "/trips";
    return NextResponse.redirect(redirectUrl);
  }

  return supabaseResponse;
}
