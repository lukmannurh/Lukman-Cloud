import { toNodeHandler } from "better-auth/node";
import { auth } from "../src/lib/auth";

const handler = toNodeHandler(auth);

export default async function authHandler(req: any, res: any) {
  try {
    if (typeof process !== 'undefined' && !process.env?.GOOGLE_CLIENT_SECRET) {
      console.warn('[Better Auth] WARNING: Missing GOOGLE_CLIENT_SECRET in server environment. OAuth will fail.');
    }
    return await handler(req, res);
  } catch (error: any) {
    console.error('[Better Auth] Critical Serverless Error:', error);
    res.statusCode = 500;
    res.end(JSON.stringify({ error: 'Internal Server Error', details: error?.message || String(error) }));
  }
}
