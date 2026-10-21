import { serveUser } from '../_shared/serve.ts';
import { appleDeveloperToken } from '../_shared/handlers.ts';
serveUser((_uid, _b, ctx) => appleDeveloperToken(ctx));
