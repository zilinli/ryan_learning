/**
 * Per-account journal (Facebook Timeline spine).
 * Server disk — same host + same accountId = same diary across devices.
 */

import { promises as fs } from "node:fs";
import path from "node:path";
import type { CreationItem } from "./creations-store";
import {
  isValidDay,
  localDay,
  type JournalEntry,
  type JournalMadeBlock,
} from "./journal-model";

export type { JournalEntry, JournalMadeBlock };
export {
  buildTimeline,
  isValidDay,
  journalPromptForGrade,
  localDay,
  timelineMonths,
  timelineYears,
} from "./journal-model";
export type { TimelineDay } from "./journal-model";

export type JournalStore = {
  version: 1;
  items: JournalEntry[];
};

const MAX_ENTRIES = 400;
const MAX_BODY = 12000;

function dataDir(): string {
  return process.env.SPARK_DATA_DIR
    ? path.resolve(process.env.SPARK_DATA_DIR)
    : path.join(process.cwd(), "data");
}

function storePath(accountId: string): string {
  const safe = accountId.replace(/[^A-Za-z0-9_-]/g, "_").slice(0, 64);
  return path.join(dataDir(), "accounts", safe, "journal.json");
}

function empty(): JournalStore {
  return { version: 1, items: [] };
}

function inferSource(entry: Pick<JournalEntry, "body" | "made">): JournalEntry["source"] {
  const hasProse = Boolean(entry.body.trim());
  const hasMade = (entry.made?.length || 0) > 0;
  if (hasProse && hasMade) return "mixed";
  if (hasMade) return "creation";
  return "student";
}

function entryTitle(body: string, made: JournalMadeBlock[]): string | undefined {
  const first = body.trim().split(/\n/)[0]?.slice(0, 72).trim();
  if (first) return first;
  const m = made[0];
  if (m?.title) return m.title;
  return undefined;
}

export async function loadJournal(accountId: string): Promise<JournalStore> {
  try {
    const raw = await fs.readFile(storePath(accountId), "utf8");
    const parsed = JSON.parse(raw) as JournalStore;
    if (!parsed || !Array.isArray(parsed.items)) return empty();
    return {
      version: 1,
      items: parsed.items.map((row) => ({
        ...row,
        body: String(row.body || ""),
        made: Array.isArray(row.made) ? row.made : [],
        source: row.source || inferSource(row),
      })),
    };
  } catch {
    return empty();
  }
}

export async function saveJournal(
  accountId: string,
  store: JournalStore,
): Promise<void> {
  const p = storePath(accountId);
  await fs.mkdir(path.dirname(p), { recursive: true });
  await fs.writeFile(p, JSON.stringify({ version: 1, items: store.items }, null, 2));
}

export async function createJournalEntry(
  accountId: string,
  opts?: {
    date?: string;
    body?: string;
    title?: string;
    prompt?: string;
    writingType?: string;
  },
): Promise<JournalEntry> {
  const store = await loadJournal(accountId);
  const now = Date.now();
  const date = opts?.date && isValidDay(opts.date) ? opts.date : localDay(now);
  const body = String(opts?.body || "").slice(0, MAX_BODY);
  const row: JournalEntry = {
    id: `je_${now}_${Math.random().toString(36).slice(2, 8)}`,
    accountId,
    date,
    createdAt: now,
    updatedAt: now,
    title: opts?.title?.slice(0, 120) || entryTitle(body, []),
    body,
    prompt: opts?.prompt?.slice(0, 240),
    source: "student",
    made: [],
    writingType: opts?.writingType || "journal",
  };
  store.items.unshift(row);
  store.items = store.items.slice(0, MAX_ENTRIES);
  await saveJournal(accountId, store);
  return row;
}

export async function getJournalEntry(
  accountId: string,
  id: string,
): Promise<JournalEntry | null> {
  const store = await loadJournal(accountId);
  return store.items.find((e) => e.id === id) || null;
}

export async function updateJournalEntry(
  accountId: string,
  id: string,
  patch: { body?: string; title?: string; date?: string; prompt?: string },
): Promise<JournalEntry | null> {
  const store = await loadJournal(accountId);
  const idx = store.items.findIndex((e) => e.id === id);
  if (idx < 0) return null;
  const prev = store.items[idx]!;
  const body =
    patch.body !== undefined ? String(patch.body).slice(0, MAX_BODY) : prev.body;
  const date =
    patch.date && isValidDay(patch.date) ? patch.date : prev.date;
  const next: JournalEntry = {
    ...prev,
    body,
    date,
    title:
      patch.title !== undefined
        ? String(patch.title).slice(0, 120)
        : entryTitle(body, prev.made) || prev.title,
    prompt:
      patch.prompt !== undefined
        ? String(patch.prompt).slice(0, 240)
        : prev.prompt,
    updatedAt: Date.now(),
    source: inferSource({ body, made: prev.made }),
  };
  store.items[idx] = next;
  await saveJournal(accountId, store);
  return next;
}

export async function deleteJournalEntry(
  accountId: string,
  id: string,
): Promise<boolean> {
  const store = await loadJournal(accountId);
  const next = store.items.filter((e) => e.id !== id);
  if (next.length === store.items.length) return false;
  store.items = next;
  await saveJournal(accountId, store);
  return true;
}

function madeFromCreation(item: CreationItem): JournalMadeBlock {
  const snapshot = String(
    item.lyrics || item.notes || item.caption || item.challengeScore || "",
  ).slice(0, 2000);
  return {
    kind: item.type,
    creationId: item.id,
    title: item.title || "Untitled",
    style: item.caption?.slice(0, 80),
    bodySnapshot: snapshot,
    mediaId: item.mediaId,
    audioMediaId: item.audioMediaId,
    at: item.createdAt || Date.now(),
  };
}

/** C7: every new Creation lands on that day's Timeline cluster. */
export async function appendCreationToJournal(
  accountId: string,
  item: CreationItem,
  day?: string,
): Promise<JournalEntry> {
  const store = await loadJournal(accountId);
  const date = day && isValidDay(day) ? day : localDay(item.createdAt || Date.now());
  const block = madeFromCreation(item);
  const existingIdx = store.items.findIndex((e) => e.date === date);
  if (existingIdx >= 0) {
    const prev = store.items[existingIdx]!;
    if (prev.made.some((m) => m.creationId && m.creationId === item.id)) {
      return prev;
    }
    const made = [...prev.made, block];
    const next: JournalEntry = {
      ...prev,
      made,
      updatedAt: Date.now(),
      title: prev.title || entryTitle(prev.body, made),
      source: inferSource({ body: prev.body, made }),
    };
    store.items[existingIdx] = next;
    await saveJournal(accountId, store);
    return next;
  }
  const now = Date.now();
  const row: JournalEntry = {
    id: `je_${now}_${Math.random().toString(36).slice(2, 8)}`,
    accountId,
    date,
    createdAt: now,
    updatedAt: now,
    title: block.title,
    body: "",
    source: "creation",
    made: [block],
  };
  store.items.unshift(row);
  store.items = store.items.slice(0, MAX_ENTRIES);
  await saveJournal(accountId, store);
  return row;
}

