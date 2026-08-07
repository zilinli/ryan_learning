"use client";

import { useCallback, useEffect, useState } from "react";

type ThemeId = "light" | "dark" | "light-blue" | "light-green";

const THEMES: { id: ThemeId; label: string; swatch: string; ring: string }[] = [
  { id: "light", label: "Light", swatch: "#f3ebe0", ring: "#6b8f71" },
  { id: "dark", label: "Dark", swatch: "#1a120c", ring: "#8fb896" },
  { id: "light-blue", label: "Blue", swatch: "#eef4f8", ring: "#3a7a9a" },
  { id: "light-green", label: "Green", swatch: "#eef8f0", ring: "#3a7e5a" },
];

function loadTheme(): ThemeId {
  try {
    const t = localStorage.getItem("spark.theme") as ThemeId | null;
    if (t && THEMES.some((th) => th.id === t)) return t;
    // backward compat: migrate old spark.dark
    if (localStorage.getItem("spark.dark") === "true") return "dark";
  } catch {}
  return "light";
}

function applyTheme(id: ThemeId) {
  try {
    localStorage.setItem("spark.theme", id);
    // cleanup old flag
    localStorage.removeItem("spark.dark");
  } catch {}
  document.documentElement.setAttribute("data-theme", id);
}

export function ThemePicker() {
  const [active, setActive] = useState<ThemeId>("light");

  useEffect(() => {
    setActive(loadTheme());
  }, []);

  const pick = useCallback((id: ThemeId) => {
    setActive(id);
    applyTheme(id);
  }, []);

  return (
    <div className="flex items-center gap-1">
      {THEMES.map((t) => (
        <button
          key={t.id}
          type="button"
          title={t.label}
          aria-label={`${t.label} theme`}
          onClick={() => pick(t.id)}
          className="inline-flex h-7 w-7 items-center justify-center rounded-full transition hover:scale-110 active:scale-95"
          style={{
            background: t.swatch,
            boxShadow:
              active === t.id
                ? `0 0 0 2px var(--bg0), 0 0 0 4px ${t.ring}`
                : `0 0 0 1px var(--line)`,
          }}
        />
      ))}
    </div>
  );
}
