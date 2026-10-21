// Browser redirect target from Google/Spotify. No user JWT is possible here: identity comes from the one-time `state`.
import { makeCtx } from '../_shared/serve.ts';
import { finishOAuth } from '../_shared/handlers.ts';
Deno.serve(async (req) => {
  const ctx = makeCtx();
  const u = new URL(req.url);
  const to = await finishOAuth({ code: u.searchParams.get('code'), state: u.searchParams.get('state'), error: u.searchParams.get('error') }, ctx);
  return new Response(null, { status: 302, headers: { Location: to, 'Cache-Control': 'no-store' } });
});
