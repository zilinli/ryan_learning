/**
 * Cross-tab / in-app nudge so My Creations refreshes after Stage saves.
 * Library also polls the server; this makes same-tab updates instant.
 */

export const CREATIONS_CHANGED_EVENT = "spark:creations-changed";
const CHANNEL = "spark-creations";

export function notifyCreationsChanged(accountId?: string): void {
  if (typeof window === "undefined") return;
  const detail = { accountId: accountId || null, at: Date.now() };
  try {
    window.dispatchEvent(
      new CustomEvent(CREATIONS_CHANGED_EVENT, { detail }),
    );
  } catch {
    /* ignore */
  }
  try {
    const bc = new BroadcastChannel(CHANNEL);
    bc.postMessage(detail);
    bc.close();
  } catch {
    /* BroadcastChannel unsupported */
  }
}

export function subscribeCreationsChanged(
  handler: (accountId: string | null) => void,
): () => void {
  if (typeof window === "undefined") return () => {};

  const onCustom = (ev: Event) => {
    const detail = (ev as CustomEvent<{ accountId?: string | null }>).detail;
    handler(detail?.accountId ?? null);
  };
  window.addEventListener(CREATIONS_CHANGED_EVENT, onCustom);

  let bc: BroadcastChannel | null = null;
  try {
    bc = new BroadcastChannel(CHANNEL);
    bc.onmessage = (ev) => {
      const data = ev.data as { accountId?: string | null } | null;
      handler(data?.accountId ?? null);
    };
  } catch {
    bc = null;
  }

  return () => {
    window.removeEventListener(CREATIONS_CHANGED_EVENT, onCustom);
    try {
      bc?.close();
    } catch {
      /* ignore */
    }
  };
}
