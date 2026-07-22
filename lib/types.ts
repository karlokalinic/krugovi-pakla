export type VisualMode =
  | "columns"
  | "vortex"
  | "rain"
  | "weights"
  | "marsh"
  | "tombs"
  | "forest"
  | "ditches"
  | "ice";

export interface Subregion {
  name: string;
  condemned: string;
  punishment: string;
  meaning: string;
}

export interface InfernoCircle {
  id: string;
  order: number;
  kind: "dante" | "custom";
  slug: string;
  roman: string;
  title: string;
  subtitle: string;
  canto: string;
  sin: string;
  thesis: string;
  summary: string;
  guilt: string;
  punishment: string;
  contrapasso: string;
  guardians: string[];
  inhabitants: string[];
  geography: string;
  senses: string;
  stageDirection: string;
  visualMode: VisualMode;
  palette: [string, string, string];
  ambient: string;
  subregions: Subregion[];
  published: boolean;
  updatedAt: string;
}
