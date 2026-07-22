import { NextResponse } from "next/server";
import { isPilotAuthenticated } from "@/lib/auth";
import { circlesSchema } from "@/lib/schemas";
import { getCircles, resetCircles, saveCircles, storageMode } from "@/lib/store";
import { isTrustedMutation } from "@/lib/security";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const authenticated = await isPilotAuthenticated();
    const circles = (await getCircles()).filter((circle) => authenticated || circle.published);
    return NextResponse.json({ circles, storageMode: storageMode() });
  } catch (error) {
    console.error(error);
    return NextResponse.json({ error: "Krugove nije moguće učitati." }, { status: 500 });
  }
}

export async function POST(request: Request) {
  if (!isTrustedMutation(request)) {
    return NextResponse.json({ error: "Nevažeće podrijetlo zahtjeva." }, { status: 403 });
  }

  if (!(await isPilotAuthenticated())) {
    return NextResponse.json({ error: "Nedopušten pristup." }, { status: 401 });
  }

  try {
    const body = (await request.json()) as { action?: string; circles?: unknown };
    const circles = body.action === "reset"
      ? await resetCircles()
      : await saveCircles(circlesSchema.parse(body.circles));

    return NextResponse.json({ circles, storageMode: storageMode() });
  } catch (error) {
    console.error(error);
    const message = error instanceof Error ? error.message : "Spremanje nije uspjelo.";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
