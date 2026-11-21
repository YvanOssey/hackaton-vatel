import { NextResponse } from "next/server";
import { getCurrentUser } from "@/server/auth";
import { readMenuPhoto } from "@/server/services/photos";

export const dynamic = "force-dynamic";

/** Photo d'un plat : réservée aux comptes connectés (étudiants, parents, personnel) */
export async function GET(_req: Request, { params }: { params: Promise<{ date: string; course: string }> }) {
  const user = await getCurrentUser();
  if (!user) return new NextResponse(null, { status: 401 });
  const { date, course } = await params;
  const photo = await readMenuPhoto(date, course);
  if (!photo) return new NextResponse(null, { status: 404 });
  return new NextResponse(new Uint8Array(photo.data), {
    headers: {
      "Content-Type": photo.mime,
      "Content-Length": String(photo.data.length),
      // L'adresse porte la version (?v=) : l'image peut rester en cache du navigateur, jamais d'un cache partagé
      "Cache-Control": "private, max-age=31536000, immutable",
      "Last-Modified": photo.updatedAt.toUTCString(),
      "Content-Security-Policy": "default-src 'none'; sandbox",
      "X-Content-Type-Options": "nosniff",
    },
  });
}
