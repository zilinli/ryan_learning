/**
 * Lightweight in-process harness for Spark Tutor (SDK customTools).
 * web_search / fetch_page / run_python / run_js — fast, sandboxed, no approval UI.
 */
import { spawn } from "node:child_process";
import { promises as fs } from "node:fs";
import os from "node:os";
import path from "node:path";
import type { SDKCustomTool, SDKJsonValue } from "@cursor/sdk";
import {
  buildGeometrySvg,
  geometrySpecToMarkdown,
  type GeometrySpec,
  type GeomShape,
} from "./geometry-svg";

const MAX_SEARCH_RESULTS = 5;
const MAX_PAGE_CHARS = 6000;
const MAX_CODE_CHARS = 4000;
const MAX_OUTPUT_CHARS = 8000;
const RUN_TIMEOUT_MS = 8000;

function asString(v: SDKJsonValue | undefined, fallback = ""): string {
  return typeof v === "string" ? v : fallback;
}

function asNumber(v: SDKJsonValue | undefined, fallback: number): number {
  return typeof v === "number" && Number.isFinite(v) ? v : fallback;
}

function truncate(s: string, max: number): string {
  if (s.length <= max) return s;
  return `${s.slice(0, max)}\n…[truncated]`;
}

function stripHtml(html: string): string {
  return html
    .replace(/<script[\s\S]*?<\/script>/gi, " ")
    .replace(/<style[\s\S]*?<\/style>/gi, " ")
    .replace(/<noscript[\s\S]*?<\/noscript>/gi, " ")
    .replace(/<!--[\s\S]*?-->/g, " ")
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/\s+/g, " ")
    .trim();
}

function decodeEntities(s: string): string {
  return s
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&nbsp;/g, " ");
}

type SearchHit = { title: string; url: string; snippet: string; source?: string };

function normalizeUrl(u: string): string {
  try {
    const x = new URL(u);
    x.hash = "";
    return x.toString().replace(/\/$/, "");
  } catch {
    return u;
  }
}

/** Prefer Google hits, then fill from others; drop duplicate URLs. */
export function mergeSearchHits(
  batches: SearchHit[][],
  limit: number,
): SearchHit[] {
  const seen = new Set<string>();
  const out: SearchHit[] = [];
  for (const batch of batches) {
    for (const h of batch) {
      if (!h.url || !h.title) continue;
      const key = normalizeUrl(h.url);
      if (seen.has(key)) continue;
      seen.add(key);
      out.push(h);
      if (out.length >= limit) return out;
    }
  }
  return out;
}

async function googleCustomSearch(query: string, limit: number): Promise<SearchHit[]> {
  const key = process.env.GOOGLE_API_KEY?.trim();
  const cx = process.env.GOOGLE_CSE_ID?.trim();
  if (!key || !cx) return [];

  const url =
    `https://www.googleapis.com/customsearch/v1?key=${encodeURIComponent(key)}` +
    `&cx=${encodeURIComponent(cx)}` +
    `&q=${encodeURIComponent(query)}` +
    `&num=${Math.min(Math.max(limit, 1), 10)}`;
  const res = await fetch(url, { signal: AbortSignal.timeout(10000) });
  if (!res.ok) return [];
  const data = (await res.json()) as {
    items?: Array<{ title?: string; link?: string; snippet?: string }>;
  };
  return (data.items || [])
    .filter((it) => it.title && it.link)
    .map((it) => ({
      title: it.title!,
      url: it.link!,
      snippet: it.snippet || "",
      source: "google",
    }));
}

/**
 * Best-effort Google HTML scrape (often blocked on datacenter IPs).
 * Prefer GOOGLE_API_KEY + GOOGLE_CSE_ID for reliable Google results.
 */
async function googleHtmlSearch(query: string): Promise<SearchHit[]> {
  const url =
    `https://www.google.com/search?q=${encodeURIComponent(query)}` +
    `&hl=en&gl=us&pws=0&num=${MAX_SEARCH_RESULTS}&gbv=1`;
  const res = await fetch(url, {
    headers: {
      "User-Agent":
        "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36",
      Accept: "text/html,application/xhtml+xml",
      "Accept-Language": "en-US,en;q=0.9",
      Cookie: "CONSENT=YES+; SOCS=CAISAAhgAQg",
    },
    signal: AbortSignal.timeout(10000),
  });
  if (!res.ok) return [];
  const html = await res.text();
  if (/unusual traffic|captcha|detected unusual/i.test(html)) return [];

  const hits: SearchHit[] = [];
  // Classic /url?q= redirect links (gbv=1 / older markup)
  const re =
    /href="\/url\?q=([^"&]+)[^"]*"[^>]*>\s*(?:<[^>]+>)*([^<]{3,160})/gi;
  let m: RegExpExecArray | null;
  while ((m = re.exec(html)) && hits.length < MAX_SEARCH_RESULTS) {
    let href = "";
    try {
      href = decodeURIComponent(m[1] || "");
    } catch {
      href = m[1] || "";
    }
    if (!/^https?:\/\//i.test(href)) continue;
    if (/google\.(com|co)|webcache\.|accounts\.google/i.test(href)) continue;
    const title = stripHtml(m[2] || "").trim();
    if (!title || title.length < 2) continue;
    hits.push({ title: title.slice(0, 160), url: href, snippet: "", source: "google" });
  }

  // Newer markup: <a href="https://..." data-ved=...>Title</a>
  if (hits.length === 0) {
    const re2 =
      /<a[^>]+href="(https?:\/\/(?!www\.google\.|maps\.google\.|accounts\.google|support\.google|policies\.google)[^"]+)"[^>]*>([\s\S]*?)<\/a>/gi;
    while ((m = re2.exec(html)) && hits.length < MAX_SEARCH_RESULTS) {
      const href = decodeEntities(m[1] || "");
      const title = stripHtml(m[2] || "").trim();
      if (!title || title.length < 3) continue;
      if (/^(images|videos|news|maps|shopping|books)$/i.test(title)) continue;
      hits.push({
        title: title.slice(0, 160),
        url: href,
        snippet: "",
        source: "google",
      });
    }
  }
  return hits;
}

async function googleSearch(query: string, limit: number): Promise<SearchHit[]> {
  const apiHits = await googleCustomSearch(query, limit);
  if (apiHits.length > 0) return apiHits;
  return googleHtmlSearch(query);
}

async function duckDuckGoInstant(query: string): Promise<SearchHit[]> {
  const url = `https://api.duckduckgo.com/?q=${encodeURIComponent(query)}&format=json&no_html=1&skip_disambig=1`;
  const res = await fetch(url, {
    headers: { "User-Agent": "SparkTutor/1.0" },
    signal: AbortSignal.timeout(8000),
  });
  if (!res.ok) return [];
  const data = (await res.json()) as {
    AbstractText?: string;
    AbstractURL?: string;
    Heading?: string;
    Answer?: string;
    RelatedTopics?: Array<{ Text?: string; FirstURL?: string; Topics?: unknown[] }>;
  };
  const hits: SearchHit[] = [];
  if (data.AbstractText && data.AbstractURL) {
    hits.push({
      title: data.Heading || query,
      url: data.AbstractURL,
      snippet: data.AbstractText,
    });
  }
  if (data.Answer) {
    hits.push({
      title: "Instant answer",
      url: data.AbstractURL || "",
      snippet: data.Answer,
    });
  }
  for (const t of data.RelatedTopics || []) {
    if (t.Text && t.FirstURL) {
      hits.push({
        title: t.Text.split(" - ")[0] || t.Text.slice(0, 80),
        url: t.FirstURL,
        snippet: t.Text,
      });
    }
    if (hits.length >= MAX_SEARCH_RESULTS) break;
  }
  return hits.slice(0, MAX_SEARCH_RESULTS);
}

async function duckDuckGoHtml(query: string): Promise<SearchHit[]> {
  const url = `https://html.duckduckgo.com/html/?q=${encodeURIComponent(query)}`;
  const res = await fetch(url, {
    headers: {
      "User-Agent":
        "Mozilla/5.0 (compatible; SparkTutor/1.0; +https://localhost)",
      Accept: "text/html",
    },
    signal: AbortSignal.timeout(10000),
  });
  if (!res.ok) return [];
  const html = await res.text();
  if (/anomaly-modal|g-recaptcha|challenge-form/i.test(html) && !/result__a/.test(html)) {
    return [];
  }

  const hits: SearchHit[] = [];
  const blockRe =
    /class="[^"]*result__a[^"]*"[^>]*href="([^"]+)"[^>]*>([\s\S]*?)<\/a>[\s\S]*?class="[^"]*result__snippet[^"]*"[^>]*>([\s\S]*?)<\//gi;
  let m: RegExpExecArray | null;
  while ((m = blockRe.exec(html)) && hits.length < MAX_SEARCH_RESULTS) {
    let href = decodeEntities(m[1] || "");
    if (href.startsWith("//")) href = `https:${href}`;
    const uddg = href.match(/[?&]uddg=([^&]+)/);
    if (uddg?.[1]) {
      try {
        href = decodeURIComponent(uddg[1]);
      } catch {
        // keep
      }
    }
    if (!/^https?:\/\//i.test(href)) continue;
    const title = stripHtml(m[2] || "").slice(0, 160);
    const snippet = stripHtml(m[3] || "").slice(0, 280);
    if (!title) continue;
    hits.push({ title, url: href, snippet });
  }
  return hits.map((h) => ({ ...h, source: h.source || "duckduckgo" }));
}

async function wikipediaSearch(query: string): Promise<SearchHit[]> {
  const api = `https://en.wikipedia.org/w/api.php?action=opensearch&search=${encodeURIComponent(query)}&limit=${MAX_SEARCH_RESULTS}&namespace=0&format=json`;
  const res = await fetch(api, {
    headers: { "User-Agent": "SparkTutor/1.0" },
    signal: AbortSignal.timeout(8000),
  });
  if (!res.ok) return [];
  const data = (await res.json()) as [string, string[], string[], string[]];
  const titles = data[1] || [];
  const descs = data[2] || [];
  const urls = data[3] || [];
  const hits: SearchHit[] = [];
  for (let i = 0; i < titles.length; i += 1) {
    hits.push({
      title: titles[i]!,
      url: urls[i] || "",
      snippet: descs[i] || titles[i]!,
    });
  }
  return hits.filter((h) => h.url).map((h) => ({ ...h, source: "wikipedia" }));
}

/** Exported for unit tests */
export async function webSearch(query: string, limit = MAX_SEARCH_RESULTS): Promise<SearchHit[]> {
  const q = query.trim().slice(0, 200);
  if (!q) return [];
  const n = Math.min(Math.max(1, limit), 8);

  // DuckDuckGo first (reliable here), then Google; merge + dedupe
  const [ddgHits, googleHits] = await Promise.all([
    duckDuckGoHtml(q).catch(() => [] as SearchHit[]),
    googleSearch(q, n).catch(() => [] as SearchHit[]),
  ]);

  let hits = mergeSearchHits([ddgHits, googleHits], n);

  if (hits.length === 0) {
    hits = mergeSearchHits(
      [
        await duckDuckGoInstant(q).catch(() => [] as SearchHit[]),
        await wikipediaSearch(q).catch(() => [] as SearchHit[]),
      ],
      n,
    );
  }
  return hits.slice(0, n);
}

export async function fetchPageText(url: string): Promise<{
  url: string;
  title: string;
  text: string;
}> {
  const target = url.trim();
  if (!/^https?:\/\//i.test(target)) {
    throw new Error("Only http(s) URLs are allowed");
  }
  const res = await fetch(target, {
    headers: {
      "User-Agent": "Mozilla/5.0 (compatible; SparkTutor/1.0)",
      Accept: "text/html,application/xhtml+xml,text/plain;q=0.9,*/*;q=0.8",
    },
    redirect: "follow",
    signal: AbortSignal.timeout(12000),
  });
  if (!res.ok) throw new Error(`HTTP ${res.status} fetching ${target}`);
  const ctype = res.headers.get("content-type") || "";
  const raw = await res.text();
  if (!/html|text|json|xml|markdown/i.test(ctype) && raw.length > 200_000) {
    throw new Error("Unsupported or too-large content type");
  }
  const titleMatch = raw.match(/<title[^>]*>([\s\S]*?)<\/title>/i);
  const title = titleMatch ? stripHtml(titleMatch[1] || "") : target;
  const text = truncate(stripHtml(raw), MAX_PAGE_CHARS);
  return { url: target, title, text };
}

function assertSafeCode(code: string, kind: "python" | "js") {
  const c = code.trim();
  if (!c) throw new Error("Empty code");
  if (c.length > MAX_CODE_CHARS) throw new Error(`Code too long (max ${MAX_CODE_CHARS})`);
  const banned =
    kind === "python"
      ? /\b(os\.system|subprocess|socket|ctypes|shutil\.rmtree|__import__\s*\(\s*['"]os|open\s*\([^)]*['\"]\/|requests\.|urllib)\b/i
      : /\b(child_process|fs\.|require\s*\(\s*['\"]fs|require\s*\(\s*['\"]net|require\s*\(\s*['\"]http|process\.exit|eval\s*\()/i;
  if (banned.test(c)) {
    throw new Error("Code uses blocked APIs — keep snippets pure / educational");
  }
}

async function runProcess(
  cmd: string,
  args: string[],
  opts: { cwd: string; input?: string },
): Promise<{ stdout: string; stderr: string; code: number | null }> {
  return new Promise((resolve, reject) => {
    const child = spawn(cmd, args, {
      cwd: opts.cwd,
      env: {
        ...process.env,
        HOME: opts.cwd,
        TMPDIR: opts.cwd,
        LANG: "C.UTF-8",
        PYTHONDONTWRITEBYTECODE: "1",
      },
      stdio: ["pipe", "pipe", "pipe"],
    });
    let stdout = "";
    let stderr = "";
    const timer = setTimeout(() => {
      child.kill("SIGKILL");
      reject(new Error(`Timed out after ${RUN_TIMEOUT_MS}ms`));
    }, RUN_TIMEOUT_MS);
    child.stdout.on("data", (b: Buffer) => {
      stdout += b.toString("utf8");
      if (stdout.length > MAX_OUTPUT_CHARS * 2) child.kill("SIGKILL");
    });
    child.stderr.on("data", (b: Buffer) => {
      stderr += b.toString("utf8");
      if (stderr.length > MAX_OUTPUT_CHARS * 2) child.kill("SIGKILL");
    });
    child.on("error", (err) => {
      clearTimeout(timer);
      reject(err);
    });
    child.on("close", (code) => {
      clearTimeout(timer);
      resolve({
        stdout: truncate(stdout, MAX_OUTPUT_CHARS),
        stderr: truncate(stderr, MAX_OUTPUT_CHARS),
        code,
      });
    });
    if (opts.input) child.stdin.write(opts.input);
    child.stdin.end();
  });
}

export async function runPython(code: string): Promise<string> {
  assertSafeCode(code, "python");
  const dir = await fs.mkdtemp(path.join(os.tmpdir(), "spark-py-"));
  try {
    const file = path.join(dir, "main.py");
    await fs.writeFile(file, code, "utf8");
    const { stdout, stderr, code: exit } = await runProcess("python3", [file], {
      cwd: dir,
    });
    const parts = [
      exit === 0 ? "OK" : `exit=${exit}`,
      stdout ? `stdout:\n${stdout}` : "",
      stderr ? `stderr:\n${stderr}` : "",
    ].filter(Boolean);
    return parts.join("\n") || "(no output)";
  } finally {
    await fs.rm(dir, { recursive: true, force: true }).catch(() => undefined);
  }
}

export async function runJs(code: string): Promise<string> {
  assertSafeCode(code, "js");
  const dir = await fs.mkdtemp(path.join(os.tmpdir(), "spark-js-"));
  try {
    const file = path.join(dir, "main.mjs");
    await fs.writeFile(file, code, "utf8");
    const { stdout, stderr, code: exit } = await runProcess("node", [file], {
      cwd: dir,
    });
    const parts = [
      exit === 0 ? "OK" : `exit=${exit}`,
      stdout ? `stdout:\n${stdout}` : "",
      stderr ? `stderr:\n${stderr}` : "",
    ].filter(Boolean);
    return parts.join("\n") || "(no output)";
  } finally {
    await fs.rm(dir, { recursive: true, force: true }).catch(() => undefined);
  }
}

export function createTutorHarnessTools(): Record<string, SDKCustomTool> {
  return {
    web_search: {
      description:
        "Search the public web (DuckDuckGo first, then Google; Wikipedia fallback) for facts, definitions, word meanings, science background, or current info. Use when unsure or when the student asks something that needs lookup. Returns top titles, URLs, and snippets.",
      inputSchema: {
        type: "object",
        properties: {
          query: { type: "string", description: "Search query" },
          limit: {
            type: "number",
            description: "Max results (1–8, default 5)",
          },
        },
        required: ["query"],
      },
      execute: async (args) => {
        try {
          const hits = await webSearch(
            asString(args.query),
            asNumber(args.limit, MAX_SEARCH_RESULTS),
          );
          if (!hits.length) {
            return "No web results. Try a simpler query or answer from knowledge.";
          }
          return hits
            .map((h, i) => {
              const src = h.source ? ` [${h.source}]` : "";
              return `${i + 1}. ${h.title}${src}\n   ${h.url}\n   ${h.snippet || "(no snippet)"}`;
            })
            .join("\n\n");
        } catch (err) {
          return {
            content: [
              {
                type: "text",
                text: `web_search failed: ${err instanceof Error ? err.message : String(err)}`,
              },
            ],
            isError: true,
          };
        }
      },
    },
    fetch_page: {
      description:
        "Fetch a web page (http/https) and return cleaned plain text (truncated). Use after web_search when a specific URL looks useful.",
      inputSchema: {
        type: "object",
        properties: {
          url: { type: "string", description: "Full http(s) URL" },
        },
        required: ["url"],
      },
      execute: async (args) => {
        try {
          const page = await fetchPageText(asString(args.url));
          return `Title: ${page.title}\nURL: ${page.url}\n\n${page.text}`;
        } catch (err) {
          return {
            content: [
              {
                type: "text",
                text: `fetch_page failed: ${err instanceof Error ? err.message : String(err)}`,
              },
            ],
            isError: true,
          };
        }
      },
    },
    run_python: {
      description:
        "Run a short Python 3 snippet in a sandbox (no files outside temp, ~8s timeout). Use for quick maths checks, simulations, or verifying student calculations. Print results with print().",
      inputSchema: {
        type: "object",
        properties: {
          code: { type: "string", description: "Python source to run" },
        },
        required: ["code"],
      },
      execute: async (args) => {
        try {
          return await runPython(asString(args.code));
        } catch (err) {
          return {
            content: [
              {
                type: "text",
                text: `run_python failed: ${err instanceof Error ? err.message : String(err)}`,
              },
            ],
            isError: true,
          };
        }
      },
    },
    run_js: {
      description:
        "Run a short Node.js (ESM) snippet in a sandbox (~8s timeout). Use for tiny coding demos or checks. Prefer console.log for output.",
      inputSchema: {
        type: "object",
        properties: {
          code: { type: "string", description: "JavaScript source to run" },
        },
        required: ["code"],
      },
      execute: async (args) => {
        try {
          return await runJs(asString(args.code));
        } catch (err) {
          return {
            content: [
              {
                type: "text",
                text: `run_js failed: ${err instanceof Error ? err.message : String(err)}`,
              },
            ],
            isError: true,
          };
        }
      },
    },
    draw_geometry: {
      description:
        "Build a simple geometry teaching diagram. Returns a markdown image (![](data:image/svg+xml,...)). Paste that image markdown UNCHANGED into your reply so the student sees the figure (do not wrap it in a code fence). Use for geometry homework — highlight what to notice, not the final answer.",
      inputSchema: {
        type: "object",
        properties: {
          title: { type: "string" },
          width: { type: "number" },
          height: { type: "number" },
          shapes: {
            type: "array",
            description:
              "Shapes: triangle|polygon|line|segment|circle|point|angle|right_angle|text|arrow with coordinates in a ~320×240 canvas",
          },
        },
        required: ["shapes"],
      },
      execute: async (args) => {
        try {
          const shapes = Array.isArray(args.shapes)
            ? (args.shapes as unknown as GeomShape[])
            : [];
          if (!shapes.length) {
            return {
              content: [{ type: "text", text: "draw_geometry needs a shapes array" }],
              isError: true,
            };
          }
          const spec: GeometrySpec = {
            title: asString(args.title) || undefined,
            width: asNumber(args.width, 320),
            height: asNumber(args.height, 240),
            shapes,
          };
          // Validate by building once
          buildGeometrySvg(spec);
          return geometrySpecToMarkdown(spec);
        } catch (err) {
          return {
            content: [
              {
                type: "text",
                text: `draw_geometry failed: ${err instanceof Error ? err.message : String(err)}`,
              },
            ],
            isError: true,
          };
        }
      },
    },
  };
}

export function statusLabelForTool(name: string): string {
  switch (name) {
    case "web_search":
      return "Searching the web…";
    case "fetch_page":
      return "Reading a page…";
    case "run_python":
      return "Running Python…";
    case "run_js":
      return "Running JavaScript…";
    case "draw_geometry":
      return "Drawing a diagram…";
    default:
      return `Using ${name}…`;
  }
}
