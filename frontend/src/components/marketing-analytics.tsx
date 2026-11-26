"use client";

import Script from "next/script";

import { usePlatformSettings } from "@/components/platform-settings-provider";
import { FORMATO_ID, idSeguro, setMarketingRuntimeIds, setMarketingVitrineIds } from "@/lib/analytics";

export type MarketingVitrine = {
  metaPixelId: string | null;
  ga4Id: string | null;
  googleAdsId: string | null;
  googleAdsLabel: string | null;
};

/**
 * Scripts de marketing — só em produção.
 * Site da plataforma: Meta Pixel e GTM do admin (ou `.env`).
 * Vitrine do organizador: só Meta Pixel, GA4 e Google Ads dele, por ID fixo. GTM de organizador
 * não existe porque permitiria código arbitrário na página onde o comprador digita o cartão.
 */
export function MarketingAnalytics({ vitrine }: { vitrine?: MarketingVitrine }) {
  const settings = usePlatformSettings();
  const pixelId = idSeguro(
    vitrine ? vitrine.metaPixelId : settings.meta_pixel_id?.trim() || process.env.NEXT_PUBLIC_META_PIXEL_ID,
    FORMATO_ID.metaPixel,
  );
  const gtmId = vitrine
    ? ""
    : idSeguro(settings.gtm_id?.trim() || process.env.NEXT_PUBLIC_GTM_ID, FORMATO_ID.gtm);
  const ga4Id = vitrine ? idSeguro(vitrine.ga4Id, FORMATO_ID.ga4) : "";
  const googleAdsId = vitrine ? idSeguro(vitrine.googleAdsId, FORMATO_ID.googleAds) : "";
  const googleAdsLabel = googleAdsId ? idSeguro(vitrine?.googleAdsLabel, FORMATO_ID.googleAdsLabel) : "";
  const googleIds = [ga4Id, googleAdsId].filter(Boolean);

  if (typeof window !== "undefined") {
    if (vitrine) setMarketingVitrineIds({ metaPixelId: pixelId, ga4Id, googleAdsId, googleAdsLabel });
    else setMarketingRuntimeIds(settings.meta_pixel_id, settings.gtm_id);
  }

  if (process.env.NODE_ENV !== "production") return null;
  if (!pixelId && !gtmId && googleIds.length === 0) return null;

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
      {googleIds.length > 0 ? (
        <>
          <Script
            id="gtag-loader"
            strategy="afterInteractive"
            src={`https://www.googletagmanager.com/gtag/js?id=${googleIds[0]}`}
          />
          <Script id="gtag-config" strategy="afterInteractive">
            {`window.dataLayer=window.dataLayer||[];function gtag(){dataLayer.push(arguments);}
window.gtag=gtag;gtag('js',new Date());
${googleIds.map((id) => `gtag('config','${id}');`).join("\n")}`}
          </Script>
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
