import { createHash, randomBytes, timingSafeEqual } from "crypto";

export const CONVERSATION_ACCESS_TTL_MS = 30 * 60 * 1000;

export function createConversationAccessToken(now = Date.now()) {
  const token = randomBytes(32).toString("hex");
  return {
    token,
    tokenHash: createHash("sha256").update(token).digest("hex"),
    expiresAt: new Date(now + CONVERSATION_ACCESS_TTL_MS).toISOString()
  };
}

export function hashConversationAccessToken(token) {
  return createHash("sha256").update(String(token || "")).digest("hex");
}

export function isConversationAccessTokenActive(token, storedHash, expiresAt, now = Date.now()) {
  const rawToken = String(token || "");
  const expectedHash = String(storedHash || "");
  const expiry = Date.parse(String(expiresAt || ""));
  if (!/^[a-f0-9]{64}$/.test(rawToken) || !/^[a-f0-9]{64}$/.test(expectedHash)) return false;
  if (!Number.isFinite(expiry) || expiry <= now) return false;

  const actual = Buffer.from(hashConversationAccessToken(rawToken), "hex");
  const expected = Buffer.from(expectedHash, "hex");
  return actual.length === expected.length && timingSafeEqual(actual, expected);
}
