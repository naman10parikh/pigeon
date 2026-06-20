/**
 * Opaque unsubscribe IDs (O-05/O-06, SCN-13, PIT-06). Unsubscribe links must use opaque, signed
 * IDs so enumeration can't unsubscribe arbitrary users — and the endpoint is POST-only (a GET must
 * never mutate). This module produces + verifies the opaque token; the POST-only contract is
 * enforced in the unsubscribe config the verb emits.
 *
 * Two layers: Sqids gives a short, non-sequential public id from a numeric subscriber id; an HMAC
 * (keyed by UNSUBSCRIBE_TOKEN_SECRET) signs the payload so a forged/enumerated id is rejected.
 */
import { createHmac, timingSafeEqual } from "node:crypto";
import Sqids from "sqids";

const sqids = new Sqids({ minLength: 10 });

/** Encode a numeric subscriber id into a short non-sequential public id (not security, just opacity). */
export function encodeSubscriberId(id: number): string {
  return sqids.encode([id]);
}

/** Decode a public id back to the numeric subscriber id (returns null if malformed). */
export function decodeSubscriberId(pub: string): number | null {
  try {
    const out = sqids.decode(pub);
    return out.length === 1 && typeof out[0] === "number" ? out[0] : null;
  } catch {
    return null;
  }
}

/**
 * Sign an unsubscribe payload (subscriber+list) with HMAC-SHA256 → an opaque token. The secret
 * comes from UNSUBSCRIBE_TOKEN_SECRET (self-provisioned via `openssl rand -hex 32`). A token a
 * scanner can't forge is the defense against enumeration unsubscribes (PIT-06).
 */
export function signUnsubToken(
  subscriberId: number,
  listId: string,
  secret: string = process.env.UNSUBSCRIBE_TOKEN_SECRET ?? "",
): string {
  if (!secret) {
    throw new Error(
      "UNSUBSCRIBE_TOKEN_SECRET not set — generate with `openssl rand -hex 32` (self-provisioned, PLAN §8)",
    );
  }
  const pub = encodeSubscriberId(subscriberId);
  const sig = createHmac("sha256", secret).update(`${pub}.${listId}`).digest("hex").slice(0, 32);
  return `${pub}.${sig}`;
}

/** Verify + parse an opaque unsubscribe token. Returns the subscriberId or null if invalid/forged. */
export function verifyUnsubToken(
  token: string,
  listId: string,
  secret: string = process.env.UNSUBSCRIBE_TOKEN_SECRET ?? "",
): number | null {
  if (!secret) return null;
  const parts = token.split(".");
  if (parts.length !== 2) return null;
  const [pub, sig] = parts;
  if (!pub || !sig) return null;
  const expected = createHmac("sha256", secret).update(`${pub}.${listId}`).digest("hex").slice(0, 32);
  // constant-time compare to avoid a timing oracle on the signature.
  const a = Buffer.from(sig);
  const b = Buffer.from(expected);
  if (a.length !== b.length || !timingSafeEqual(a, b)) return null;
  return decodeSubscriberId(pub);
}
