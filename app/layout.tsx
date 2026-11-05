import type { Metadata } from "next";
import { AppShell } from "@/components/layout/AppShell";
import { SiteFooter } from "@/components/SiteFooter";
import "./globals.css";

export const metadata: Metadata = {
  title: "FPL Lab — Precision Analytics",
  description:
    "Local Fantasy Premier League analysis with Opta-style Precision Analytics tables and weekly delta ingestion",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link
          rel="preconnect"
          href="https://fonts.gstatic.com"
          crossOrigin="anonymous"
        />
        <link
          href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800&family=JetBrains+Mono:wght@400;500;700&display=swap"
          rel="stylesheet"
        />
      </head>
      <body className="flex min-h-screen flex-col antialiased">
        <AppShell>
          <div className="flex min-h-[calc(100vh-3.5rem)] flex-col">
            <div className="flex-1">{children}</div>
            <SiteFooter />
          </div>
        </AppShell>
      </body>
    </html>
  );
}
