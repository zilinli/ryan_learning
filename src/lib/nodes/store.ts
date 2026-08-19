import { EventEmitter } from "node:events";
import { promises as fs } from "node:fs";
import path from "node:path";
import { randomBytes } from "node:crypto";
import type { NodeCommand, NodeRecord, NodeReplyEvent, PairRecord } from "./types";

const DATA_DIR = path.join(process.cwd(), "data", "nodes");
const PAIRS_FILE = path.join(DATA_DIR, "pairs.json");
const NODES_FILE = path.join(DATA_DIR, "nodes.json");
const PAIR_TTL_MS = 15 * 60 * 1000;
const ONLINE_MS = 45_000;

type Hub = {
  pairs: PairRecord[];
  nodes: NodeRecord[];
  queues: Map<string, NodeCommand[]>;
  waiters: Map<string, (cmd: NodeCommand | null) => void>;
  bus: EventEmitter;
};

const g = globalThis as typeof globalThis & { __sparkNodeHub?: Hub };

function hub(): Hub {
  if (!g.__sparkNodeHub) {
    g.__sparkNodeHub = {
      pairs: [],
      nodes: [],
      queues: new Map(),
      waiters: new Map(),
      bus: new EventEmitter(),
    };
    g.__sparkNodeHub.bus.setMaxListeners(200);
  }
  return g.__sparkNodeHub;
}

async function ensureDir() {
  await fs.mkdir(DATA_DIR, { recursive: true });
}

async function load() {
  const h = hub();
  if (h.pairs.length || h.nodes.length) return;
  await ensureDir();
  try {
    h.pairs = JSON.parse(await fs.readFile(PAIRS_FILE, "utf8")) as PairRecord[];
  } catch {
    h.pairs = [];
  }
  try {
    h.nodes = JSON.parse(await fs.readFile(NODES_FILE, "utf8")) as NodeRecord[];
  } catch {
    h.nodes = [];
  }
}

async function savePairs() {
  await ensureDir();
  await fs.writeFile(PAIRS_FILE, JSON.stringify(hub().pairs, null, 2), "utf8");
}

async function saveNodes() {
  await ensureDir();
  await fs.writeFile(NODES_FILE, JSON.stringify(hub().nodes, null, 2), "utf8");
}

function now() {
  return Date.now();
}

function code6() {
  return randomBytes(4).toString("hex").slice(0, 8).toUpperCase();
}

export async function createPair(): Promise<PairRecord> {
  await load();
  const h = hub();
  const rec: PairRecord = {
    code: code6(),
    createdAt: now(),
    expiresAt: now() + PAIR_TTL_MS,
    used: false,
  };
  h.pairs = h.pairs.filter((p) => p.expiresAt > now() && !p.used);
  h.pairs.push(rec);
  await savePairs();
  return rec;
}

export async function peekPair(code: string): Promise<PairRecord | null> {
  await load();
  const p = hub().pairs.find((x) => x.code.toUpperCase() === code.toUpperCase());
  if (!p || p.used || p.expiresAt < now()) return null;
  return p;
}

export async function consumePair(code: string): Promise<boolean> {
  await load();
  const p = hub().pairs.find((x) => x.code.toUpperCase() === code.toUpperCase());
  if (!p || p.used || p.expiresAt < now()) return false;
  p.used = true;
  await savePairs();
  return true;
}

export async function registerNode(input: {
  hostname: string;
  platform: string;
  openclawVersion: string;
}): Promise<NodeRecord> {
  await load();
  const rec: NodeRecord = {
    nodeId: randomBytes(8).toString("hex"),
    token: randomBytes(24).toString("hex"),
    hostname: input.hostname || "unknown",
    platform: input.platform || "win32",
    openclawVersion: input.openclawVersion || "",
    lastSeen: now(),
    createdAt: now(),
  };
  hub().nodes.push(rec);
  await saveNodes();
  return rec;
}

export async function getNodeByToken(token: string): Promise<NodeRecord | null> {
  await load();
  return hub().nodes.find((n) => n.token === token) ?? null;
}

export async function touchNode(nodeId: string, extra?: Partial<Pick<NodeRecord, "openclawVersion" | "hostname">>) {
  await load();
  const n = hub().nodes.find((x) => x.nodeId === nodeId);
  if (!n) return;
  n.lastSeen = now();
  if (extra?.openclawVersion) n.openclawVersion = extra.openclawVersion;
  if (extra?.hostname) n.hostname = extra.hostname;
  await saveNodes();
}

export async function listNodes() {
  await load();
  const t = now();
  return hub().nodes.map((n) => ({
    nodeId: n.nodeId,
    hostname: n.hostname,
    platform: n.platform,
    openclawVersion: n.openclawVersion,
    lastSeen: n.lastSeen,
    online: t - n.lastSeen < ONLINE_MS,
  }));
}

export function enqueueCommand(nodeId: string, cmd: NodeCommand) {
  const h = hub();
  const waiter = h.waiters.get(nodeId);
  if (waiter) {
    h.waiters.delete(nodeId);
    waiter(cmd);
    return;
  }
  const q = h.queues.get(nodeId) ?? [];
  q.push(cmd);
  h.queues.set(nodeId, q);
}

export function waitCommand(nodeId: string, timeoutMs: number): Promise<NodeCommand | null> {
  const h = hub();
  const q = h.queues.get(nodeId) ?? [];
  if (q.length) {
    const cmd = q.shift()!;
    h.queues.set(nodeId, q);
    return Promise.resolve(cmd);
  }
  return new Promise((resolve) => {
    const timer = setTimeout(() => {
      h.waiters.delete(nodeId);
      resolve(null);
    }, timeoutMs);
    h.waiters.set(nodeId, (cmd) => {
      clearTimeout(timer);
      resolve(cmd);
    });
  });
}

export function publishReply(ev: NodeReplyEvent) {
  hub().bus.emit(`reply:${ev.requestId}`, ev);
}

export function subscribeReply(requestId: string, fn: (ev: NodeReplyEvent) => void): () => void {
  const key = `reply:${requestId}`;
  hub().bus.on(key, fn);
  return () => hub().bus.off(key, fn);
}

export async function pickOnlineNode(preferred?: string) {
  await load();
  const t = now();
  const online = hub().nodes.filter((n) => t - n.lastSeen < ONLINE_MS);
  if (preferred) {
    const hit = online.find((n) => n.nodeId === preferred);
    if (hit) return hit;
  }
  return online[0] ?? null;
}

export { PAIR_TTL_MS, ONLINE_MS };
