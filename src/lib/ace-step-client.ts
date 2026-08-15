/**
 * Thin client for remote ACE-Step API (GPU elsewhere).
 * Env: ACE_STEP_BASE_URL, ACE_STEP_API_KEY (optional)
 */

export type AceStepGenerateInput = {
  prompt: string;
  lyrics: string;
  audioDuration?: number;
  bpm?: number;
};

export type AceStepGenerateResult = {
  ok: boolean;
  status: "done" | "pending" | "error" | "unconfigured";
  taskId?: string;
  audioUrl?: string;
  audioBase64?: string;
  mimeType?: string;
  error?: string;
  raw?: unknown;
};

function baseUrl(): string | null {
  const u = process.env.ACE_STEP_BASE_URL?.trim();
  return u ? u.replace(/\/$/, "") : null;
}

function headers(): HeadersInit {
  const h: Record<string, string> = {
    "Content-Type": "application/json",
    Accept: "application/json",
  };
  const key = process.env.ACE_STEP_API_KEY?.trim();
  if (key) h.Authorization = `Bearer ${key}`;
  return h;
}

export function isAceStepConfigured(): boolean {
  return Boolean(baseUrl());
}

export async function aceStepReleaseTask(
  input: AceStepGenerateInput,
): Promise<AceStepGenerateResult> {
  const root = baseUrl();
  if (!root) {
    return {
      ok: false,
      status: "unconfigured",
      error: "ACE_STEP_BASE_URL is not set",
    };
  }

  const body = {
    prompt: input.prompt,
    caption: input.prompt,
    lyrics: input.lyrics,
    audio_duration: input.audioDuration ?? 60,
    bpm: input.bpm,
    task_type: "text2music",
  };

  try {
    const res = await fetch(`${root}/release_task`, {
      method: "POST",
      headers: headers(),
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(60_000),
    });
    const data = (await res.json().catch(() => ({}))) as Record<string, unknown>;
    if (!res.ok) {
      return {
        ok: false,
        status: "error",
        error: String(data.error || data.message || `HTTP ${res.status}`),
        raw: data,
      };
    }
    const taskId = String(data.task_id || data.taskId || data.id || "");
    if (data.audio_url || data.audioUrl) {
      return {
        ok: true,
        status: "done",
        taskId: taskId || undefined,
        audioUrl: String(data.audio_url || data.audioUrl),
        mimeType: String(data.mime_type || data.mimeType || "audio/mpeg"),
        raw: data,
      };
    }
    if (!taskId) {
      return {
        ok: false,
        status: "error",
        error: "ACE-Step response missing task_id",
        raw: data,
      };
    }
    return { ok: true, status: "pending", taskId, raw: data };
  } catch (err) {
    return {
      ok: false,
      status: "error",
      error: err instanceof Error ? err.message : "ACE-Step request failed",
    };
  }
}

export async function aceStepQueryResult(
  taskId: string,
): Promise<AceStepGenerateResult> {
  const root = baseUrl();
  if (!root) {
    return {
      ok: false,
      status: "unconfigured",
      error: "ACE_STEP_BASE_URL is not set",
    };
  }
  try {
    const res = await fetch(
      `${root}/query_result?task_id=${encodeURIComponent(taskId)}`,
      {
        headers: headers(),
        signal: AbortSignal.timeout(30_000),
      },
    );
    const data = (await res.json().catch(() => ({}))) as Record<string, unknown>;
    if (!res.ok) {
      return {
        ok: false,
        status: "error",
        error: String(data.error || data.message || `HTTP ${res.status}`),
        taskId,
        raw: data,
      };
    }
    const status = String(data.status || data.state || "").toLowerCase();
    const audioUrl = data.audio_url || data.audioUrl || data.url;
    const b64 = data.audio_base64 || data.audioBase64 || data.audio;
    if (audioUrl || b64) {
      return {
        ok: true,
        status: "done",
        taskId,
        audioUrl: audioUrl ? String(audioUrl) : undefined,
        audioBase64: typeof b64 === "string" ? b64 : undefined,
        mimeType: String(data.mime_type || data.mimeType || "audio/mpeg"),
        raw: data,
      };
    }
    if (status.includes("fail") || status.includes("error")) {
      return {
        ok: false,
        status: "error",
        taskId,
        error: String(data.error || data.message || "generation failed"),
        raw: data,
      };
    }
    return { ok: true, status: "pending", taskId, raw: data };
  } catch (err) {
    return {
      ok: false,
      status: "error",
      taskId,
      error: err instanceof Error ? err.message : "query failed",
    };
  }
}

/** Poll until done / error / timeout. */
export async function aceStepGenerate(
  input: AceStepGenerateInput,
  opts?: { maxWaitMs?: number; pollMs?: number },
): Promise<AceStepGenerateResult> {
  const first = await aceStepReleaseTask(input);
  if (first.status !== "pending" || !first.taskId) return first;
  const maxWait = opts?.maxWaitMs ?? 180_000;
  const poll = opts?.pollMs ?? 3_000;
  const start = Date.now();
  while (Date.now() - start < maxWait) {
    await new Promise((r) => setTimeout(r, poll));
    const q = await aceStepQueryResult(first.taskId);
    if (q.status !== "pending") return q;
  }
  return {
    ok: false,
    status: "pending",
    taskId: first.taskId,
    error: "Timed out waiting for ACE-Step",
  };
}
