import { createHash } from "node:crypto";

export function fingerprintImageBytes(bytes: Uint8Array) {
  return createHash("sha256").update(bytes).digest("hex");
}
