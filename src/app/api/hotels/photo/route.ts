import { NextResponse } from "next/server";
import { getRequestUserId } from "@/lib/auth-guard";
import { fetchGoogleHotelPhoto } from "@/lib/hotels/google-places";
import { rateLimit } from "@/lib/rate-limit";

export async function GET(request: Request) {
  const userId = await getRequestUserId();
  if (!userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const limited = rateLimit(`hotel-photo:${userId}`, 60, 60_000);
  if (!limited.ok) {
    return NextResponse.json({ error: "Rate limit exceeded" }, { status: 429 });
  }

  const { searchParams } = new URL(request.url);
  const name = searchParams.get("name") ?? "";
  const width = Number(searchParams.get("w") ?? "320");

  const photo = await fetchGoogleHotelPhoto(
    name,
    Number.isFinite(width) ? width : 320,
  );
  if (!photo) {
    return NextResponse.json({ error: "Photo unavailable" }, { status: 404 });
  }

  return new NextResponse(photo.body, {
    status: 200,
    headers: {
      "Content-Type": photo.contentType,
      "Cache-Control": "private, max-age=3600",
    },
  });
}
