import { after, before, describe, test } from "node:test";
import assert from "node:assert/strict";
import { generateKeyPairSync, sign, type KeyObject } from "node:crypto";
import type { Server } from "node:http";
import type { AddressInfo } from "node:net";

// Our own key pair plays the role of Discord: the server gets the public key, the tests sign with the private one.
const discordKeys = generateKeyPairSync("ed25519");
const attackerKeys = generateKeyPairSync("ed25519");

function publicKeyHex(key: KeyObject): string {
  const x = key.export({ format: "jwk" }).x;
  return Buffer.from(x ?? "", "base64url").toString("hex");
}

process.env.LOG_LEVEL = "silent";
process.env.DISCORD_APPLICATION_ID = "123456789012345678";
process.env.DISCORD_PUBLIC_KEY = publicKeyHex(discordKeys.publicKey);
process.env.DISCORD_BOT_TOKEN = "test-token";
process.env.DATABASE_URL = "postgresql://test";

let server: Server;
let url: string;

before(async () => {
  // Imported after env is set, because config/env.ts validates process.env on load.
  const { createApp } = await import("../src/app");
  server = createApp().listen(0);
  url = `http://127.0.0.1:${(server.address() as AddressInfo).port}/api/interactions`;
});

after(() => server.close());

const nowSeconds = () => String(Math.floor(Date.now() / 1000));
const pingBody = JSON.stringify({ id: "1", application_id: "123456789012345678", type: 1, token: "t" });

function signedHeaders(body: string, timestamp = nowSeconds(), privateKey = discordKeys.privateKey) {
  const signature = sign(null, Buffer.from(timestamp + body), privateKey).toString("hex");
  return { "Content-Type": "application/json", "X-Signature-Ed25519": signature, "X-Signature-Timestamp": timestamp };
}

const post = (body: string, headers: Record<string, string>) => fetch(url, { method: "POST", body, headers });

describe("POST /api/interactions", () => {
  test("answers a correctly signed PING with PONG", async () => {
    const res = await post(pingBody, signedHeaders(pingBody));
    assert.equal(res.status, 200);
    assert.deepEqual(await res.json(), { type: 1 });
  });

  test("rejects a request with no signature headers", async () => {
    const res = await post(pingBody, { "Content-Type": "application/json" });
    assert.equal(res.status, 401);
  });

  test("rejects a request signed with the wrong key (forged)", async () => {
    const res = await post(pingBody, signedHeaders(pingBody, nowSeconds(), attackerKeys.privateKey));
    assert.equal(res.status, 401);
  });

  test("rejects a body modified after signing", async () => {
    const headers = signedHeaders(pingBody);
    const tampered = pingBody.replace('"type":1', '"type":2');
    const res = await post(tampered, headers);
    assert.equal(res.status, 401);
  });

  test("rejects a garbage signature", async () => {
    const res = await post(pingBody, { ...signedHeaders(pingBody), "X-Signature-Ed25519": "not-hex!!" });
    assert.equal(res.status, 401);
  });

  test("rejects a validly signed but stale request (replay)", async () => {
    const tenMinutesAgo = String(Math.floor(Date.now() / 1000) - 10 * 60);
    const res = await post(pingBody, signedHeaders(pingBody, tenMinutesAgo));
    assert.equal(res.status, 401);
  });

  test("rejects a non-numeric timestamp", async () => {
    const res = await post(pingBody, signedHeaders(pingBody, "yesterday"));
    assert.equal(res.status, 401);
  });

  test("returns 400 for a signed body that is not JSON", async () => {
    const body = "this is not json";
    const res = await post(body, signedHeaders(body));
    assert.equal(res.status, 400);
  });

  test("returns 400 for signed JSON that is not an interaction", async () => {
    const body = JSON.stringify({ hello: "world" });
    const res = await post(body, signedHeaders(body));
    assert.equal(res.status, 400);
  });

  test("returns 413 for an oversized body without touching the handler", async () => {
    const body = "x".repeat(200 * 1024);
    const res = await post(body, signedHeaders(body));
    assert.equal(res.status, 413);
    assert.deepEqual(await res.json(), { error: "Payload Too Large" });
  });
});
