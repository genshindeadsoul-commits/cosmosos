import { serveUser } from '../_shared/serve.ts';
import { sheetsPreview } from '../_shared/handlers.ts';
serveUser((uid, body, ctx) => sheetsPreview(uid, body, ctx));
