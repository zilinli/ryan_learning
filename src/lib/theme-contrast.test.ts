import { describe, it, expect } from "vitest";
import { promises as fs } from "node:fs";
import path from "node:path";
import { readdirSync } from "node:fs";

const CSS_PATH = path.join(process.cwd(), "src", "app", "globals.css");
const COMPONENTS_DIR = path.join(process.cwd(), "src", "components");

type Vars = Record<string, string>;

/** Parse `[data-theme="…"] { … }` blocks (and the `:root` light block). */
async function parseThemes(): Promise<Record<string, Vars>> {
  const css = await fs.readFile(CSS_PATH, "utf8");
  const themes: Record<string, Vars> = {};

  const lightBlock = css.match(
    /:root,\s*\[data-theme="light"\]\s*\{([^}]+)\}/,
  );
  if (lightBlock) {
    themes["light"] = parseVars(lightBlock[1]);
  }

  const blockRe = /\[data-theme="([^"]+)"\]\s*\{([^}]+)\}/g;
  let m: RegExpExecArray | null;
  while ((m = blockRe.exec(css)) !== null) {
    const name = m[1];
    if (name === "light") continue; // already captured via :root block
    themes[name] = parseVars(m[2]);
  }
  return themes;
}

function parseVars(body: string): Vars {
  const vars: Vars = {};
  const re = /(--[\w-]+)\s*:\s*([^;]+);/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(body)) !== null) {
    vars[m[1]] = m[2].trim();
  }
  return vars;
}

/** WCAG relative luminance for a hex color (#rgb or #rrggbb). */
function luminance(hex: string): number | null {
  const m = /^#([0-9a-fA-F]{3}|[0-9a-fA-F]{6})$/.exec(hex);
  if (!m) return null;
  let h = m[1];
  if (h.length === 3) h = h.split("").map((c) => c + c).join("");
  const [r, g, b] = [0, 2, 4].map((i) => parseInt(h.slice(i, i + 2), 16) / 255);
  const lin = (c: number) =>
    c <= 0.04045 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4);
  return 0.2126 * lin(r) + 0.7152 * lin(g) + 0.0722 * lin(b);
}

function contrast(fg: string, bg: string): number | null {
  const l1 = luminance(fg);
  const l2 = luminance(bg);
  if (l1 === null || l2 === null) return null;
  const [hi, lo] = l1 >= l2 ? [l1, l2] : [l2, l1];
  return (hi + 0.05) / (lo + 0.05);
}

const NORMAL_TEXT = 4.5;
const LARGE_TEXT = 3.0;

describe("theme contrast (WCAG AA)", () => {
  it("every theme defines the full variable set", async () => {
    const themes = await parseThemes();
    const required = [
      "--bg0",
      "--ink",
      "--ink-muted",
      "--teal",
      "--coral",
      "--action-bg",
      "--action-ink",
      "--diff-code-bg",
      "--diff-add-bg",
      "--diff-remove-bg",
      "--diff-add",
      "--diff-remove",
    ];
    for (const theme of ["light", "dark", "light-blue", "light-green"]) {
      expect(Object.keys(themes)).toContain(theme);
      for (const key of required) {
        expect(themes[theme]?.[key], `${theme} missing ${key}`).toBeTruthy();
      }
    }
  });

  it("ink and ink-muted text pass AA (≥ 4.5:1) on bg0 in every theme", async () => {
    const themes = await parseThemes();
    for (const [name, vars] of Object.entries(themes)) {
      const bg = vars["--bg0"];
      for (const key of ["--ink", "--ink-muted"]) {
        const ratio = contrast(vars[key], bg);
        expect(
          ratio,
          `${name}: ${key} (${vars[key]}) vs ${bg} = ${ratio}`,
        ).not.toBeNull();
        expect(
          ratio!,
          `${name}: ${key} needs ≥ ${NORMAL_TEXT}:1 (was ${ratio?.toFixed(2)})`,
        ).toBeGreaterThanOrEqual(NORMAL_TEXT);
      }
    }
  });

  it("teal and coral accents pass AA for large text (≥ 3:1) on bg0", async () => {
    const themes = await parseThemes();
    for (const [name, vars] of Object.entries(themes)) {
      const bg = vars["--bg0"];
      for (const key of ["--teal", "--coral"]) {
        const ratio = contrast(vars[key], bg);
        expect(
          ratio,
          `${name}: ${key} (${vars[key]}) vs ${bg} = ${ratio}`,
        ).not.toBeNull();
        expect(
          ratio!,
          `${name}: ${key} needs ≥ ${LARGE_TEXT}:1 (was ${ratio?.toFixed(2)})`,
        ).toBeGreaterThanOrEqual(LARGE_TEXT);
      }
    }
  });

  it("action button text passes AA (≥ 4.5:1) on its action background", async () => {
    const themes = await parseThemes();
    for (const [name, vars] of Object.entries(themes)) {
      const ratio = contrast(vars["--action-ink"], vars["--action-bg"]);
      expect(
        ratio,
        `${name}: --action-ink (${vars["--action-ink"]}) vs --action-bg (${vars["--action-bg"]}) = ${ratio}`,
      ).not.toBeNull();
      expect(
        ratio!,
        `${name}: action button needs ≥ ${NORMAL_TEXT}:1 (was ${ratio?.toFixed(2)})`,
      ).toBeGreaterThanOrEqual(NORMAL_TEXT);
    }
  });

  it("no hardcoded #fff / #ffffff backgrounds or text in components", async () => {
    const allowed = new Set(["ThemePicker.tsx", "CameraCapture.tsx"]);
    const offenders: string[] = [];
    for (const file of readdirSync(COMPONENTS_DIR)) {
      if (!file.endsWith(".tsx")) continue;
      if (allowed.has(file)) continue;
      const src = await fs.readFile(path.join(COMPONENTS_DIR, file), "utf8");
      if (/#[fF]{3}\b|#[fF]{6}\b/.test(src)) {
        offenders.push(file);
      }
    }
    expect(offenders).toEqual([]);
  });
});
