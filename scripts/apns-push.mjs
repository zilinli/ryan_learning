#!/usr/bin/env node
/**
 * CLI wrapper around src/lib/nodes/apns.ts (run from repo root with node --experimental-strip-types
 * or via compiled path). Prefer importing sendSilentPush from the TypeScript module in-process.
 *
 * Env: APNS_KEY_ID, APNS_TEAM_ID, APNS_BUNDLE_ID, APNS_P8_PATH, APNS_PRODUCTION
 * Usage: node scripts/apns-push.mjs '{"deviceToken":"...","environment":"sandbox"}'
 */
import { createSign } from "node:crypto";
import { readFileSync, existsSync } from "node:fs";
import http2 from "node:http2";

function b64url(buf) {
  return Buffer.from(buf)
    .toString("base64")
    .replace(/=/g, "")
    .replace(/\+/g, "-")
    .replace(/\//g, "_");
}

function makeJwt(keyId, teamId, p8) {
  const header = b64url(JSON.stringify({ alg: "ES256", kid: keyId }));
  const now = Math.floor(Date.now() / 1000);
  const claims = b64url(JSON.stringify({ iss: teamId, iat: now }));
  const unsigned = `${header}.${claims}`;
  const sign = createSign("SHA256");
  sign.update(unsigned);
  sign.end();
  return `${unsigned}.${b64url(sign.sign(p8))}`;
}

export async function sendSilentPush({ deviceToken, environment, requestId, bundleId }) {
  const keyId = process.env.APNS_KEY_ID?.trim();
  const teamId = process.env.APNS_TEAM_ID?.trim();
  const p8Path = process.env.APNS_P8_PATH?.trim();
  const topic = bundleId || process.env.APNS_BUNDLE_ID || "org.spark.bridge";
  if (!keyId || !teamId || !p8Path || !deviceToken) {
    return { ok: false, skipped: true, reason: "APNs not configured or missing token" };
  }
  if (!existsSync(p8Path)) return { ok: false, skipped: true, reason: `missing ${p8Path}` };
  const jwt = makeJwt(keyId, teamId, readFileSync(p8Path, "utf8"));
  const prod =
    environment === "production" ||
    process.env.APNS_PRODUCTION === "1" ||
    process.env.APNS_PRODUCTION === "true";
  const host = prod ? "api.push.apple.com" : "api.sandbox.push.apple.com";
  const path = `/3/device/${String(deviceToken).replace(/\s/g, "")}`;
  const body = JSON.stringify({
    aps: { "content-available": 1 },
    spark: { wake: true, requestId: requestId || "" },
  });
  return await new Promise((resolve) => {
    const client = http2.connect(`https://${host}`);
    client.on("error", (e) => resolve({ ok: false, error: String(e.message || e) }));
    const req = client.request({
      ":method": "POST",
      ":path": path,
      authorization: `bearer ${jwt}`,
      "apns-topic": topic,
      "apns-push-type": "background",
      "apns-priority": "5",
      "content-type": "application/json",
    });
    let status = 0;
    let data = "";
    req.on("response", (headers) => {
      status = Number(headers[":status"] || 0);
    });
    req.on("data", (c) => (data += c));
    req.on("end", () => {
      client.close();
      resolve({ ok: status === 200, status, body: data });
    });
    req.end(body);
  });
}

async function main() {
  const arg = process.argv[2];
  let payload = {};
  if (arg) payload = JSON.parse(arg);
  const result = await sendSilentPush(payload);
  console.log(JSON.stringify(result));
  process.exit(result.ok || result.skipped ? 0 : 1);
}

if (process.argv[1]?.endsWith("apns-push.mjs")) {
  main().catch((e) => {
    console.error(e);
    process.exit(1);
  });
}
