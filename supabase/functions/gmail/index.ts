import { serveUser } from '../_shared/serve.ts';
import { gmailAction } from '../_shared/handlers.ts';
serveUser((uid, body, ctx) => gmailAction(uid, body, ctx));
