// Called by a companion app (not the browser). Authenticated by a per-user ingest token, so JWT verification is off for this function.
import { makeCtx } from '../_shared/serve.ts';
import { healthIngest } from '../_shared/handlers.ts';
import { HttpError } from '../_shared/ports.ts';
Deno.serve(async (req) => {
  const ctx = makeCtx();
  const reply = (s: number, b: unknown) => new Response(JSON.stringify(b), { status: s, headers: { 'Content-Type': 'application/json' } });
  try {
    if (req.method !== 'POST') throw new HttpError(405, 'method_not_allowed');
    return reply(200, await healthIngest(req.headers.get('authorization'), await req.json().catch(() => null), ctx));
  } catch (e) {
    if (e instanceof HttpError) return reply(e.status, { error: e.code, message: e.message });
    console.error(e); return reply(500, { error: 'internal' });
  }
});
