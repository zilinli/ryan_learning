/**
 * Volcengine AI Music — GenSongV4 (prepaid) + GenSongForTime (postpaid).
 * Docs: https://www.volcengine.com/docs/84992/2091679 (submit)
 *       https://www.volcengine.com/docs/84992/2100960 (QuerySong)
 *
 * Auth: VOLC_ACCESS_KEY_ID + VOLC_SECRET_ACCESS_KEY (OpenAPI AK/SK or API Key ID/Secret).
 */

import { Signer } from "@volcengine/openapi";
import { queryParamsToString } from "@volcengine/openapi/lib/base/sign";

export type VolcMusicBilling = "prepaid" | "postpaid";

export type VolcMusicGender = "Male" | "Female";

export type VolcMusicGenerateInput = {
  lyrics?: string;
  prompt?: string;
  gender?: VolcMusicGender | "male" | "female";
  genre?: string;
  mood?: string;
  durationSec?: number;
  modelVersion?: string;
  lang?: string;
  billing?: VolcMusicBilling;
};

export type VolcMusicGenerateResult = {
  ok: boolean;
  status: "done" | "pending" | "error" | "unconfigured";
  provider: "volc-prepaid" | "volc-postpaid";
  billing?: VolcMusicBilling;
  taskId?: string;
  audioUrl?: string;
  mimeType?: string;
  requestId?: string;
  generatedLyrics?: string;
  durationSec?: number;
  error?: string;
  raw?: unknown;
};

const HOST = "open.volcengineapi.com";
const VERSION = "2024-08-12";

function ak(): string | null {
  // Prefer classic AccessKey (AKLT…); API Key ID is a different product token.
  return (
    process.env.VOLC_ACCESS_KEY_ID?.trim() ||
    process.env.VOLC_ACCESS_KEY_ID_AKLT?.trim() ||
    process.env.VOLCENGINE_ACCESS_KEY_ID?.trim() ||
    null
  );
}

function sk(): string | null {
  return (
    process.env.VOLC_SECRET_ACCESS_KEY?.trim() ||
    process.env.VOLC_SECRET_ACCESS_KEY_AKLT?.trim() ||
    process.env.VOLCENGINE_SECRET_ACCESS_KEY?.trim() ||
    null
  );
}

function pushCred(
  out: Array<{ accessKeyId: string; secretKey: string; label: string }>,
  accessKeyId: string | null | undefined,
  secretKey: string | null | undefined,
  label: string,
) {
  if (!accessKeyId || !secretKey) return;
  out.push({ accessKeyId, secretKey, label });
  // Console often shows SecretAccessKey as base64 — try decoded form too.
  try {
    const decoded = Buffer.from(secretKey, "base64").toString("utf8");
    if (
      decoded &&
      decoded !== secretKey &&
      decoded.length >= 16 &&
      /^[\x20-\x7E]+$/.test(decoded)
    ) {
      out.push({ accessKeyId, secretKey: decoded, label: `${label}-b64dec` });
    }
  } catch {
    /* ignore */
  }
}

/** Credential candidates — AccessKey first (raw + base64-decoded SK). */
function credentialCandidates(): Array<{
  accessKeyId: string;
  secretKey: string;
  label: string;
}> {
  const out: Array<{ accessKeyId: string; secretKey: string; label: string }> =
    [];
  pushCred(out, ak(), sk(), "access-key");
  pushCred(
    out,
    process.env.VOLC_ACCESS_KEY_ID_AKLT?.trim(),
    process.env.VOLC_SECRET_ACCESS_KEY_AKLT?.trim(),
    "aklt",
  );
  const seen = new Set<string>();
  return out.filter((c) => {
    const k = `${c.accessKeyId}|${c.secretKey}`;
    if (seen.has(k)) return false;
    seen.add(k);
    return true;
  });
}

function region(): string {
  return process.env.VOLC_MUSIC_REGION?.trim() || "cn-beijing";
}

function service(): string {
  return process.env.VOLC_MUSIC_SERVICE?.trim() || "imagination";
}

export function isVolcMusicConfigured(): boolean {
  return credentialCandidates().length > 0;
}

export function volcBillingOrder(): VolcMusicBilling[] {
  const raw =
    process.env.VOLC_MUSIC_BILLING_ORDER?.trim() || "prepaid,postpaid";
  const parts = raw
    .split(/[,|]/)
    .map((s) => s.trim().toLowerCase())
    .filter(Boolean);
  const out: VolcMusicBilling[] = [];
  for (const p of parts) {
    if (p === "prepaid" || p === "gensongv4") out.push("prepaid");
    else if (p === "postpaid" || p === "gensongfortime" || p === "fortime") {
      out.push("postpaid");
    }
  }
  return out.length ? [...new Set(out)] : ["prepaid", "postpaid"];
}

function actionFor(billing: VolcMusicBilling): string {
  return billing === "prepaid" ? "GenSongV4" : "GenSongForTime";
}

function providerFor(
  billing: VolcMusicBilling,
): "volc-prepaid" | "volc-postpaid" {
  return billing === "prepaid" ? "volc-prepaid" : "volc-postpaid";
}

export function clampVolcLyrics(lyrics: string): string {
  const t = lyrics.trim();
  const cjk = (t.match(/[\u4e00-\u9fff]/g) || []).length;
  const max = cjk / Math.max(t.length, 1) > 0.3 ? 700 : 2000;
  return t.length <= max ? t : t.slice(0, max);
}

export function clampVolcPrompt(prompt: string): string {
  return prompt.trim().slice(0, 700);
}

function mapGender(
  g?: VolcMusicGender | "male" | "female",
): "Male" | "Female" | undefined {
  if (!g) return undefined;
  const s = String(g).toLowerCase();
  if (s === "male") return "Male";
  if (s === "female") return "Female";
  if (g === "Male" || g === "Female") return g;
  return undefined;
}

function isRetryableAuthError(msg: string): boolean {
  return /signature|Secret Access Key|signing method|security token|InvalidAccessKey|Invalid.*[Tt]oken|Unauthorized|not match/i.test(
    msg,
  );
}

async function volcPostOnce(
  action: string,
  bodyObj: Record<string, unknown>,
  creds: { accessKeyId: string; secretKey: string },
): Promise<{
  ok: boolean;
  httpStatus: number;
  data: Record<string, unknown>;
  error?: string;
}> {
  const body = JSON.stringify(bodyObj);
  const params = { Action: action, Version: VERSION };
  const requestObj = {
    region: region(),
    method: "POST",
    params,
    pathname: "/",
    headers: {
      Host: HOST,
      "Content-Type": "application/json",
    },
    body,
  };
  const signer = new Signer(requestObj, service());
  signer.addAuthorization({
    accessKeyId: creds.accessKeyId,
    secretKey: creds.secretKey,
  });

  const qs = queryParamsToString(params);
  const url = `https://${HOST}/?${qs}`;
  try {
    const res = await fetch(url, {
      method: "POST",
      headers: requestObj.headers as Record<string, string>,
      body,
      signal: AbortSignal.timeout(60_000),
    });
    const data = (await res.json().catch(() => ({}))) as Record<
      string,
      unknown
    >;
    const meta = (data.ResponseMetadata || {}) as Record<string, unknown>;
    const errObj = meta.Error as { Message?: string; Code?: string } | null;
    if (!res.ok || errObj) {
      const rawMsg = String(
        errObj?.Message ||
          errObj?.Code ||
          data.Message ||
          `Volc HTTP ${res.status}`,
      );
      let error = rawMsg;
      if (/ServerIpLimit/i.test(rawMsg)) {
        error =
          "ServerIpLimit: add this host's public IP to Volcengine AI Music IP allowlist (控制台 → 音视频理解与处理 / AI音乐 → IP 白名单), then retry.";
      }
      return {
        ok: false,
        httpStatus: res.status,
        data,
        error,
      };
    }
    return { ok: true, httpStatus: res.status, data };
  } catch (err) {
    return {
      ok: false,
      httpStatus: 0,
      data: {},
      error: err instanceof Error ? err.message : "Volc request failed",
    };
  }
}

async function volcPost(
  action: string,
  bodyObj: Record<string, unknown>,
): Promise<{
  ok: boolean;
  httpStatus: number;
  data: Record<string, unknown>;
  error?: string;
}> {
  const candidates = credentialCandidates();
  if (!candidates.length) {
    return {
      ok: false,
      httpStatus: 0,
      data: {},
      error: "VOLC_ACCESS_KEY_ID / VOLC_SECRET_ACCESS_KEY not set",
    };
  }

  let last = await volcPostOnce(action, bodyObj, candidates[0]!);
  if (last.ok) return last;

  for (let i = 1; i < candidates.length; i++) {
    if (!isRetryableAuthError(String(last.error || ""))) break;
    last = await volcPostOnce(action, bodyObj, candidates[i]!);
    if (last.ok) return last;
  }
  return last;
}

export async function volcSubmitSong(
  input: VolcMusicGenerateInput,
  billing: VolcMusicBilling,
): Promise<VolcMusicGenerateResult> {
  const provider = providerFor(billing);
  if (!isVolcMusicConfigured()) {
    return {
      ok: false,
      status: "unconfigured",
      provider,
      billing,
      error: "Volcengine AK/SK not configured",
    };
  }

  const lyrics = input.lyrics ? clampVolcLyrics(input.lyrics) : "";
  const prompt = input.prompt ? clampVolcPrompt(input.prompt) : "";
  if (!lyrics && !prompt) {
    return {
      ok: false,
      status: "error",
      provider,
      billing,
      error: "Provide lyrics or prompt",
    };
  }

  const body: Record<string, unknown> = {
    ModelVersion:
      input.modelVersion || process.env.VOLC_MUSIC_MODEL?.trim() || "v4.3",
    VodFormat: "mp3",
    SkipCopyCheck: true,
  };
  if (lyrics) body.Lyrics = lyrics;
  else body.Prompt = prompt;
  const gender = mapGender(input.gender);
  if (gender) body.Gender = gender;
  if (input.genre) body.Genre = input.genre;
  if (input.mood) body.Mood = input.mood;
  if (input.lang) body.Lang = input.lang;
  const dur = input.durationSec;
  if (typeof dur === "number" && dur >= 30 && dur <= 240) {
    body.Duration = Math.round(dur);
  }

  const action = actionFor(billing);
  const submitted = await volcPost(action, body);
  if (!submitted.ok) {
    return {
      ok: false,
      status: "error",
      provider,
      billing,
      error: submitted.error,
      raw: submitted.data,
    };
  }

  const result = (submitted.data.Result || {}) as Record<string, unknown>;
  const taskId = String(result.TaskID || "");
  const meta = (submitted.data.ResponseMetadata || {}) as Record<
    string,
    unknown
  >;
  if (!taskId) {
    return {
      ok: false,
      status: "error",
      provider,
      billing,
      error: "Volc response missing TaskID",
      requestId: meta.RequestId ? String(meta.RequestId) : undefined,
      raw: submitted.data,
    };
  }

  return {
    ok: true,
    status: "pending",
    provider,
    billing,
    taskId,
    requestId: meta.RequestId ? String(meta.RequestId) : undefined,
    raw: submitted.data,
  };
}

export async function volcQuerySong(
  taskId: string,
  billing: VolcMusicBilling,
): Promise<VolcMusicGenerateResult> {
  const provider = providerFor(billing);
  const q = await volcPost("QuerySong", { TaskID: taskId });
  if (!q.ok) {
    return {
      ok: false,
      status: "error",
      provider,
      billing,
      taskId,
      error: q.error,
      raw: q.data,
    };
  }

  const result = (q.data.Result || {}) as Record<string, unknown>;
  const statusNum = Number(result.Status);
  const detail = (result.SongDetail || {}) as Record<string, unknown>;
  const fail = result.FailureReason as { Msg?: string; Code?: number } | null;
  const meta = (q.data.ResponseMetadata || {}) as Record<string, unknown>;

  // 0 waiting, 1 processing, 2 success, 3 failed
  if (statusNum === 2 && detail.AudioUrl) {
    return {
      ok: true,
      status: "done",
      provider,
      billing,
      taskId,
      audioUrl: String(detail.AudioUrl),
      mimeType: "audio/mpeg",
      generatedLyrics: detail.Lyrics ? String(detail.Lyrics) : undefined,
      durationSec:
        typeof detail.Duration === "number" ? detail.Duration : undefined,
      requestId: meta.RequestId ? String(meta.RequestId) : undefined,
      raw: q.data,
    };
  }
  if (statusNum === 3) {
    return {
      ok: false,
      status: "error",
      provider,
      billing,
      taskId,
      error: String(fail?.Msg || fail?.Code || "Volc song generation failed"),
      requestId: meta.RequestId ? String(meta.RequestId) : undefined,
      raw: q.data,
    };
  }
  return {
    ok: true,
    status: "pending",
    provider,
    billing,
    taskId,
    requestId: meta.RequestId ? String(meta.RequestId) : undefined,
    raw: q.data,
  };
}

export async function volcGenerateSong(
  input: VolcMusicGenerateInput,
  opts?: {
    billing?: VolcMusicBilling;
    maxWaitMs?: number;
    pollMs?: number;
  },
): Promise<VolcMusicGenerateResult> {
  const billing = opts?.billing || input.billing || "postpaid";
  const first = await volcSubmitSong(input, billing);
  if (first.status !== "pending" || !first.taskId) return first;

  const maxWait = opts?.maxWaitMs ?? 240_000;
  const poll = opts?.pollMs ?? 4_000;
  const start = Date.now();
  while (Date.now() - start < maxWait) {
    await new Promise((r) => setTimeout(r, poll));
    const q = await volcQuerySong(first.taskId, billing);
    if (q.status !== "pending") return q;
  }
  return {
    ok: false,
    status: "pending",
    provider: providerFor(billing),
    billing,
    taskId: first.taskId,
    error: "Timed out waiting for Volcengine GenSong",
  };
}

export async function volcGenerateSongWithBillingFallback(
  input: VolcMusicGenerateInput,
  opts?: { maxWaitMs?: number; pollMs?: number },
): Promise<VolcMusicGenerateResult & { attempts?: string[] }> {
  if (!isVolcMusicConfigured()) {
    return {
      ok: false,
      status: "unconfigured",
      provider: "volc-postpaid",
      error: "Volcengine AK/SK not configured",
      attempts: [],
    };
  }

  const order = input.billing ? [input.billing] : volcBillingOrder();
  const attempts: string[] = [];
  let last: VolcMusicGenerateResult | null = null;

  for (const billing of order) {
    const label = `${billing}/${actionFor(billing)}`;
    attempts.push(`try:${label}`);
    const r = await volcGenerateSong(input, {
      billing,
      maxWaitMs: opts?.maxWaitMs,
      pollMs: opts?.pollMs,
    });
    last = r;
    if (r.status === "done") {
      attempts.push(`ok:${label}`);
      return { ...r, attempts };
    }
    attempts.push(`fail:${label}:${r.error || r.status}`);
  }

  return {
    ...(last || {
      ok: false,
      status: "error" as const,
      provider: "volc-postpaid" as const,
      error: "All Volc billing modes failed",
    }),
    attempts,
  };
}
