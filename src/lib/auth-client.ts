import { supabase } from './services/supabaseClient';

const baseURL = import.meta.env.VITE_AUTH_MODE === 'live' ? window.location.origin : 'http://localhost:5173';

const syncToken = async (res: Response) => {
  const jwtToken = res.headers.get("set-auth-jwt");
  if (jwtToken) {
    localStorage.setItem("custom_auth_token", jwtToken);
    await supabase.auth.setSession({
      access_token: jwtToken,
      refresh_token: ""
    });
  }
};

const getHeaders = () => {
  const token = localStorage.getItem("custom_auth_token");
  return {
    'Content-Type': 'application/json',
    ...(token ? { 'Authorization': `Bearer ${token}` } : {})
  };
};

export const authClient = {
  signUp: {
    email: async (payload: any) => {
      try {
        const res = await fetch(`${baseURL}/api/auth/sign-up/email`, {
          method: 'POST',
          headers: getHeaders(),
          body: JSON.stringify(payload)
        });
        await syncToken(res);
        if (!res.ok) {
          const err = await res.json();
          return { data: null, error: { message: err.error || 'Sign up failed' } };
        }
        return { data: await res.json(), error: null };
      } catch (err: any) {
        return { data: null, error: { message: err.message } };
      }
    }
  },
  signIn: {
    email: async (payload: any) => {
      try {
        const res = await fetch(`${baseURL}/api/auth/sign-in/email`, {
          method: 'POST',
          headers: getHeaders(),
          body: JSON.stringify(payload)
        });
        await syncToken(res);
        if (!res.ok) {
          const err = await res.json();
          return { data: null, error: { message: err.error || 'Sign in failed' } };
        }
        return { data: await res.json(), error: null };
      } catch (err: any) {
        return { data: null, error: { message: err.message } };
      }
    }
  },
  getSession: async () => {
    try {
      const res = await fetch(`${baseURL}/api/auth/get-session`, {
        method: 'GET',
        headers: getHeaders()
      });
      await syncToken(res);
      if (!res.ok) return { data: null, error: { message: 'No session' } };
      return { data: await res.json(), error: null };
    } catch (err: any) {
      return { data: null, error: { message: err.message } };
    }
  },
  signOut: async () => {
    localStorage.removeItem("custom_auth_token");
    await supabase.auth.signOut();
    return { error: null };
  }
};
