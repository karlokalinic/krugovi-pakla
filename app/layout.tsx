import type { Metadata, Viewport } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "KRUGOVI PAKLA — interaktivni pad",
  description: "Hrvatski transmedijski web-art projekt o Danteovih devet krugova pakla, krivnji i contrapassu.",
  applicationName: "Krugovi pakla",
  manifest: "/manifest.webmanifest",
  icons: { icon: "/icon.svg" }
};

export const viewport: Viewport = {
  themeColor: "#050505",
  colorScheme: "dark"
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="hr">
      <body>{children}</body>
    </html>
  );
}
