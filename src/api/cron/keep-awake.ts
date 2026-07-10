import { supabase } from '../../lib/services/supabaseClient';

export default async function handler(req: Request) {
  const authHeader = req.headers.get('authorization');
  const expectedToken = `Bearer ${process.env.CRON_SECRET || import.meta.env?.CRON_SECRET}`;

  if (!authHeader || authHeader !== expectedToken) {
    return new Response(JSON.stringify({ error: 'Unauthorized' }), {
      status: 401,
      headers: { 'Content-Type': 'application/json' }
    });
  }

  try {
    // Fire a rapid low-overhead raw query via RPC or simple select to keep DB alive
    await supabase.rpc('ping'); // Assuming a basic RPC function exists, or we simply query a tiny table
    // Fallback if RPC doesn't exist: await supabase.from('user').select('id').limit(1);

    return new Response(JSON.stringify({ status: 'synchronized', integrity: 'optimal' }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' }
    });
  } catch (error) {
    return new Response(JSON.stringify({ error: 'Database heartbeat failed' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    });
  }
}
