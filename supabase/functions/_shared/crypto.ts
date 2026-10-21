// AES-256-GCM for provider tokens at rest. Key comes from the TOKEN_ENCRYPTION_KEY secret (base64, 32 bytes).
const enc = new TextEncoder();
const dec = new TextDecoder();
const b64 = (u: Uint8Array) => btoa(String.fromCharCode(...u));
const unb64 = (s: string) => Uint8Array.from(atob(s), (c) => c.charCodeAt(0));

async function key(keyB64: string): Promise<CryptoKey> {
  const raw = unb64(keyB64);
  if (raw.length !== 32) throw new Error('TOKEN_ENCRYPTION_KEY must be 32 bytes, base64 encoded');
  return crypto.subtle.importKey('raw', raw, 'AES-GCM', false, ['encrypt', 'decrypt']);
}

/** Output: v1.<iv>.<ciphertext+tag>. A fresh random 96-bit IV per call. */
export async function encryptJson(value: unknown, keyB64: string): Promise<string> {
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const ct = new Uint8Array(await crypto.subtle.encrypt({ name: 'AES-GCM', iv }, await key(keyB64), enc.encode(JSON.stringify(value))));
  return `v1.${b64(iv)}.${b64(ct)}`;
}

export async function decryptJson<T>(packed: string, keyB64: string): Promise<T> {
  const [v, iv, ct] = packed.split('.');
  if (v !== 'v1' || !iv || !ct) throw new Error('unrecognized ciphertext');
  const pt = await crypto.subtle.decrypt({ name: 'AES-GCM', iv: unb64(iv) }, await key(keyB64), unb64(ct)); // throws if tampered
  return JSON.parse(dec.decode(pt)) as T;
}

export async function sha256Hex(s: string): Promise<string> {
  const d = new Uint8Array(await crypto.subtle.digest('SHA-256', enc.encode(s)));
  return [...d].map((x) => x.toString(16).padStart(2, '0')).join('');
}

export const randomHex = (bytes = 32) => [...crypto.getRandomValues(new Uint8Array(bytes))].map((x) => x.toString(16).padStart(2, '0')).join('');
