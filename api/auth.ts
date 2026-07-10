import { createClient } from '@supabase/supabase-js';

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

const supabaseUrl = getEnv('SUPABASE_URL', 'VITE_SUPABASE_URL');
const supabaseAnonKey = getEnv('SUPABASE_ANON_KEY', 'VITE_SUPABASE_ANON_KEY');

const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: { persistSession: false }
});

export default async function authHandler(req: any, res: any) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization, Cookie');
  res.setHeader('Access-Control-Expose-Headers', 'set-auth-jwt');

  if (req.method === 'OPTIONS') {
    res.statusCode = 200;
    return res.end();
  }

  const url = req.url || '';

  try {
    let body: any = {};
    if (req.method === 'POST') {
      body = await new Promise((resolve, reject) => {
        let data = '';
        req.on('data', (chunk: Buffer) => { data += chunk.toString(); });
        req.on('end', () => {
          try { resolve(data ? JSON.parse(data) : {}); } catch (e) { resolve({}); }
        });
        req.on('error', reject);
      });
    }

    if (url.includes('/api/auth/sign-up/email')) {
      const { email, password, name } = body;
      const { data, error } = await supabase.auth.signUp({
        email,
        password,
        options: { data: { name } }
      });

      if (error) throw error;
      
      const token = data.session?.access_token || '';
      res.setHeader('set-auth-jwt', token);
      res.statusCode = 200;
      return res.end(JSON.stringify({ user: data.user, session: { token } }));
    }

    if (url.includes('/api/auth/sign-in/email')) {
      const { email, password } = body;
      const { data, error } = await supabase.auth.signInWithPassword({
        email,
        password
      });

      if (error) throw error;

      const token = data.session?.access_token || '';
      res.setHeader('set-auth-jwt', token);
      res.statusCode = 200;
      return res.end(JSON.stringify({ user: data.user, session: { token } }));
    }

    if (url.includes('/api/auth/get-session')) {
      const authHeader = req.headers.authorization || '';
      const token = authHeader.replace('Bearer ', '');
      if (!token) {
        res.statusCode = 401;
        return res.end(JSON.stringify({ error: 'No token' }));
      }
      
      const { data, error } = await supabase.auth.getUser(token);
      if (error || !data.user) {
        res.statusCode = 401;
        return res.end(JSON.stringify({ error: 'Invalid token' }));
      }

      res.setHeader('set-auth-jwt', token);
      res.statusCode = 200;
      return res.end(JSON.stringify({ user: data.user, session: { token } }));
    }

    res.statusCode = 404;
    res.end(JSON.stringify({ error: 'Not found' }));
  } catch (error: any) {
    console.error('Custom Auth Error:', error);
    res.statusCode = error.status || 500;
    res.end(JSON.stringify({ error: 'Internal Server Error', details: error?.message }));
  }
}
