import { betterAuth } from 'better-auth';
import { toNodeHandler } from "better-auth/node";
import { username } from 'better-auth/plugins';

export const config = {
  api: {
    bodyParser: false,
  },
};

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
    console.log('[Better Auth Debug] Request received:', req.method, req.url);
    console.log('[Better Auth Debug] Creating toNodeHandler...');
    const handler = toNodeHandler(auth);
    
    console.log('[Better Auth Debug] Awaiting handler...');
    // We race the handler against a timeout!
    const timeout = new Promise((resolve, reject) => setTimeout(() => reject(new Error('Handler Timed Out')), 5000));
    
    await Promise.race([handler(req, res), timeout]);
    console.log('[Better Auth Debug] Handler resolved!');
    
    if (!res.writableEnded) {
      console.log('[Better Auth Debug] Response not ended by handler. Writing 404...');
      res.statusCode = 404;
      res.end(JSON.stringify({ error: 'Not Handled by BetterAuth', url: req.url, headers: req.headers }));
    }
  } catch (error: any) {
    console.error('[Better Auth] Critical Node Error:', error);
    if (!res.writableEnded) {
      res.statusCode = 500;
      res.end(JSON.stringify({ error: 'Internal Server Error', details: error?.message || String(error), stack: error?.stack }));
    }
  }
}
