import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Eve — Vercel Agent with Neo4j Agent Memory",
  description:
    "A Vercel AI SDK chat agent named Eve, with persistent cross-session memory powered by Neo4j Agent Memory (NAMS).",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
