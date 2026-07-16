import { createClient } from '@supabase/supabase-js';

export default async function handler(req: any, res: any) {
  try {
    const supabaseUrl = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL || '';
    const supabaseKey = process.env.VITE_SUPABASE_ANON_KEY || process.env.SUPABASE_ANON_KEY || '';
    
    if (!supabaseUrl || !supabaseKey) {
      return res.status(500).json({ error: 'Missing Supabase credentials' });
    }

    const supabase = createClient(supabaseUrl, supabaseKey);

    // Lightweight query to keep the Supabase project active
    const { data, error } = await supabase.from('user').select('id').limit(1);

    if (error) {
      console.error('Keep-alive ping failed:', error);
      return res.status(500).json({ error: error.message });
    }

    return res.status(200).json({ success: true, message: 'Keep-alive ping successful', data });
  } catch (err: any) {
    console.error('Keep-alive exception:', err);
    return res.status(500).json({ error: err.message });
  }
}
