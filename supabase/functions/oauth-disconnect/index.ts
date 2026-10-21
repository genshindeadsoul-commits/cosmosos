import { serveUser } from '../_shared/serve.ts';
import { disconnect } from '../_shared/handlers.ts';
serveUser((uid, body, ctx) => disconnect(uid, body, ctx));
