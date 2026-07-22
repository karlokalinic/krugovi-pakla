import "server-only";

import fs from "node:fs/promises";
import path from "node:path";
import { createClient } from "@supabase/supabase-js";
import { DEFAULT_CIRCLES } from "@/data/default-circles";
import { circlesSchema } from "@/lib/schemas";
import type { InfernoCircle } from "@/lib/types";

const PROJECT_ID = "krugovi-pakla";
const fallbackPath = path.join(process.cwd(), "data", "runtime-circles.json");

function hasSupabase(): boolean {
  return Boolean(process.env.SUPABASE_URL && process.env.SUPABASE_SERVICE_ROLE_KEY);
}

function supabase() {
  return createClient(process.env.SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!, {
    auth: { persistSession: false, autoRefreshToken: false }
  });
}

export function storageMode(): "supabase" | "filesystem" {
  return hasSupabase() ? "supabase" : "filesystem";
}

export async function getCircles(): Promise<InfernoCircle[]> {
  if (hasSupabase()) {
    const { data, error } = await supabase()
      .from("inferno_projects")
      .select("circles")
      .eq("id", PROJECT_ID)
      .maybeSingle();

    if (error) throw new Error(`Supabase čitanje nije uspjelo: ${error.message}`);
    if (!data?.circles) return structuredClone(DEFAULT_CIRCLES);
    return circlesSchema.parse(data.circles).sort((a, b) => a.order - b.order);
  }

  try {
    const raw = await fs.readFile(fallbackPath, "utf8");
    return circlesSchema.parse(JSON.parse(raw)).sort((a, b) => a.order - b.order);
  } catch (error) {
    const code = (error as NodeJS.ErrnoException).code;
    if (code !== "ENOENT") console.warn("Ne mogu pročitati lokalno stanje; koristim Danteove zadane krugove.", error);
    return structuredClone(DEFAULT_CIRCLES);
  }
}

export async function saveCircles(input: InfernoCircle[]): Promise<InfernoCircle[]> {
  const normalized = circlesSchema.parse(input)
    .map((circle, index) => ({ ...circle, order: index + 1, updatedAt: new Date().toISOString() }))
    .sort((a, b) => a.order - b.order);

  if (hasSupabase()) {
    const { error } = await supabase()
      .from("inferno_projects")
      .upsert({ id: PROJECT_ID, circles: normalized, updated_at: new Date().toISOString() }, { onConflict: "id" });
    if (error) throw new Error(`Supabase spremanje nije uspjelo: ${error.message}`);
    return normalized;
  }

  await fs.mkdir(path.dirname(fallbackPath), { recursive: true });
  await fs.writeFile(fallbackPath, JSON.stringify(normalized, null, 2), "utf8");
  return normalized;
}

export async function resetCircles(): Promise<InfernoCircle[]> {
  return saveCircles(structuredClone(DEFAULT_CIRCLES));
}
