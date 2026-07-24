"use client";

import { useSyncExternalStore } from "react";

import {
  readAuthSearchParams,
  type AuthSearchParams,
} from "@/lib/auth-search-params-core";

export type { AuthSearchParams } from "@/lib/auth-search-params-core";
export {
  enrichAuthSearchParams,
  readAuthSearchParams,
  resolveAuthMode,
} from "@/lib/auth-search-params-core";

function subscribeAuthSearchParams(onStoreChange: () => void) {
  window.addEventListener("popstate", onStoreChange);
  return () => window.removeEventListener("popstate", onStoreChange);
}

/** Parâmetros /auth sem hydration mismatch — snapshot SSR alinhado ao cliente. */
export function useAuthSearchParams(serverFallback: AuthSearchParams): AuthSearchParams {
  return useSyncExternalStore(
    subscribeAuthSearchParams,
    () => readAuthSearchParams(),
    () => serverFallback,
  );
}
