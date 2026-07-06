import { GeistMono } from "geist/font/mono";
import { GeistSans } from "geist/font/sans";

import { Navbar } from "@/components/navbar";
import { SiteFooter } from "@/components/site-footer";
import { SkipToContent } from "@/components/skip-to-content";
import { defaultMetadata } from "@/lib/site-metadata";
import "./globals.css";

export const metadata = defaultMetadata;

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="pt-BR"
      className={`${GeistSans.variable} ${GeistMono.variable} h-full antialiased scroll-smooth`}
      suppressHydrationWarning
    >
      <body className="min-h-full flex flex-col" suppressHydrationWarning>
        <SkipToContent />
        <Navbar />
        <main
          id="conteudo-principal"
          className="mx-auto w-full max-w-7xl flex-1 px-4 py-6 sm:px-6 lg:px-8"
        >
          {children}
        </main>

        <SiteFooter />
      </body>
    </html>
  );
}
