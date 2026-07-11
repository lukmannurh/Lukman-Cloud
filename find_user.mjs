import postgres from 'postgres';
const sql = postgres('postgresql://postgres:bijionta007@db.nroenitdtpfpmcdvchnt.supabase.co:5432/postgres');

async function main() {
  const users = await sql`SELECT email, raw_user_meta_data FROM auth.users ORDER BY created_at DESC LIMIT 10`;
  console.log(users);
  process.exit(0);
}
main();
