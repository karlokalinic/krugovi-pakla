import { InfernoExperience } from "@/components/InfernoExperience";
import { getCircles } from "@/lib/store";

export const dynamic = "force-dynamic";

export default async function HomePage() {
  const circles = (await getCircles()).filter((circle) => circle.published).sort((a, b) => a.order - b.order);
  return <InfernoExperience circles={circles} />;
}
