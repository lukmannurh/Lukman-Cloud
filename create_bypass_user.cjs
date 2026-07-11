const jwt = require('jsonwebtoken');
const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = 'https://nroenitdtpfpmcdvchnt.supabase.co';
const secret = 'FPHqN+n81sXn85v8uS5lQAgCy8da4AzV0TiTOQ4d07/0Rm40nHG1P6Io4IrIIl3RJ8j8PFBjoa3IvpoJGY33+g==';

const serviceRoleToken = jwt.sign(
  {
    role: 'service_role',
    iss: 'supabase',
    iat: Math.floor(Date.now() / 1000),
    exp: Math.floor(Date.now() / 1000) + 3600,
  },
  secret,
  { algorithm: 'HS256' }
);

const supabase = createClient(supabaseUrl, 'sb_publishable_XiZp5ZZIGw7dhwt9-Fyh7A_4XRCeqL8', {
  auth: { autoRefreshToken: false, persistSession: false },
  global: { headers: { Authorization: `Bearer ${serviceRoleToken}` } }
});

async function main() {
  console.log("Creating bypass user...");
  const { data, error } = await supabase.auth.admin.createUser({
    email: 'bypass_user@lukman.cloud',
    password: 'bypass_password123X!',
    user_metadata: { name: 'Bypass User', username: 'bypass_user' },
    email_confirm: true
  });
  
  if (error) {
    console.error("Error creating user:", error);
  } else {
    console.log("User created successfully:", data.user.id);
  }
}

main();
