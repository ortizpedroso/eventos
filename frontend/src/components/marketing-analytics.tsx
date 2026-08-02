"use client";

import Script from "next/script";

import { getGtmId, getMetaPixelId, gtmIdConfigurado, metaPixelIdConfigurado } from "@/lib/analytics";

/**
 * Scripts de Meta Pixel e GTM — apenas em produção com env configurada.
 * Montado no root layout; não bloqueia renderização da página.
 */
export function MarketingAnalytics() {
  if (process.env.NODE_ENV !== "production") return null;

  const pixelId = getMetaPixelId();
  const gtmId = getGtmId();
  if (!pixelId && !gtmId) return null;

  return (
    <>
      {gtmIdConfigurado() ? (
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
      {metaPixelIdConfigurado() ? (
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
      {gtmIdConfigurado() && !metaPixelIdConfigurado() ? (
        <Script id="data-layer-init" strategy="afterInteractive">
          {"window.dataLayer = window.dataLayer || [];"}
        </Script>
      ) : null}
    </>
  );
}
