import { NextResponse } from "next/server";
import { clearPilotCookie } from "@/lib/auth";
import { isTrustedMutation } from "@/lib/security";

export async function POST(request: Request) {
  if (!isTrustedMutation(request)) {
    return NextResponse.json({ error: "Nevažeće podrijetlo zahtjeva." }, { status: 403 });
  }
  await clearPilotCookie();
  return NextResponse.json({ ok: true });
}
