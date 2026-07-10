import { betterAuth } from 'better-auth';
import { username } from 'better-auth/plugins';
import { supabase } from './services/supabaseClient';

const getEnv = (nodeKey: string, viteKey: string): string => {
  if (typeof process !== 'undefined' && process.env && process.env[nodeKey]) {
    return process.env[nodeKey] as string;
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
  database: {
  },
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
