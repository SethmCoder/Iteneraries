import { NextResponse } from "next/server";
import {
  DEMO_COOKIE,
  getDemoPassword,
  isDemoModeEnabled,
} from "@/lib/demo-config";

export async function POST(request: Request) {
  if (!isDemoModeEnabled()) {
    return NextResponse.json(
      { error: "Demo mode is not enabled on this deployment." },
      { status: 403 },
    );
  }

  let password = "";
  try {
    const body = (await request.json()) as { password?: string };
    password = body.password ?? "";
  } catch {
    password = "";
  }

  const required = getDemoPassword();
  if (required && password !== required) {
    return NextResponse.json({ error: "Invalid preview password." }, { status: 401 });
  }

  const response = NextResponse.json({ ok: true });
  response.cookies.set(DEMO_COOKIE, "1", {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: 60 * 60 * 24 * 7,
  });
  return response;
}
