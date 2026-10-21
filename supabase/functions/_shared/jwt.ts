// ES256 developer token for Apple MusicKit. Key material comes from server secrets only.
const b64url = (b: ArrayBuffer | Uint8Array | string) => {
  const u = typeof b === 'string' ? new TextEncoder().encode(b) : new Uint8Array(b as ArrayBuffer);
  return btoa(String.fromCharCode(...u)).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
};

export async function signAppleDeveloperToken(opts: { teamId: string; keyId: string; privateKeyPem: string; nowSec: number; ttlSec?: number }): Promise<string> {
  const pem = opts.privateKeyPem.replace(/\\n/g, '\n').replace(/-----(BEGIN|END) PRIVATE KEY-----/g, '').replace(/\s+/g, '');
  const key = await crypto.subtle.importKey('pkcs8', Uint8Array.from(atob(pem), (c) => c.charCodeAt(0)), { name: 'ECDSA', namedCurve: 'P-256' }, false, ['sign']);
  const header = b64url(JSON.stringify({ alg: 'ES256', kid: opts.keyId, typ: 'JWT' }));
  const payload = b64url(JSON.stringify({ iss: opts.teamId, iat: opts.nowSec, exp: opts.nowSec + (opts.ttlSec ?? 3600) }));
  const sig = await crypto.subtle.sign({ name: 'ECDSA', hash: 'SHA-256' }, key, new TextEncoder().encode(`${header}.${payload}`));
  return `${header}.${payload}.${b64url(sig)}`;
}
