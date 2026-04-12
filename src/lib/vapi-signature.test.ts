import { createHmac } from "node:crypto";

import { describe, expect, it } from "vitest";

import { verifyVapiSignature } from "./vapi-signature";

describe("verifyVapiSignature", () => {
  const payload = JSON.stringify({ message: { type: "call-started" } });
  const secret = "test-webhook-secret";

  it("accepts sha256 hex signatures", () => {
    const signature = createHmac("sha256", secret)
      .update(payload)
      .digest("hex");

    expect(verifyVapiSignature(payload, signature, secret)).toBe(true);
  });

  it("accepts signatures with sha256= prefix", () => {
    const signature = createHmac("sha256", secret)
      .update(payload)
      .digest("hex");

    expect(verifyVapiSignature(payload, `sha256=${signature}`, secret)).toBe(
      true,
    );
  });

  it("rejects invalid signatures", () => {
    expect(verifyVapiSignature(payload, "bad-signature", secret)).toBe(false);
  });
});
