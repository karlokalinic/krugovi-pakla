import { NextResponse } from "next/server";
import { createPilotToken, setPilotCookie, verifyPilotPassword } from "@/lib/auth";
import { isTrustedMutation } from "@/lib/security";

const attempts = new Map<string, { count: number; resetAt: number }>();
const WINDOW_MS = 10 * 60 * 1000;
const LIMIT = 8;

function clientKey(request: Request): string {
  return request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || "local";
}

function isRateLimited(key: string): boolean {
  const now = Date.now();
  const entry = attempts.get(key);
  if (!entry || entry.resetAt < now) {
    attempts.set(key, { count: 1, resetAt: now + WINDOW_MS });
    return false;
  }
  entry.count += 1;
  return entry.count > LIMIT;
}

export async function POST(request: Request) {
  if (!isTrustedMutation(request)) {
    return NextResponse.json({ error: "Nevažeće podrijetlo zahtjeva." }, { status: 403 });
  }

  const key = clientKey(request);
  if (isRateLimited(key)) {
    return NextResponse.json({ error: "Previše pokušaja. Pričekaj deset minuta." }, { status: 429 });
  }

  try {
    const body = (await request.json()) as { password?: string };
    if (!body.password || !(await verifyPilotPassword(body.password))) {
      await new Promise((resolve) => setTimeout(resolve, 350));
      return NextResponse.json({ error: "Pogrešna pristupna lozinka." }, { status: 401 });
    }

    const token = await createPilotToken();
    await setPilotCookie(token);
    attempts.delete(key);
    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error(error);
    return NextResponse.json({ error: "Pilot nije konfiguriran. Provjeri poslužiteljske varijable." }, { status: 500 });
  }
}
