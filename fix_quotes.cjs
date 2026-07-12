const fs = require('fs');
let data = fs.readFileSync('src/App.tsx', 'utf8');
data = data.replace(/\.from\('"user"'\)/g, `.from('user')`);
data = data.replace(/const { data: userProfile, error: profileError } = await supabase\s*\n\s*\.from\('user'\)\.upsert\(\{/g, `const { error: dbErr } = await supabase.from('user').upsert({`);
fs.writeFileSync('src/App.tsx', data);

let bData = fs.readFileSync('src/components/auth/BetterAuthForm.tsx', 'utf8');
bData = bData.replace(/\.from\('"user"'\)/g, `.from('user')`);
fs.writeFileSync('src/components/auth/BetterAuthForm.tsx', bData);
