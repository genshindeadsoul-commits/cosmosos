import { handleRequest } from './_shared/router.ts';
import { makeCtx, makeVerifier } from './_shared/serve.ts';

// One function, many routes: /api/gmail, /api/oauth-start, /api/oauth-callback, /api/health-ingest, ...
// Deploy with verify_jwt = false: every route authenticates itself (see router.ts).
Deno.serve((req) => {
  const ctx = makeCtx();
  return handleRequest(req, ctx, makeVerifier(ctx));
});
