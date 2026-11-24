// Cloudflare Pages Function: every request under /lna comes here.
// The app itself lives in /lna (outside this folder) so it stays readable.
import { handle } from "../../lna/server/router.js";

export const onRequest = (context) => handle(context);
