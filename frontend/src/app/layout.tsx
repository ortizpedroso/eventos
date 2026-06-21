import type { Metadata } from "next";
import { headers } from "next/headers";
import { Suspense } from "react";
import { GeistMono } from "geist/font/mono";
import { GeistSans } from "geist/font/sans";

import { BuildMarker } from "@/components/build-marker";
import { Navbar } from "@/components/navbar";
import { ScrollToTop } from "@/components/scroll-to-top";
import { SiteFooter } from "@/components/site-footer";
import "./globals.css";

export const metadata: Metadata = {
  title: "EventosBR",
  description: "Plataforma de eventos com reembolsos automáticos",
};

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const nonce = (await headers()).get("x-nonce") ?? undefined;

  return (
    <html
      lang="pt-BR"
      className={`${GeistSans.variable} ${GeistMono.variable} h-full antialiased`}
      suppressHydrationWarning
    >
      <body className="min-h-full flex flex-col" suppressHydrationWarning nonce={nonce}>
        <BuildMarker />
        <Suspense fallback={null}>
          <ScrollToTop />
        </Suspense>
        <Navbar />
        <main className="mx-auto w-full min-h-[50vh] max-w-7xl flex-1 px-4 py-6 sm:px-6 lg:px-8">
          {children}
        </main>

        <SiteFooter />
      </body>
    </html>
  );
}
