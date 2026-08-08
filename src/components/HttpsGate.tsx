"use client";

import { useEffect, useState } from "react";

/**
 * Mic/camera need a secure context. Auto-upgrade http → https on the public host.
 */
export function HttpsGate({ children }: { children: React.ReactNode }) {
  const [blocked, setBlocked] = useState(false);
  const [httpsUrl, setHttpsUrl] = useState("");

  useEffect(() => {
    // Redirect decisions run post-hydration only, and the state updates are
    // deferred so no setState runs synchronously in the effect.
    const t = setTimeout(() => {
      const { protocol, hostname, port, pathname, search, hash } =
        window.location;
      const local =
        hostname === "localhost" ||
        hostname === "127.0.0.1" ||
        hostname === "::1";

      if (protocol === "https:" || local) {
        setBlocked(false);
        return;
      }

      // Strip non-443 ports like :3000 so we land on nginx HTTPS
      const target = `https://${hostname}${pathname}${search}${hash}`;
      setHttpsUrl(target);

      // If user opened plain http or :3000, bounce to https
      if (protocol === "http:" || port === "3000") {
        window.location.replace(target);
        setBlocked(true);
      }
    }, 0);
    return () => clearTimeout(t);
  }, []);

  if (blocked) {
    return (
      <div className="flex min-h-dvh flex-col items-center justify-center gap-4 px-6 text-center">
        <p className="font-[family-name:var(--font-display)] text-3xl text-[var(--ink)]">
          Spark
        </p>
        <p className="max-w-sm text-sm text-[var(--ink-muted)]">
          Opening the secure page so Mic and Camera can work on your phone…
        </p>
        {httpsUrl ? (
          <a
            href={httpsUrl}
            className="rounded-full bg-[var(--teal)] px-5 py-3 text-sm font-medium text-white"
          >
            Continue to HTTPS
          </a>
        ) : null}
      </div>
    );
  }

  return <>{children}</>;
}
