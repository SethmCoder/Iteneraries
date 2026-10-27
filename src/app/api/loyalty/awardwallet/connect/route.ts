import { NextResponse } from "next/server";
import { createAwardWalletAuthUrl, isAwardWalletConfigured } from "@/lib/loyalty/awardwallet";
import { createClient } from "@/lib/supabase/server";
import { cookies } from "next/headers";

export async function GET() {
  if (!isAwardWalletConfigured()) {
    return NextResponse.json(
      {
        error:
          "AwardWallet is not configured. Create a Business account at awardwallet.com, get an API key, set AWARDWALLET_API_KEY, and register the callback URL.",
      },
      { status: 503 },
    );
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.redirect(new URL("/login", process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000"));
  }

  const state = crypto.randomUUID();
  const store = await cookies();
  store.set("aw_oauth_state", state, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: 60 * 15,
  });
  store.set("aw_oauth_user", user.id, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: 60 * 15,
  });

  try {
    const url = await createAwardWalletAuthUrl(state);
    return NextResponse.redirect(url);
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 502 });
  }
}
