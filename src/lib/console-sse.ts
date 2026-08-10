/** Shared SSE helpers for Code Agent chat streams. */

export type SseHandlers = {
  onDelta?: (text: string, full: string) => void;
  onStatus?: (status: string, data: Record<string, unknown>) => void;
  onToolCall?: (data: Record<string, unknown>) => void;
  onDone?: (text: string) => void;
  onEventId?: (id: number) => void;
};

export async function consumeConsoleSse(
  body: ReadableStream<Uint8Array>,
  signal: AbortSignal | undefined,
  handlers: SseHandlers,
  initialFull = "",
): Promise<string> {
  let full = initialFull;
  const reader = body.getReader();
  const dec = new TextDecoder();
  let buf = "";

  while (true) {
    if (signal?.aborted) throw new DOMException("Aborted", "AbortError");

    let watchdogTimer: ReturnType<typeof setTimeout> | undefined;
    const readWithWatchdog = Promise.race([
      reader.read(),
      new Promise<ReadableStreamReadResult<Uint8Array>>((_, reject) => {
        watchdogTimer = setTimeout(() => reject(new Error("watchdog")), 45_000);
      }),
    ]);

    let done: boolean;
    let value: Uint8Array | undefined;
    try {
      ({ done, value } = await readWithWatchdog);
      clearTimeout(watchdogTimer);
    } catch (e) {
      clearTimeout(watchdogTimer);
      if ((e as Error).message === "watchdog") throw new Error("watchdog");
      throw e;
    }

    if (done) break;
    buf += dec.decode(value, { stream: true });
    const parts = buf.split("\n\n");
    buf = parts.pop() ?? "";

    for (const p of parts) {
      const ls = p.split("\n");
      let ev = "message";
      let dl = "";
      let eventId: number | undefined;
      for (const l of ls) {
        if (l.startsWith("event:")) ev = l.slice(6).trim();
        if (l.startsWith("data:")) dl += l.slice(5).trim();
        if (l.startsWith("id:")) {
          const n = Number(l.slice(3).trim());
          if (Number.isFinite(n)) eventId = n;
        }
      }
      if (eventId != null) handlers.onEventId?.(eventId);
      if (!dl) continue;
      try {
        const data = JSON.parse(dl) as Record<string, unknown>;
        if (ev === "hb") continue;
        if (ev === "delta" && typeof data.text === "string") {
          full += data.text;
          handlers.onDelta?.(data.text, full);
        } else if (ev === "status" && typeof data.status === "string") {
          handlers.onStatus?.(data.status, data);
        } else if (ev === "tool_call") {
          handlers.onToolCall?.(data);
        } else if (ev === "error" && typeof data.error === "string") {
          throw new Error(data.error);
        } else if (ev === "done") {
          if (typeof data.text === "string" && data.text.length >= full.length) {
            full = data.text;
          }
          handlers.onDone?.(full);
        }
      } catch (e) {
        if (e instanceof SyntaxError) continue;
        throw e;
      }
    }
  }
  return full;
}
