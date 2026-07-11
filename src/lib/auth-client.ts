import { supabase } from './services/supabaseClient';
import { useState, useEffect } from 'react';

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
  useSession: () => {
    const [data, setData] = useState<{ user: any, session: any } | null>(null);
    const [isPending, setIsPending] = useState(true);
    const [error, setError] = useState<any>(null);

    useEffect(() => {
      authClient.getSession().then((res) => {
        setData(res.data);
        setError(res.error);
        setIsPending(false);
      });
    }, []);

    return { data, isPending, error };
  },
  signUp: {
    email: async (payload: any) => {
      try {
        const { data, error } = await supabase.auth.signUp({
          email: payload.email,
          password: payload.password,
          options: {
            data: {
              name: payload.name,
              username: payload.username,
            }
          }
        });
        if (error) throw error;
        return { data, error: null };
      } catch (err: any) {
        return { data: null, error: { message: err.message } };
      }
    }
  },
  signIn: {
    email: async (payload: any) => {
      try {
        const { data, error } = await supabase.auth.signInWithPassword({
          email: payload.email,
          password: payload.password,
        });
        if (error) throw error;
        return { data, error: null };
      } catch (err: any) {
        return { data: null, error: { message: err.message } };
      }
    },
    social: async (payload: { provider: any, callbackURL?: string }) => {
      const { error } = await supabase.auth.signInWithOAuth({
        provider: payload.provider,
        options: { redirectTo: payload.callbackURL || window.location.origin }
      });
      return { error: error ? { message: error.message } : null };
    }
  },
  getSession: async () => {
    try {
      const { data: { session }, error } = await supabase.auth.getSession();
      if (error || !session) return { data: null, error: { message: 'No session' } };
      
      // Map Supabase user metadata to top-level properties for Better Auth compatibility
      const mappedUser = {
        ...session.user,
        name: session.user.user_metadata?.name,
        username: session.user.user_metadata?.username,
        image: session.user.user_metadata?.avatar_url
      };
      
      return { data: { user: mappedUser, session }, error: null };
    } catch (err: any) {
      return { data: null, error: { message: err.message } };
    }
  },
  updateUser: async (payload: any) => {
    try {
      const { data, error } = await supabase.auth.updateUser({
        data: payload
      });
      if (error) throw error;
      return { data, error: null };
    } catch (err: any) {
      return { data: null, error: { message: err.message } };
    }
  },
  signOut: async () => {
    await supabase.auth.signOut();
    return { error: null };
  }
};
