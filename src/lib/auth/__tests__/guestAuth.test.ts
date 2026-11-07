import { describe, it, expect } from "vitest";
import { generateGuestSecret, hashGuestSecret } from "../guestAuth";

describe("guestAuth", () => {
  it("generates a 64-character hexadecimal random secret", () => {
    const secret = generateGuestSecret();
    expect(secret).toHaveLength(64);
    expect(/^[0-9a-f]{64}$/.test(secret)).toBe(true);

    const secret2 = generateGuestSecret();
    expect(secret).not.toBe(secret2);
  });

  it("produces deterministic SHA-256 hash", () => {
    const secret = "test_guest_secret_12345";
    const hash1 = hashGuestSecret(secret);
    const hash2 = hashGuestSecret(secret);

    expect(hash1).toBe(hash2);
    expect(hash1).toHaveLength(64);
  });
});

