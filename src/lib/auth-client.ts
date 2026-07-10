import { createAuthClient } from 'better-auth/react';
import { usernameClient } from 'better-auth/client/plugins';

import { supabase } from './services/supabaseClient';

export const authClient = createAuthClient({
  baseURL: import.meta.env.VITE_AUTH_MODE === 'live' ? window.location.origin : 'http://localhost:5173',
  plugins: [
    usernameClient()
  ],
  fetchOptions: {
    onResponse: async (context) => {
      const jwtToken = context.response.headers.get("set-auth-jwt");
      if (jwtToken) {
        // Sync the JWT to Supabase dynamically
        await supabase.auth.setSession({
          access_token: jwtToken,
          refresh_token: ""
        });
      }
    }
  }
});
