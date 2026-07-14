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
      
      let desiredUsername = mappedUser.username || mappedUser.email?.split('@')[0] || `user_${Date.now()}`;
      
      const { data: conflictUser } = await supabase
        .from('user')
        .select('id')
        .eq('username', desiredUsername)
        .neq('id', mappedUser.id)
        .maybeSingle();
        
      if (conflictUser) {
        desiredUsername = `${desiredUsername}_${Math.random().toString(36).slice(-6)}`;
      }

      // Phase 2: Enforce Public User Schema Sync to satisfy vfs_nodes_user_id_fkey
      // Await the upsert into the public 'user' table before returning to prevent VFS race conditions
      const { error: upsertError } = await supabase.from('user').upsert({
        id: mappedUser.id,
        email: mappedUser.email,
        name: mappedUser.name || mappedUser.email?.split('@')[0] || 'Unknown User',
        username: desiredUsername,
        image: mappedUser.image || null,
        emailVerified: true,
        createdAt: mappedUser.createdAt || new Date().toISOString(),
        updatedAt: mappedUser.updatedAt || new Date().toISOString()
      }, { onConflict: 'id' });

      if (upsertError) {
        console.error("Failed to sync public user schema:", upsertError);
        // Continue but log the failure which caused the 400 Bad Request
      }
      
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
