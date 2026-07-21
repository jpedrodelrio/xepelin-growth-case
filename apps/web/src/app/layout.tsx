import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Growth Batch OS",
  description: "Pipeline de outbound con AI-enrichment",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return <html lang="es"><body>{children}</body></html>;
}
