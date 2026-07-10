import { betterAuth } from 'better-auth';
import { toNodeHandler } from "better-auth/node";
import { username } from 'better-auth/plugins';
import { jwt } from 'better-auth/plugins';
import { webcrypto } from 'crypto';
import { SignJWT } from 'jose';
import postgres from 'postgres';

// Define our secret key resolver
const getSupabaseSecret = () => {
  const secretStr = process.env.SUPABASE_JWT_SECRET || process.env.VITE_SUPABASE_JWT_SECRET || 'your-super-secret-jwt-token-with-at-least-32-characters-long';
  return new TextEncoder().encode(secretStr);
};

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

let authInstance: any = null;

const getAuth = () => {
  if (authInstance) return authInstance;
  
  try {
    const sql = postgres(getEnv('DATABASE_URL', 'VITE_DATABASE_URL') || "", { ssl: 'require', max: 1 });

    authInstance = betterAuth({
      database: {
        db: sql,
        type: "postgres"
      },
      secret: getEnv('BETTER_AUTH_SECRET', 'VITE_BETTER_AUTH_SECRET') || "fallback-secret-for-dev",
      baseURL: getEnv('BETTER_AUTH_URL', 'VITE_BETTER_AUTH_URL'),
      emailAndPassword: {
        enabled: true,
        hash: async (password) => {
          const encoder = new TextEncoder();
          const data = encoder.encode(password as string);
          const hash = await webcrypto.subtle.digest('SHA-256', data);
          return Array.from(new Uint8Array(hash)).map(b => b.toString(16).padStart(2, '0')).join('');
        },
        verify: async ({ password, hash }) => {
          const encoder = new TextEncoder();
          const data = encoder.encode(password as string);
          const pHash = await webcrypto.subtle.digest('SHA-256', data);
          const pHashStr = Array.from(new Uint8Array(pHash)).map(b => b.toString(16).padStart(2, '0')).join('');
          return pHashStr === hash;
        }
      },
      socialProviders: {
        google: {
          clientId: getEnv('GOOGLE_CLIENT_ID', 'VITE_GOOGLE_CLIENT_ID') || getEnv('VITE_APP_GOOGLE_CLIENT_ID', 'VITE_APP_GOOGLE_CLIENT_ID'),
          clientSecret: getEnv('GOOGLE_CLIENT_SECRET', 'VITE_GOOGLE_CLIENT_SECRET'),
          scope: ["https://www.googleapis.com/auth/drive.file"]
        }
      },
      plugins: [
        username(),
        jwt({
          jwt: {
            expirationTime: '1h',
            definePayload: (session) => {
              return {
                sub: session.user.id,
                role: 'authenticated',
                aud: 'authenticated',
                email: session.user.email,
              };
            },
            sign: async (payload) => {
              return new SignJWT(payload)
                .setProtectedHeader({ alg: 'HS256', typ: 'JWT' })
                .setIssuedAt()
                .setExpirationTime('1h')
                .sign(getSupabaseSecret());
            }
          }
        })
      ]
    });
    return authInstance;
  } catch (err: any) {
    console.error("[BetterAuth INIT ERROR]:", err);
    throw err;
  }
};

export default async function authHandler(req: any, res: any) {
  try {
    console.log('[Better Auth Debug] Request received:', req.method, req.url);
    const auth = getAuth();
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
