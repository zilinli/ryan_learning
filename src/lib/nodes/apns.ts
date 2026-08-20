/**
 * Silent APNs wake for Spark Bridge iOS.
 * Env: APNS_KEY_ID, APNS_TEAM_ID, APNS_BUNDLE_ID, APNS_P8_PATH, APNS_PRODUCTION
 */
import { createSign } from "node:crypto";
import { readFileSync, existsSync } from "node:fs";
import http2 from "node:http2";

function b64url(buf: Buffer | string) {
  return Buffer.from(buf)
    .toString("base64")
    .replace(/=/g, "")
    .replace(/\+/g, "-")
    .replace(/\//g, "_");
}

function makeJwt(keyId: string, teamId: string, p8: string) {
  const header = b64url(JSON.stringify({ alg: "ES256", kid: keyId }));
  const now = Math.floor(Date.now() / 1000);
  const claims = b64url(JSON.stringify({ iss: teamId, iat: now }));
  const unsigned = `${header}.${claims}`;
  const sign = createSign("SHA256");
  sign.update(unsigned);
  sign.end();
  const sig = sign.sign(p8);
  return `${unsigned}.${b64url(sig)}`;
}

export type SilentPushInput = {
  deviceToken: string;
  environment?: "sandbox" | "production";
  requestId?: string;
  bundleId?: string;
};

export async function sendSilentPush(input: SilentPushInput) {
  const keyId = process.env.APNS_KEY_ID?.trim();
  const teamId = process.env.APNS_TEAM_ID?.trim();
  const p8Path = process.env.APNS_P8_PATH?.trim();
  const bundleId = input.bundleId || process.env.APNS_BUNDLE_ID || "org.spark.bridge";
  if (!keyId || !teamId || !p8Path || !input.deviceToken) {
    return { ok: false as const, skipped: true as const, reason: "APNs not configured or missing token" };
  }
  if (!existsSync(p8Path)) {
    return { ok: false as const, skipped: true as const, reason: `missing ${p8Path}` };
  }
  const p8 = readFileSync(p8Path, "utf8");
  const jwt = makeJwt(keyId, teamId, p8);
  const prod =
    input.environment === "production" ||
    process.env.APNS_PRODUCTION === "1" ||
    process.env.APNS_PRODUCTION === "true";
  const host = prod ? "api.push.apple.com" : "api.sandbox.push.apple.com";
  const path = `/3/device/${input.deviceToken.replace(/\s/g, "")}`;
  const body = JSON.stringify({
    aps: { "content-available": 1 },
    spark: { wake: true, requestId: input.requestId || "" },
  });

  return await new Promise<{ ok: boolean; status?: number; body?: string; error?: string }>((resolve) => {
    const client = http2.connect(`https://${host}`);
    client.on("error", (e) => resolve({ ok: false, error: String(e.message || e) }));
    const req = client.request({
      ":method": "POST",
      ":path": path,
      authorization: `bearer ${jwt}`,
      "apns-topic": bundleId,
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
