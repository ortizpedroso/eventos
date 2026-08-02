"use client";

import { useEffect, useId, useRef, type RefObject } from "react";

const SCRIPT_ID = "cf-turnstile-script";
const SCRIPT_SRC = "https://challenges.cloudflare.com/turnstile/v0/api.js";
const DEFAULT_ACTION = "turnstile-spin-v2";

const SITE_KEY = process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY?.trim() ?? "";

declare global {
  interface Window {
    turnstile?: {
      render: (
        container: string | HTMLElement,
        options: {
          sitekey: string;
          action?: string;
          callback: (token: string) => void;
          "expired-callback"?: () => void;
          "error-callback"?: () => void;
          theme?: "light" | "dark" | "auto";
        },
      ) => string;
      reset: (widgetId?: string) => void;
      remove: (widgetId?: string) => void;
    };
  }
}

function loadScript(): Promise<void> {
  return new Promise((resolve, reject) => {
    if (window.turnstile) {
      resolve();
      return;
    }
    if (document.getElementById(SCRIPT_ID)) {
      const check = setInterval(() => {
        if (window.turnstile) {
          clearInterval(check);
          resolve();
        }
      }, 100);
      return;
    }
    const el = document.createElement("script");
    el.id = SCRIPT_ID;
    el.src = SCRIPT_SRC;
    el.async = true;
    el.defer = true;
    el.onload = () => resolve();
    el.onerror = () => reject(new Error("Falha ao carregar o Turnstile"));
    document.head.appendChild(el);
  });
}

export function turnstileSiteKeyConfigurada(): boolean {
  return Boolean(SITE_KEY);
}

type TurnstileWidgetProps = {
  onToken: (token: string | null) => void;
  /** Ref opcional para reset após erro de submit (token Turnstile é single-use). */
  resetRef?: RefObject<(() => void) | null>;
  action?: string;
};

/**
 * Widget anti-bot (Cloudflare Turnstile).
 * Não renderiza nada se NEXT_PUBLIC_TURNSTILE_SITE_KEY não estiver definida no build.
 */
export function TurnstileWidget({ onToken, resetRef, action = DEFAULT_ACTION }: TurnstileWidgetProps) {
  const containerId = `turnstile-${useId().replace(/[^a-zA-Z0-9]/g, "")}`;
  const widgetIdRef = useRef<string | null>(null);

  useEffect(() => {
    if (!SITE_KEY) return;
    let cancelado = false;

    const bindReset = () => {
      if (!resetRef) return;
      resetRef.current = () => {
        if (widgetIdRef.current && window.turnstile) {
          window.turnstile.reset(widgetIdRef.current);
        }
        onToken(null);
      };
    };

    loadScript()
      .then(() => {
        if (cancelado || !window.turnstile) return;
        const el = document.getElementById(containerId);
        if (!el) return;
        widgetIdRef.current = window.turnstile.render(el, {
          sitekey: SITE_KEY,
          action,
          theme: "light",
          callback: (token) => onToken(token),
          "expired-callback": () => onToken(null),
          "error-callback": () => onToken(null),
        });
        bindReset();
      })
      .catch(() => onToken(null));

    return () => {
      cancelado = true;
      if (resetRef) resetRef.current = null;
      if (widgetIdRef.current && window.turnstile) {
        window.turnstile.remove(widgetIdRef.current);
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [containerId, action]);

  if (!SITE_KEY) return null;

  return (
    <div
      id={containerId}
      className="cf-turnstile mt-1"
      data-sitekey={SITE_KEY}
      data-action={action}
    />
  );
}
