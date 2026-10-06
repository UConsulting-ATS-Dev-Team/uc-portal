// Signed unsubscribe links. The link in an email carries the address and an HMAC of it, so nobody can unsubscribe someone else's
// address by guessing a URL, and the unsubscribe function needs no login (it is opened from an inbox).

const encoder = new TextEncoder();

function toBase64Url(bytes: Uint8Array): string {
  let binary = "";
  for (const b of bytes) binary += String.fromCharCode(b);
  return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

function fromBase64Url(text: string): Uint8Array {
  const padded = text.replace(/-/g, "+").replace(/_/g, "/") + "=".repeat((4 - (text.length % 4)) % 4);
  const binary = atob(padded);
  return Uint8Array.from(binary, (c) => c.charCodeAt(0));
}

async function hmac(secret: string, message: string): Promise<Uint8Array> {
  const key = await crypto.subtle.importKey("raw", encoder.encode(secret), { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
  return new Uint8Array(await crypto.subtle.sign("HMAC", key, encoder.encode(message)));
}

export async function signUnsubscribeToken(email: string, secret: string): Promise<string> {
  const normalized = email.trim().toLowerCase();
  const signature = await hmac(secret, normalized);
  return `${toBase64Url(encoder.encode(normalized))}.${toBase64Url(signature)}`;
}

// The address the token was issued for, or null if the token is malformed or the signature doesn't match.
export async function verifyUnsubscribeToken(token: string, secret: string): Promise<string | null> {
  const [emailPart, signaturePart] = token.split(".");
  if (!emailPart || !signaturePart) return null;
  let email: string;
  try {
    email = new TextDecoder().decode(fromBase64Url(emailPart));
  } catch {
    return null;
  }
  const expected = toBase64Url(await hmac(secret, email));
  // Constant-time comparison.
  if (expected.length !== signaturePart.length) return null;
  let diff = 0;
  for (let i = 0; i < expected.length; i++) diff |= expected.charCodeAt(i) ^ signaturePart.charCodeAt(i);
  return diff === 0 ? email : null;
}
