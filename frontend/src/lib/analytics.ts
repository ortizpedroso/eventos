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
  }
}

const ENV_META_PIXEL_ID = process.env.NEXT_PUBLIC_META_PIXEL_ID?.trim() ?? "";
const ENV_GTM_ID = process.env.NEXT_PUBLIC_GTM_ID?.trim() ?? "";

let runtimeMetaPixelId: string | null = null;
let runtimeGtmId: string | null = null;

/** Sincroniza IDs vindos de `/api/public/platform` (admin). */
export function setMarketingRuntimeIds(
  metaPixelId: string | null | undefined,
  gtmId: string | null | undefined,
) {
  runtimeMetaPixelId = metaPixelId?.trim() || null;
  runtimeGtmId = gtmId?.trim() || null;
}

export function getMetaPixelId(): string {
  return runtimeMetaPixelId || ENV_META_PIXEL_ID;
}

export function getGtmId(): string {
  return runtimeGtmId || ENV_GTM_ID;
}

export function metaPixelIdConfigurado(): boolean {
  return Boolean(getMetaPixelId());
}

export function gtmIdConfigurado(): boolean {
  return Boolean(getGtmId());
}

export function analyticsHabilitado(): boolean {
  return process.env.NODE_ENV === "production" && (metaPixelIdConfigurado() || gtmIdConfigurado());
}

/** Dispara evento nos dois canais quando configurados (client-only). */
export function trackAnalyticsEvent(name: AnalyticsEventName, payload: AnalyticsEventPayload = {}) {
  if (typeof window === "undefined" || !analyticsHabilitado()) return;

  const base = {
    event: name,
    ...payload,
  };

  if (window.dataLayer) {
    window.dataLayer.push(base);
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
