/** Disparado após login/logout na mesma aba (o evento `storage` do browser só cruza abas). */
export const AUTH_SYNC_EVENT = "eventosbr-auth-sync";

export function dispatchAuthSync(): void {
  if (typeof window !== "undefined") {
    window.dispatchEvent(new Event(AUTH_SYNC_EVENT));
  }
}
