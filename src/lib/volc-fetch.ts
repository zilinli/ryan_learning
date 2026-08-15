/**
 * Outbound fetch for Volc GenSong — optional China egress bypass.
 *
 * Why: US public IP (e.g. 65.49.201.123) triggers GenSong ServerIpLimit geo gate.
 * Free public proxy lists are unsuitable (steal AK/SK, unstable, often non-CN egress).
 *
 * Supported:
 * 1) VOLC_MUSIC_HTTPS_PROXY / HTTPS_PROXY — HTTP CONNECT proxy with CN egress
 * 2) VOLC_MUSIC_RELAY_URL — POST forwarder on a China VPS (see scripts/volc-cn-relay.mjs)
 */

import { ProxyAgent, fetch as undiciFetch } from "undici";

const VOLC_HOST = "open.volcengineapi.com";

export function volcHttpsProxyUrl(): string | null {
  return (
    process.env.VOLC_MUSIC_HTTPS_PROXY?.trim() ||
    process.env.HTTPS_PROXY?.trim() ||
    process.env.https_proxy?.trim() ||
    null
  );
}

export function volcRelayUrl(): string | null {
  return process.env.VOLC_MUSIC_RELAY_URL?.trim() || null;
}

export function volcEgressHint(): string {
  const parts: string[] = [];
  if (volcRelayUrl()) parts.push("relay");
  if (volcHttpsProxyUrl()) parts.push("https-proxy");
  return parts.length ? parts.join("+") : "direct";
}

export type VolcFetchInit = {
  method: string;
  headers: Record<string, string>;
  body: string;
  signal?: AbortSignal;
};

/**
 * Fetch Volc OpenAPI. Prefer relay (CN VPS) then HTTPS proxy, else direct.
 * Signature Host must remain open.volcengineapi.com — relay re-fetches unchanged.
 */
export async function volcFetch(
  url: string,
  init: VolcFetchInit,
): Promise<Response> {
  const target = new URL(url);
  if (target.hostname !== VOLC_HOST) {
    throw new Error(`Refusing Volc fetch to unexpected host: ${target.hostname}`);
  }

  const relay = volcRelayUrl();
  if (relay) {
    return fetchViaRelay(relay, url, init);
  }

  const proxy = volcHttpsProxyUrl();
  if (proxy) {
    const agent = new ProxyAgent(proxy);
    const res = await undiciFetch(url, {
      method: init.method,
      headers: init.headers,
      body: init.body,
      signal: init.signal,
      dispatcher: agent,
    });
    return res as unknown as Response;
  }

  return fetch(url, {
    method: init.method,
    headers: init.headers,
    body: init.body,
    signal: init.signal,
  });
}

async function fetchViaRelay(
  relayBase: string,
  url: string,
  init: VolcFetchInit,
): Promise<Response> {
  const token = process.env.VOLC_MUSIC_RELAY_TOKEN?.trim() || "";
  const endpoint = relayBase.replace(/\/$/, "");
  const res = await fetch(endpoint, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      ...(token ? { "X-Relay-Token": token } : {}),
    },
    body: JSON.stringify({
      url,
      method: init.method || "POST",
      headers: init.headers,
      body: init.body,
    }),
    signal: init.signal,
  });

  const data = (await res.json().catch(() => null)) as {
    ok?: boolean;
    status?: number;
    headers?: Record<string, string>;
    body?: string;
    error?: string;
  } | null;

  if (!res.ok || !data || data.ok === false) {
    const msg =
      data?.error ||
      `Volc CN relay HTTP ${res.status} — check VOLC_MUSIC_RELAY_URL / token`;
    throw new Error(msg);
  }

  const status = typeof data.status === "number" ? data.status : 502;
  const bodyText = typeof data.body === "string" ? data.body : "";
  return new Response(bodyText, {
    status,
    headers: data.headers || { "Content-Type": "application/json" },
  });
}

/** Human-readable ServerIpLimit recovery steps (US egress → CN gate). */
export function serverIpLimitAdvice(): string {
  return [
    "ServerIpLimit: Volc GenSong blocks non-China egress (this host US IP 65.49.201.123).",
    "Workarounds: (1) set VOLC_MUSIC_RELAY_URL to a China VPS running scripts/volc-cn-relay.mjs",
    "(2) or VOLC_MUSIC_HTTPS_PROXY=http://user:pass@cn-proxy:3128",
    "(3) prefer Bailian Fun-Music (ALIYUN_DASHSCOPE_API_KEY) which is CN-region",
    "(4) open Volc ticket to allowlist a China egress IP — public free proxies are unsafe for AK/SK.",
  ].join(" ");
}
