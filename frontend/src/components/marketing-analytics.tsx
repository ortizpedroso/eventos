"use client";

import Script from "next/script";

import { usePlatformSettings } from "@/components/platform-settings-provider";
import { setMarketingRuntimeIds, setMarketingVitrineIds } from "@/lib/analytics";

export type MarketingVitrine = { metaPixelId: string | null; gtmId: string | null };

/**
 * Scripts de Meta Pixel e GTM — produção. No site da plataforma: IDs do admin ou `.env`.
 * Na vitrine do organizador (`vitrine` presente): só os IDs dele.
 */
export function MarketingAnalytics({ vitrine }: { vitrine?: MarketingVitrine }) {
  const settings = usePlatformSettings();
  const pixelId = vitrine
    ? vitrine.metaPixelId?.trim() || ""
    : settings.meta_pixel_id?.trim() || process.env.NEXT_PUBLIC_META_PIXEL_ID?.trim() || "";
  const gtmId = vitrine
    ? vitrine.gtmId?.trim() || ""
    : settings.gtm_id?.trim() || process.env.NEXT_PUBLIC_GTM_ID?.trim() || "";

  if (typeof window !== "undefined") {
    if (vitrine) setMarketingVitrineIds(pixelId, gtmId);
    else setMarketingRuntimeIds(settings.meta_pixel_id, settings.gtm_id);
  }

  if (process.env.NODE_ENV !== "production") return null;
  if (!pixelId && !gtmId) return null;

  return (
    <>
      {gtmId ? (
        <>
          <Script id="gtm-init" strategy="afterInteractive">
            {`(function(w,d,s,l,i){w[l]=w[l]||[];w[l].push({'gtm.start':
new Date().getTime(),event:'gtm.js'});var f=d.getElementsByTagName(s)[0],
j=d.createElement(s),dl=l!='dataLayer'?'&l='+l:'';j.async=true;j.src=
'https://www.googletagmanager.com/gtm.js?id='+i+dl;f.parentNode.insertBefore(j,f);
})(window,document,'script','dataLayer','${gtmId}');`}
          </Script>
          <noscript>
            <iframe
              title="Google Tag Manager"
              src={`https://www.googletagmanager.com/ns.html?id=${gtmId}`}
              height="0"
              width="0"
              style={{ display: "none", visibility: "hidden" }}
            />
          </noscript>
        </>
      ) : null}
      {pixelId ? (
        <>
          <Script id="meta-pixel" strategy="afterInteractive">
            {`!function(f,b,e,v,n,t,s)
{if(f.fbq)return;n=f.fbq=function(){n.callMethod?
n.callMethod.apply(n,arguments):n.queue.push(arguments)};
if(!f._fbq)f._fbq=n;n.push=n;n.loaded=!0;n.version='2.0';
n.queue=[];t=b.createElement(e);t.async=!0;
t.src=v;s=b.getElementsByTagName(e)[0];
s.parentNode.insertBefore(t,s)}(window, document,'script',
'https://connect.facebook.net/en_US/fbevents.js');
fbq('init', '${pixelId}');
fbq('track', 'PageView');`}
          </Script>
          <noscript>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              alt=""
              height="1"
              width="1"
              style={{ display: "none" }}
              src={`https://www.facebook.com/tr?id=${pixelId}&ev=PageView&noscript=1`}
            />
          </noscript>
        </>
      ) : null}
      {gtmId && !pixelId ? (
        <Script id="data-layer-init" strategy="afterInteractive">
          {"window.dataLayer = window.dataLayer || [];"}
        </Script>
      ) : null}
    </>
  );
}
