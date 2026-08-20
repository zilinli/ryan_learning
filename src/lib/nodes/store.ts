import { EventEmitter } from "node:events";
import { promises as fs } from "node:fs";
import path from "node:path";
import { randomBytes } from "node:crypto";
import type { NodeCommand, NodeRecord, NodeReplyEvent, PairRecord } from "./types";

const DATA_DIR = path.join(process.cwd(), "data", "nodes");
const PAIRS_FILE = path.join(DATA_DIR, "pairs.json");
const NODES_FILE = path.join(DATA_DIR, "nodes.json");
const PAIR_TTL_MS = 15 * 60 * 1000;
/** Bridge may be blocked in long-poll or a long agent run; 3 min avoids false offline. */
const ONLINE_MS = 180_000;

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

async function mergeNodesFromDisk() {
  await ensureDir();
  let disk: NodeRecord[] = [];
  try {
    disk = JSON.parse(await fs.readFile(NODES_FILE, "utf8")) as NodeRecord[];
  } catch {
    return;
  }
  const h = hub();
  const mem = new Map(h.nodes.map((n) => [n.nodeId, n]));
  for (const d of disk) {
    const m = mem.get(d.nodeId);
    if (!m) {
      h.nodes.push(d);
      continue;
    }
    if ((d.lastSeen || 0) > (m.lastSeen || 0)) m.lastSeen = d.lastSeen;
    if (d.alias) m.alias = d.alias;
    if (d.hostname) m.hostname = d.hostname;
    if (d.openclawVersion) m.openclawVersion = d.openclawVersion;
    if (d.platform) m.platform = d.platform;
  }
}

async function load() {
  const h = hub();
  if (h.pairs.length || h.nodes.length) {
    await mergeNodesFromDisk();
    return;
  }
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
  bridgeVersion?: string;
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
    bridgeVersion: input.bridgeVersion || "",
  };
  hub().nodes.push(rec);
  await saveNodes();
  return rec;
}

export async function getNodeByToken(token: string): Promise<NodeRecord | null> {
  await load();
  return hub().nodes.find((n) => n.token === token) ?? null;
}

export async function touchNode(
  nodeId: string,
  extra?: Partial<
    Pick<NodeRecord, "openclawVersion" | "hostname" | "bridgeVersion" | "apnsDeviceToken" | "pushEnvironment">
  >,
) {
  await load();
  const n = hub().nodes.find((x) => x.nodeId === nodeId);
  if (!n) return;
  n.lastSeen = now();
  if (extra?.openclawVersion) n.openclawVersion = extra.openclawVersion;
  if (extra?.hostname) n.hostname = extra.hostname;
  if (extra?.bridgeVersion) n.bridgeVersion = extra.bridgeVersion;
  if (extra?.apnsDeviceToken) n.apnsDeviceToken = extra.apnsDeviceToken;
  if (extra?.pushEnvironment === "sandbox" || extra?.pushEnvironment === "production") {
    n.pushEnvironment = extra.pushEnvironment;
  }
  await saveNodes();
}

export const CURRENT_BRIDGE_VERSION = "2026.8.20-6";

export async function listNodes() {
  await load();
  const t = now();
  return hub().nodes.map((n) => ({
    nodeId: n.nodeId,
    hostname: n.hostname,
    alias: n.alias || "",
    platform: n.platform,
    openclawVersion: n.openclawVersion,
    lastSeen: n.lastSeen,
    online: t - n.lastSeen < ONLINE_MS || (n.platform === "ios" && Boolean(n.apnsDeviceToken)),
    bridgeVersion: n.bridgeVersion || "",
    upgradeAvailable:
      n.platform === "ios" ? false : (n.bridgeVersion || "") !== CURRENT_BRIDGE_VERSION,
    hasPush: Boolean(n.apnsDeviceToken),
  }));
}

export async function updateNodeAlias(nodeId: string, alias: string): Promise<boolean> {
  await load();
  const n = hub().nodes.find((x) => x.nodeId === nodeId);
  if (!n) return false;
  const trimmed = alias.trim();
  if (trimmed) n.alias = trimmed;
  else delete n.alias;
  await saveNodes();
  return true;
}

export function enqueueCommand(nodeId: string, cmd: NodeCommand) {
  const h = hub();
  const waiter = h.waiters.get(nodeId);
  if (waiter) {
    h.waiters.delete(nodeId);
    waiter(cmd);
  } else {
    const q = h.queues.get(nodeId) ?? [];
    q.push(cmd);
    h.queues.set(nodeId, q);
  }
  const node = h.nodes.find((n) => n.nodeId === nodeId);
  if (node?.platform === "ios" && node.apnsDeviceToken) {
    void wakeIosNode(node, cmd.requestId);
  }
}

async function wakeIosNode(node: NodeRecord, requestId: string) {
  try {
    const { sendSilentPush } = await import("./apns");
    await sendSilentPush({
      deviceToken: node.apnsDeviceToken!,
      environment: node.pushEnvironment || "sandbox",
      requestId,
    });
  } catch (e) {
    console.error("[nodes] APNs wake failed", e instanceof Error ? e.message : e);
  }
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
  const online = hub().nodes.filter(
    (n) => t - n.lastSeen < ONLINE_MS || (n.platform === "ios" && Boolean(n.apnsDeviceToken)),
  );
  if (preferred) {
    const hit = online.find((n) => n.nodeId === preferred);
    if (hit) return hit;
  }
  return online[0] ?? null;
}

export { PAIR_TTL_MS, ONLINE_MS };
