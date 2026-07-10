import { betterAuth } from 'better-auth';
import { toNodeHandler } from "better-auth/node";
import { username } from 'better-auth/plugins';

const getEnv = (nodeKey: string, viteKey: string): string => {
  if (typeof process !== 'undefined' && process.env) {
    if (process.env[nodeKey]) return process.env[nodeKey] as string;
    if (process.env[viteKey]) return process.env[viteKey] as string;
  }
  // @ts-ignore
  if (typeof import.meta !== 'undefined' && import.meta.env && import.meta.env[viteKey]) {
    // @ts-ignore
    return import.meta.env[viteKey] as string;
  }
  return "";
};

export let auth: any = null;
try {
  auth = betterAuth({
    secret: getEnv('BETTER_AUTH_SECRET', 'VITE_BETTER_AUTH_SECRET'),
    baseURL: getEnv('BETTER_AUTH_URL', 'VITE_BETTER_AUTH_URL'),
    database: {
      // Dummy adapter
      dialect: { name: 'postgres' },
      create: async () => ({}),
      findOne: async () => null,
      findMany: async () => [],
      update: async () => ({}),
      delete: async () => ({}),
      deleteMany: async () => 0,
    } as any,
    emailAndPassword: {
      enabled: true,
    },
    plugins: [
      username()
    ],
    socialProviders: {
      google: {
        clientId: getEnv('GOOGLE_CLIENT_ID', 'VITE_GOOGLE_CLIENT_ID') || getEnv('VITE_APP_GOOGLE_CLIENT_ID', 'VITE_APP_GOOGLE_CLIENT_ID'),
        clientSecret: getEnv('GOOGLE_CLIENT_SECRET', 'VITE_GOOGLE_CLIENT_SECRET'),
        scope: ["https://www.googleapis.com/auth/drive.file"]
      }
    }
  });
} catch (err: any) {
  console.error("[BetterAuth INIT ERROR]:", err);
  auth = {
    options: {},
    handler: async (req: any, res: any) => {
      res.statusCode = 500;
      res.end(JSON.stringify({ error: 'BetterAuth Init Failed', details: err?.message || String(err), stack: err?.stack }));
    },
    api: {
      signInSocial: async () => { throw new Error("BetterAuth Init Failed: " + err.message) }
    }
  };
}

export default async function authHandler(req: any, res: any) {
  try {
    if (typeof process !== 'undefined' && !process.env?.GOOGLE_CLIENT_SECRET) {
      console.warn('[Better Auth] WARNING: Missing GOOGLE_CLIENT_SECRET in server environment. OAuth will fail.');
    }
    
    const handler = toNodeHandler(auth);
    return await handler(req, res);
  } catch (error: any) {
    console.error('[Better Auth] Critical Serverless Error:', error);
    res.statusCode = 500;
    res.end(JSON.stringify({ error: 'Internal Server Error', details: error?.message || String(error), stack: error?.stack }));
  }
}
