import { NextResponse } from "next/server";
import { DEMO_COOKIE } from "@/lib/demo";

export async function POST() {
  const response = NextResponse.json({ ok: true });
  response.cookies.set(DEMO_COOKIE, "", {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: 0,
  });
  return response;
}
