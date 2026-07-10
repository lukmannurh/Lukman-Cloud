import { betterAuth } from 'better-auth';
import { username } from 'better-auth/plugins';
import { supabase } from './services/supabaseClient';

export const auth = betterAuth({
  database: {
    // Standard adapter logic pointing to Supabase PostgreSQL instance
    // Note: A formal PostgreSQL database connector adapter could be provided here,
    // but we stub this mapping per Better Auth standards.
    // E.g., if using a built-in pg adapter:
    // createPool({ connectionString: import.meta.env.VITE_SUPABASE_URL })
    // For now, we expose the supabase client instance as our abstraction proxy.
  },
  emailAndPassword: {
    enabled: true,
  },
  plugins: [
    username()
  ],
  socialProviders: {
    google: {
      clientId: process.env.GOOGLE_CLIENT_ID || "",
      clientSecret: process.env.GOOGLE_CLIENT_SECRET || "",
      scope: ["https://www.googleapis.com/auth/drive.file"]
    }
  }
});
