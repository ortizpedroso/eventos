import { headers } from "next/headers";
import { GeistMono } from "geist/font/mono";
import { GeistSans } from "geist/font/sans";

import { BuildMarker } from "@/components/build-marker";
import { EarlyScrollReset } from "@/components/early-scroll-reset";
import { Navbar } from "@/components/navbar";
import { ScrollToTop } from "@/components/scroll-to-top";
import { SiteFooter } from "@/components/site-footer";
import { SkipToContent } from "@/components/skip-to-content";
import { defaultMetadata } from "@/lib/site-metadata";
import "./globals.css";

export const metadata = defaultMetadata;

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
      <head>
        <EarlyScrollReset nonce={nonce} />
      </head>
      <body
        className="flex min-h-dvh flex-col antialiased"
        style={{
          display: "flex",
          flexDirection: "column",
          minHeight: "100dvh",
        }}
        suppressHydrationWarning
        nonce={nonce}
      >
        <SkipToContent />
        <BuildMarker />
        <ScrollToTop />
        <Navbar />
        <main
          id="conteudo-principal"
          className="mx-auto flex w-full min-h-0 flex-1 flex-col px-4 py-6 sm:px-6 lg:px-8 max-w-7xl"
          style={{ flex: "1 1 auto", minHeight: 0 }}
        >
          <div className="flex min-h-[60vh] flex-1 flex-col">{children}</div>
        </main>

        <SiteFooter />
      </body>
    </html>
  );
}
