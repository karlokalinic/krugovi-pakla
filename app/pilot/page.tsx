import { PilotEditor } from "@/components/pilot/PilotEditor";
import { PilotLogin } from "@/components/pilot/PilotLogin";
import { isPilotAuthenticated } from "@/lib/auth";
import { getCircles, storageMode } from "@/lib/store";

export const dynamic = "force-dynamic";

export default async function PilotPage() {
  const authenticated = await isPilotAuthenticated();
  if (!authenticated) return <PilotLogin />;

  const circles = await getCircles();
  return <PilotEditor initialCircles={circles} initialStorageMode={storageMode()} />;
}
