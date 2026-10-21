import { serveUser } from '../_shared/serve.ts';
import { spotifyToken } from '../_shared/handlers.ts';
serveUser((uid, _b, ctx) => spotifyToken(uid, ctx));
