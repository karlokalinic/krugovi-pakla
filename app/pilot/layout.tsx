import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "PILOT / Krugovi pakla",
  robots: { index: false, follow: false, noarchive: true, nosnippet: true }
};

export default function PilotLayout({ children }: { children: React.ReactNode }) {
  return children;
}
