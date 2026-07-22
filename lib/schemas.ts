import { z } from "zod";

const hex = z.string().regex(/^#[0-9a-fA-F]{6}$/, "Boja mora biti u formatu #RRGGBB");

export const subregionSchema = z.object({
  name: z.string().min(1).max(120),
  condemned: z.string().min(1).max(500),
  punishment: z.string().min(1).max(1500),
  meaning: z.string().min(1).max(1500)
});

export const circleSchema = z.object({
  id: z.string().min(1).max(80),
  order: z.number().int().min(1).max(999),
  kind: z.enum(["dante", "custom"]),
  slug: z.string().regex(/^[a-z0-9-]+$/).max(100),
  roman: z.string().max(20),
  title: z.string().min(1).max(120),
  subtitle: z.string().max(240),
  canto: z.string().max(120),
  sin: z.string().min(1).max(240),
  thesis: z.string().min(1).max(500),
  summary: z.string().min(1).max(5000),
  guilt: z.string().min(1).max(5000),
  punishment: z.string().min(1).max(7000),
  contrapasso: z.string().min(1).max(5000),
  guardians: z.array(z.string().max(200)).max(30),
  inhabitants: z.array(z.string().max(200)).max(100),
  geography: z.string().min(1).max(3000),
  senses: z.string().min(1).max(3000),
  stageDirection: z.string().min(1).max(3000),
  visualMode: z.enum(["columns", "vortex", "rain", "weights", "marsh", "tombs", "forest", "ditches", "ice"]),
  palette: z.tuple([hex, hex, hex]),
  ambient: z.string().min(1).max(1000),
  subregions: z.array(subregionSchema).max(20),
  published: z.boolean(),
  updatedAt: z.string()
});

export const circlesSchema = z.array(circleSchema).min(1).max(99).superRefine((circles, ctx) => {
  const ids = new Set<string>();
  const slugs = new Set<string>();
  circles.forEach((circle, index) => {
    if (ids.has(circle.id)) ctx.addIssue({ code: "custom", message: "ID mora biti jedinstven", path: [index, "id"] });
    if (slugs.has(circle.slug)) ctx.addIssue({ code: "custom", message: "Slug mora biti jedinstven", path: [index, "slug"] });
    ids.add(circle.id);
    slugs.add(circle.slug);
  });
});
