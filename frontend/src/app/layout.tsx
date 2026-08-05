import { headers } from "next/headers";
import { GeistMono } from "geist/font/mono";
import { GeistSans } from "geist/font/sans";
import type { CSSProperties } from "react";

import { BackToTopButton } from "@/components/back-to-top-button";
import { BuildMarker } from "@/components/build-marker";
import { EarlyScrollReset } from "@/components/early-scroll-reset";
import { MarketingAnalytics } from "@/components/marketing-analytics";
import { Navbar } from "@/components/navbar";
import { PlatformSettingsProvider } from "@/components/platform-settings-provider";
import { PlatformThemeLive } from "@/components/platform-theme-live";
import { ScrollRevealObserver } from "@/components/scroll-reveal-observer";
import { ScrollToTop } from "@/components/scroll-to-top";
import { SiteFooter } from "@/components/site-footer";
import { SkipToContent } from "@/components/skip-to-content";
import { brandCssProperties, buildBrandRootCss } from "@/lib/brand-css-style";
import { fetchPlatformSettings } from "@/lib/platform-settings";
import { buildOrganizationJsonLd } from "@/lib/organization-json-ld";
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
  const brandStyle = brandCssProperties(
    platform.primary_color,
    platform.primary_color_dark,
  ) as CSSProperties;
  const brandCss = buildBrandRootCss(platform.primary_color, platform.primary_color_dark);

  return (
    <html
      lang="pt-BR"
      className={`${GeistSans.variable} ${GeistMono.variable} h-full antialiased`}
      style={brandStyle}
      suppressHydrationWarning
    >
      <head>
        {nonce ? <meta name="csp-nonce" content={nonce} /> : null}
        <EarlyScrollReset nonce={nonce} />
        {/* Escala de marca no <head> (SSR) — não depende só do cliente */}
        <style
          id="eventosbr-platform-theme-ssr"
          nonce={nonce}
          dangerouslySetInnerHTML={{ __html: brandCss }}
        />
        {platform.favicon_url ? <link rel="icon" href={platform.favicon_url} /> : null}
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{
            __html: buildOrganizationJsonLd(platform.site_name || "EventosBR"),
          }}
        />
      </head>
      <body
        className="grid min-h-dvh grid-rows-[auto_1fr_auto] antialiased"
        suppressHydrationWarning
        nonce={nonce}
      >
        <PlatformSettingsProvider settings={platform}>
          <PlatformThemeLive />
          <MarketingAnalytics />
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
          <BackToTopButton />
          <ScrollRevealObserver />
        </PlatformSettingsProvider>
      </body>
    </html>
  );
}
