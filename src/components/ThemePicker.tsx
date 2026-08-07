"use client";

import { useCallback, useEffect, useRef, useState } from "react";

type ThemeId = "light" | "dark" | "light-blue" | "light-green";

const THEMES: { id: ThemeId; label: string; swatch: string; accent: string }[] = [
  { id: "light", label: "Light", swatch: "#f3ebe0", accent: "#3d2b1f" },
  { id: "dark", label: "Dark", swatch: "#1a120c", accent: "#8fb896" },
  { id: "light-blue", label: "Light blue", swatch: "#eef4f8", accent: "#3a7a9a" },
  { id: "light-green", label: "Light green", swatch: "#eef8f0", accent: "#3a7e5a" },
];

const DEFAULT_THEME: ThemeId = "light-green";

function loadTheme(): ThemeId {
  try {
    const t = localStorage.getItem("spark.theme") as ThemeId | null;
    if (t && THEMES.some((th) => th.id === t)) return t;
    // backward compat: migrate old spark.dark
    if (localStorage.getItem("spark.dark") === "true") return "dark";
  } catch {}
  return DEFAULT_THEME;
}

function applyTheme(id: ThemeId) {
  try {
    localStorage.setItem("spark.theme", id);
    // cleanup old flag
    localStorage.removeItem("spark.dark");
  } catch {}
  document.documentElement.setAttribute("data-theme", id);
  // Keep the browser chrome (status bar / theme-color) in sync with the UI
  const swatch = THEMES.find((t) => t.id === id)?.swatch;
  if (swatch) {
    let meta = document.querySelector('meta[name="theme-color"]');
    if (!meta) {
      meta = document.createElement("meta");
      meta.setAttribute("name", "theme-color");
      document.head.appendChild(meta);
    }
    meta.setAttribute("content", swatch);
  }
}

/**
 * Compact theme switcher. A single trigger (current theme's swatch) opens a
 * small anchored menu — the four swatch rows stay out of the header until
 * needed, matching the pattern used by Notion / Linear / Vercel.
 */
export function ThemePicker() {
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState<ThemeId>(DEFAULT_THEME);
  const rootRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const t = loadTheme();
    setActive(t);
    applyTheme(t);
  }, []);

  // Close on outside click / touch or Escape
  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent | TouchEvent) => {
      if (rootRef.current && !rootRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    document.addEventListener("mousedown", onDown);
    document.addEventListener("touchstart", onDown);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDown);
      document.removeEventListener("touchstart", onDown);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  const pick = useCallback((id: ThemeId) => {
    setActive(id);
    applyTheme(id);
    setOpen(false);
  }, []);

  const current = THEMES.find((t) => t.id === active) ?? THEMES[0]!;

  return (
    <div ref={rootRef} className="relative">
      <button
        type="button"
        onClick={() => setOpen((p) => !p)}
        aria-label={`Theme: ${current.label}`}
        aria-haspopup="menu"
        aria-expanded={open}
        title="Change theme"
        className="inline-flex h-10 w-10 items-center justify-center rounded-full transition hover:bg-[var(--mist)] focus-visible:ring-2 focus-visible:ring-[var(--teal)]"
      >
        {/* Half-moon swatch = current theme's surface + accent */}
        <span
          className="inline-block h-5 w-5 rounded-full border border-[var(--line)]"
          style={{
            background: `linear-gradient(135deg, ${current.swatch} 50%, ${current.accent} 50%)`,
          }}
        />
      </button>

      {open ? (
        <div
          role="menu"
          aria-label="Theme options"
          className="absolute right-0 top-full z-50 mt-2 w-48 overflow-hidden rounded-2xl border border-[var(--line)] bg-[var(--surface)] p-1.5 shadow-2xl animate-fade-up"
        >
          {THEMES.map((t) => {
            const isActive = t.id === active;
            return (
              <button
                key={t.id}
                type="button"
                role="menuitemradio"
                aria-checked={isActive}
                aria-label={`${t.label} theme`}
                onClick={() => pick(t.id)}
                className="flex w-full items-center gap-2.5 rounded-xl px-2.5 py-2 text-left text-sm transition hover:bg-[var(--surface-muted)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--teal)]"
              >
                <span
                  className="inline-block h-5 w-5 shrink-0 rounded-full border border-[var(--line)]"
                  style={{
                    background: `linear-gradient(135deg, ${t.swatch} 50%, ${t.accent} 50%)`,
                  }}
                />
                <span className="flex-1 text-[var(--ink)]">{t.label}</span>
                {isActive ? (
                  <svg
                    width="14"
                    height="14"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="var(--teal)"
                    strokeWidth="3"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    aria-hidden
                  >
                    <polyline points="20 6 9 17 4 12" />
                  </svg>
                ) : null}
              </button>
            );
          })}
        </div>
      ) : null}
    </div>
  );
}
