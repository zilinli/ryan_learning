/**
 * Volcengine OpenAPI Signature V4 (header mode) for music GenSong APIs.
 * Docs: https://www.volcengine.com/docs/84992/1967910
 */

import { createHash, createHmac } from "node:crypto";

export type VolcSignInput = {
  method: string;
  host: string;
  path?: string;
  query: Record<string, string>;
  body: string;
  accessKeyId: string;
  secretKey: string;
  region: string;
  service: string;
  /** UTC now override for tests */
  now?: Date;
};

function sha256Hex(data: string | Buffer): string {
  return createHash("sha256").update(data).digest("hex");
}

function hmac(key: Buffer | string, data: string): Buffer {
  return createHmac("sha256", key).update(data, "utf8").digest();
}

function encodeQuery(query: Record<string, string>): string {
  return Object.keys(query)
    .sort()
    .map(
      (k) =>
        `${encodeURIComponent(k)}=${encodeURIComponent(query[k] ?? "")}`,
    )
    .join("&");
}

/** Build signed headers for open.volcengineapi.com POST JSON. */
export function signVolcOpenApi(input: VolcSignInput): Record<string, string> {
  const method = input.method.toUpperCase();
  const path = input.path || "/";
  const now = input.now || new Date();
  const xDate = now
    .toISOString()
    .replace(/[-:]/g, "")
    .replace(/\.\d{3}Z$/, "Z");
  const shortDate = xDate.slice(0, 8);
  const payloadHash = sha256Hex(input.body || "");
  const contentType = "application/json";
  const host = input.host;

  const canonicalHeaders =
    `content-type:${contentType}\n` +
    `host:${host}\n` +
    `x-content-sha256:${payloadHash}\n` +
    `x-date:${xDate}\n`;
  const signedHeaders = "content-type;host;x-content-sha256;x-date";
  const canonicalQuery = encodeQuery(input.query);
  const canonicalRequest = [
    method,
    path,
    canonicalQuery,
    canonicalHeaders,
    signedHeaders,
    payloadHash,
  ].join("\n");

  const credentialScope = `${shortDate}/${input.region}/${input.service}/request`;
  const stringToSign = [
    "HMAC-SHA256",
    xDate,
    credentialScope,
    sha256Hex(canonicalRequest),
  ].join("\n");

  const kDate = hmac(input.secretKey, shortDate);
  const kRegion = hmac(kDate, input.region);
  const kService = hmac(kRegion, input.service);
  const kSigning = hmac(kService, "request");
  const signature = createHmac("sha256", kSigning)
    .update(stringToSign, "utf8")
    .digest("hex");

  const authorization =
    `HMAC-SHA256 Credential=${input.accessKeyId}/${credentialScope}, ` +
    `SignedHeaders=${signedHeaders}, Signature=${signature}`;

  return {
    Host: host,
    "Content-Type": contentType,
    "X-Date": xDate,
    "X-Content-Sha256": payloadHash,
    Authorization: authorization,
  };
}

export function volcQueryString(query: Record<string, string>): string {
  return encodeQuery(query);
}
