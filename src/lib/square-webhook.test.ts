import { describe, expect, it } from "vitest";
import { createHmac } from "crypto";
import { verifySquareSignature } from "./square.server";

const KEY = "test-signature-key";
const CANONICAL = "https://salonagentai.com/api/public/square-webhook";
const ALT = "https://www.salonagentai.com/api/public/square-webhook";
const BODY = JSON.stringify({ type: "payment.updated", data: { object: { payment: { id: "p1" } } } });

function sign(url: string, body: string, key = KEY) {
  return createHmac("sha256", key).update(url + body).digest("base64");
}

describe("verifySquareSignature", () => {
  it("accepts a signature computed over the canonical notification URL", () => {
    expect(
      verifySquareSignature({
        signatureKey: KEY,
        notificationUrls: [CANONICAL],
        signature: sign(CANONICAL, BODY),
        body: BODY,
      }),
    ).toBe(true);
  });

  it("accepts a signature computed over the alternate URL Square was configured with", () => {
    expect(
      verifySquareSignature({
        signatureKey: KEY,
        notificationUrls: [CANONICAL, ALT],
        signature: sign(ALT, BODY),
        body: BODY,
      }),
    ).toBe(true);
  });

  it("rejects a body that was modified after signing", () => {
    expect(
      verifySquareSignature({
        signatureKey: KEY,
        notificationUrls: [CANONICAL, ALT],
        signature: sign(CANONICAL, BODY),
        body: BODY.replace("payment.updated", "payment.created"),
      }),
    ).toBe(false);
  });

  it("rejects a signature made with a different key", () => {
    expect(
      verifySquareSignature({
        signatureKey: KEY,
        notificationUrls: [CANONICAL, ALT],
        signature: sign(CANONICAL, BODY, "wrong-key"),
        body: BODY,
      }),
    ).toBe(false);
  });

  it("rejects a missing signature", () => {
    expect(
      verifySquareSignature({ signatureKey: KEY, notificationUrls: [CANONICAL], signature: "", body: BODY }),
    ).toBe(false);
  });

  it("rejects a signature made for a URL this app was not configured with", () => {
    expect(
      verifySquareSignature({
        signatureKey: KEY,
        notificationUrls: [CANONICAL],
        signature: sign("https://evil.example/api/public/square-webhook", BODY),
        body: BODY,
      }),
    ).toBe(false);
  });
});
