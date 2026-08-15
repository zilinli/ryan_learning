"use client";

import { useEffect } from "react";

/**
 * Debug crash watch (session 753d74): captures client-side crashes that could
 * explain "uploaded a video, sent the message, the page just restarted".
 * Logs uncaught errors, unhandled promise rejections, and page lifecycle
 * transitions (pagehide / pageshow / freeze / visibilitychange) with
 * navigation type so we can tell a browser-initiated reload from a crash.
 */
export function CrashWatch() {
  useEffect(() => {
    let lastErrorAt = 0;
    const post = (message: string, data: Record<string, unknown>) => {
      try {
        fetch("/api/debug-relay", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            sessionId: "753d74",
            runId: "crashwatch",
            hypothesisId: "H1",
            location: "CrashWatch.tsx",
            message,
            data,
            timestamp: Date.now(),
          }),
        }).catch(() => {});
      } catch {
        /* ignore */
      }
    };

    const onError = (e: ErrorEvent) => {
      post("window.error", {
        type: "error",
        message: String(e.message || "").slice(0, 300),
        source: String(e.filename || "").slice(-120),
        lineno: e.lineno,
        colno: e.colno,
      });
    };

    const onUnhandled = (e: PromiseRejectionEvent) => {
      post("unhandledrejection", {
        type: "unhandledrejection",
        reason: String((e.reason as Error)?.message ?? e.reason).slice(0, 300),
      });
    };

    const onVisibility = () => {
      post("visibilitychange", {
        state: document.visibilityState,
        navType: String(
          performance.getEntriesByType("navigation")[0]?.type ?? "unknown",
        ),
      });
    };

    const onPageHide = (e: PageTransitionEvent) => {
      post("pagehide", {
        persisted: e.persisted,
        navType: String(
          performance.getEntriesByType("navigation")[0]?.type ?? "unknown",
        ),
      });
    };

    const onPageShow = (e: PageTransitionEvent) => {
      post("pageshow", {
        persisted: e.persisted,
        navType: String(
          performance.getEntriesByType("navigation")[0]?.type ?? "unknown",
        ),
      });
    };

    const onFreeze = () => post("freeze", {});
    const onResume = () =>
      post("resume", {
        navType: String(
          performance.getEntriesByType("navigation")[0]?.type ?? "unknown",
        ),
      });

    window.addEventListener("error", onError);
    window.addEventListener("unhandledrejection", onUnhandled);
    document.addEventListener("visibilitychange", onVisibility);
    window.addEventListener("pagehide", onPageHide);
    window.addEventListener("pageshow", onPageShow);
    document.addEventListener("freeze", onFreeze);
    document.addEventListener("resume", onResume);
    // Suppress repeated noise from the same burst
    lastErrorAt = Date.now();

    post("boot", {
      navType: String(
        performance.getEntriesByType("navigation")[0]?.type ?? "unknown",
      ),
      ua: String(navigator.userAgent).slice(0, 160),
    });

    return () => {
      window.removeEventListener("error", onError);
      window.removeEventListener("unhandledrejection", onUnhandled);
      document.removeEventListener("visibilitychange", onVisibility);
      window.removeEventListener("pagehide", onPageHide);
      window.removeEventListener("pageshow", onPageShow);
      document.removeEventListener("freeze", onFreeze);
      document.removeEventListener("resume", onResume);
    };
  }, []);

  return null;
}
