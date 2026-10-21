import { serveUser } from '../_shared/serve.ts';
import { startOAuth } from '../_shared/handlers.ts';
serveUser((uid, body, ctx) => startOAuth(uid, body, ctx));
