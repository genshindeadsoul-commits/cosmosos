import { serveUser } from '../_shared/serve.ts';
import { calendarImport } from '../_shared/handlers.ts';
serveUser((uid, _b, ctx) => calendarImport(uid, ctx));
