import { headers } from "next/headers";
import { GeistMono } from "geist/font/mono";
import { GeistSans } from "geist/font/sans";

import { BuildMarker } from "@/components/build-marker";
import { EarlyScrollReset } from "@/components/early-scroll-reset";
import { Navbar } from "@/components/navbar";
import { PlatformSettingsProvider } from "@/components/platform-settings-provider";
import { PlatformTheme } from "@/components/platform-theme";
import { ScrollToTop } from "@/components/scroll-to-top";
import { SiteFooter } from "@/components/site-footer";
import { SkipToContent } from "@/components/skip-to-content";
import { fetchPlatformSettings } from "@/lib/platform-settings";
import { buildMetadata } from "@/lib/site-metadata";
import "./globals.css";

export async function generateMetadata() {
  const platform = await fetchPlatformSettings();
  return buildMetadata(platform);
}

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const nonce = (await headers()).get("x-nonce") ?? undefined;
  const platform = await fetchPlatformSettings();

  return (
    <html
      lang="pt-BR"
      className={`${GeistSans.variable} ${GeistMono.variable} h-full antialiased`}
      suppressHydrationWarning
    >
      <head>
        <EarlyScrollReset nonce={nonce} />
        {platform.favicon_url ? <link rel="icon" href={platform.favicon_url} /> : null}
      </head>
      <body
        className="grid min-h-dvh grid-rows-[auto_1fr_auto] antialiased"
        suppressHydrationWarning
        nonce={nonce}
      >
        <PlatformTheme settings={platform} />
        <PlatformSettingsProvider settings={platform}>
          <SkipToContent />
          <BuildMarker />
          <ScrollToTop />
          <Navbar />
          <main
            id="conteudo-principal"
            className="mx-auto flex min-h-0 w-full flex-col px-4 py-6 sm:px-6 lg:px-8 max-w-7xl"
          >
            <div className="flex flex-1 flex-col">{children}</div>
          </main>

          <SiteFooter />
        </PlatformSettingsProvider>
      </body>
    </html>
  );
}
