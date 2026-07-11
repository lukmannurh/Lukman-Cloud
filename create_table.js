import postgres from 'postgres';

const sql = postgres(process.env.DATABASE_URL);

async function main() {
  try {
    console.log('Creating storage_nodes table...');
    await sql`
      CREATE TABLE IF NOT EXISTS storage_nodes (
        id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
        user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
        provider TEXT NOT NULL,
        channel_id TEXT NOT NULL,
        bot_token TEXT,
        created_at TIMESTAMPTZ DEFAULT NOW(),
        UNIQUE(user_id, provider)
      );
    `;

    console.log('Enabling Row Level Security...');
    await sql`ALTER TABLE storage_nodes ENABLE ROW LEVEL SECURITY;`;

    console.log('Creating policies...');
    try {
        await sql`
        CREATE POLICY "Users can manage their own storage nodes"
        ON storage_nodes
        FOR ALL
        USING (auth.uid() = user_id)
        WITH CHECK (auth.uid() = user_id);
        `;
    } catch(e) {
        if (!e.message.includes('already exists')) throw e;
    }

    console.log('Table and policies created successfully!');
  } catch (err) {
    console.error('Error:', err);
  } finally {
    await sql.end();
  }
}

main();
