const postgres = require('postgres');
const sql = postgres('postgresql://postgres:zJ$uC9%23xH!2aM7@aws-0-ap-southeast-1.pooler.supabase.com:5432/postgres', { ssl: 'require' });

async function check() {
  const tables = await sql`SELECT table_name FROM information_schema.tables WHERE table_schema = 'public'`;
  console.log(tables);
  process.exit(0);
}
check();
