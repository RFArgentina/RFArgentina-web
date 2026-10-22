import test from "node:test";
import assert from "node:assert/strict";
import {
  CONVERSATION_ACCESS_TTL_MS,
  createConversationAccessToken,
  hashConversationAccessToken,
  isConversationAccessTokenActive
} from "../conversation-access.js";

test("conversation access tokens are opaque, hashed, and expire", () => {
  const now = Date.now();
  const access = createConversationAccessToken(now);
  assert.match(access.token, /^[a-f0-9]{64}$/);
  assert.notEqual(access.token, access.tokenHash);
  assert.equal(access.tokenHash, hashConversationAccessToken(access.token));
  assert.equal(Date.parse(access.expiresAt), now + CONVERSATION_ACCESS_TTL_MS);
  assert.equal(isConversationAccessTokenActive(access.token, access.tokenHash, access.expiresAt, now), true);
  assert.equal(isConversationAccessTokenActive(access.token, access.tokenHash, access.expiresAt, now + CONVERSATION_ACCESS_TTL_MS), false);
  assert.equal(isConversationAccessTokenActive("a".repeat(64), access.tokenHash, access.expiresAt, now), false);
});
