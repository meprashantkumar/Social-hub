import { createCipheriv, createDecipheriv, randomBytes } from "node:crypto";
import { env } from "../config/env";

const KEY = Buffer.from(env.ENCRYPTION_KEY, "hex");
if (KEY.length !== 32) {
  throw new Error("ENCRYPTION_KEY must decode to 32 bytes (64 hex chars)");
}

const IV_LENGTH = 12; // GCM standard nonce size
const TAG_LENGTH = 16;

/**
 * AES-256-GCM encrypt. Output = base64(iv | authTag | ciphertext), so each call
 * is self-contained and uses a fresh random IV. Use for OAuth tokens at rest.
 */
export function encrypt(plaintext: string): string {
  const iv = randomBytes(IV_LENGTH);
  const cipher = createCipheriv("aes-256-gcm", KEY, iv);
  const ciphertext = Buffer.concat([cipher.update(plaintext, "utf8"), cipher.final()]);
  const tag = cipher.getAuthTag();
  return Buffer.concat([iv, tag, ciphertext]).toString("base64");
}

export function decrypt(payload: string): string {
  const buf = Buffer.from(payload, "base64");
  const iv = buf.subarray(0, IV_LENGTH);
  const tag = buf.subarray(IV_LENGTH, IV_LENGTH + TAG_LENGTH);
  const ciphertext = buf.subarray(IV_LENGTH + TAG_LENGTH);
  const decipher = createDecipheriv("aes-256-gcm", KEY, iv);
  decipher.setAuthTag(tag);
  return Buffer.concat([decipher.update(ciphertext), decipher.final()]).toString("utf8");
}

/** Encrypt a nullable secret (leaves null/undefined untouched). */
export const encryptNullable = (v: string | null | undefined): string | null =>
  v ? encrypt(v) : null;
