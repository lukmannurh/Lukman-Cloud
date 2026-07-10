import { betterAuth } from 'better-auth';
import { username } from 'better-auth/plugins';
import { supabase } from './services/supabaseClient';
import pg from 'pg';
const { Pool } = pg;

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

export const auth = betterAuth({
  secret: getEnv('BETTER_AUTH_SECRET', 'VITE_BETTER_AUTH_SECRET'),
  baseURL: getEnv('BETTER_AUTH_URL', 'VITE_BETTER_AUTH_URL'),
  database: new Pool({
    connectionString: getEnv('SUPABASE_URL', 'VITE_SUPABASE_URL').replace('https://', 'postgres://postgres:').replace('.supabase.co', '.supabase.co:6543/postgres'), // Rough fallback, really needs SUPABASE_DB_URL
  }),
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
