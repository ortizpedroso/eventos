/**
 * Meta Pixel + Google Tag Manager — IDs do painel admin (prioridade) ou build (.env).
 * Eventos padronizados para campanhas Facebook/Instagram Ads.
 */

export type AnalyticsEventName =
  | "ViewContent"
  | "Lead"
  | "CompleteRegistration"
  | "InitiateCheckout"
  | "Purchase";

export type AnalyticsEventPayload = {
  content_name?: string;
  content_ids?: string[];
  content_type?: string;
  value?: number;
  currency?: string;
  event_id?: string;
};

declare global {
  interface Window {
    dataLayer?: Record<string, unknown>[];
    fbq?: (
      action: "track" | "trackCustom",
      eventName: string,
      params?: Record<string, unknown>,
    ) => void;
    gtag?: (command: "event", eventName: string, params?: Record<string, unknown>) => void;
  }
}

const ENV_META_PIXEL_ID = process.env.NEXT_PUBLIC_META_PIXEL_ID?.trim() ?? "";
const ENV_GTM_ID = process.env.NEXT_PUBLIC_GTM_ID?.trim() ?? "";

let runtimeMetaPixelId: string | null = null;
let runtimeGtmId: string | null = null;
let idsDaVitrine = false;
let googleDaVitrine = false;
let googleAdsSendTo: string | null = null;

export const FORMATO_ID = {
  metaPixel: /^\d{5,20}$/,
  gtm: /^GTM-[A-Z0-9]+$/,
  ga4: /^G-[A-Z0-9]{4,20}$/,
  googleAds: /^AW-\d{6,15}$/,
  googleAdsLabel: /^[A-Za-z0-9_-]{4,40}$/,
} as const;

/** Só deixa passar um ID no formato esperado: o valor vai dentro de um script. */
export function idSeguro(valor: string | null | undefined, formato: RegExp): string {
  const v = valor?.trim() ?? "";
  return formato.test(v) ? v : "";
}

/** Sincroniza IDs vindos de `/api/public/platform` (admin). */
export function setMarketingRuntimeIds(
  metaPixelId: string | null | undefined,
  gtmId: string | null | undefined,
) {
  runtimeMetaPixelId = metaPixelId?.trim() || null;
  runtimeGtmId = gtmId?.trim() || null;
  idsDaVitrine = false;
  googleDaVitrine = false;
  googleAdsSendTo = null;
}

/** Na vitrine valem só as tags do organizador: sem elas, nenhuma tag (nem as da plataforma). */
export function setMarketingVitrineIds(ids: {
  metaPixelId: string;
  ga4Id: string;
  googleAdsId: string;
  googleAdsLabel: string;
}) {
  runtimeMetaPixelId = ids.metaPixelId || null;
  runtimeGtmId = null;
  idsDaVitrine = true;
  googleDaVitrine = Boolean(ids.ga4Id || ids.googleAdsId);
  googleAdsSendTo = ids.googleAdsId && ids.googleAdsLabel ? `${ids.googleAdsId}/${ids.googleAdsLabel}` : null;
}

export function getMetaPixelId(): string {
  return runtimeMetaPixelId || (idsDaVitrine ? "" : ENV_META_PIXEL_ID);
}

export function getGtmId(): string {
  return runtimeGtmId || (idsDaVitrine ? "" : ENV_GTM_ID);
}

export function metaPixelIdConfigurado(): boolean {
  return Boolean(getMetaPixelId());
}

export function gtmIdConfigurado(): boolean {
  return Boolean(getGtmId());
}

export function analyticsHabilitado(): boolean {
  return process.env.NODE_ENV === "production" && (metaPixelIdConfigurado() || gtmIdConfigurado() || googleDaVitrine);
}

/** Dispara evento nos dois canais quando configurados (client-only). */
export function trackAnalyticsEvent(name: AnalyticsEventName, payload: AnalyticsEventPayload = {}) {
  if (typeof window === "undefined" || !analyticsHabilitado()) return;

  const base = {
    event: name,
    ...payload,
  };

  if (window.dataLayer && !idsDaVitrine) {
    window.dataLayer.push(base);
  }

  if (googleDaVitrine && window.gtag) {
    enviarParaGoogle(window.gtag, name, payload);
  }

  if (window.fbq) {
    const { value, currency, content_name, content_ids, content_type } = payload;
    const fbParams: Record<string, unknown> = {};
    if (content_name) fbParams.content_name = content_name;
    if (content_ids) fbParams.content_ids = content_ids;
    if (content_type) fbParams.content_type = content_type;
    if (value != null) fbParams.value = value;
    if (currency) fbParams.currency = currency;
    window.fbq("track", name, fbParams);
  }
}

const EVENTO_GOOGLE: Record<AnalyticsEventName, string> = {
  ViewContent: "view_item",
  Lead: "generate_lead",
  CompleteRegistration: "sign_up",
  InitiateCheckout: "begin_checkout",
  Purchase: "purchase",
};

function enviarParaGoogle(
  gtag: NonNullable<Window["gtag"]>,
  name: AnalyticsEventName,
  payload: AnalyticsEventPayload,
) {
  const { value, currency, content_name, content_ids, event_id } = payload;
  const params: Record<string, unknown> = {};
  if (value != null) params.value = value;
  if (currency) params.currency = currency;
  if (event_id) params.transaction_id = event_id;
  if (content_ids?.length || content_name) {
    params.items = [{ item_id: content_ids?.[0], item_name: content_name }];
  }
  gtag("event", EVENTO_GOOGLE[name], params);
  if (name === "Purchase" && googleAdsSendTo) {
    gtag("event", "conversion", {
      send_to: googleAdsSendTo,
      ...(value != null ? { value } : {}),
      ...(currency ? { currency } : {}),
      ...(event_id ? { transaction_id: event_id } : {}),
    });
  }
}
