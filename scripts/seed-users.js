import { createClient } from '@supabase/supabase-js';
import { readFileSync } from 'fs';

const env = readFileSync('.env', 'utf8');
const matchUrl = env.match(/VITE_SUPABASE_URL=(.*)/);
const matchKey = env.match(/VITE_SUPABASE_ANON_KEY=(.*)/);
const supabase = createClient(matchUrl[1].trim(), matchKey[1].trim());

const usersToCreate = [
  { email: 'superadmin@test.com', role: 'Super Admin' },
  { email: 'admin@test.com', role: 'Admin' },
  { email: 'user@test.com', role: 'User' },
  { email: 'guest@test.com', role: 'Guest' },
];

async function seed() {
  console.log('Seeding 4 test users for Role-Based Access Control...');

  for (const u of usersToCreate) {
    console.log(`\n1. Creating user: ${u.email}`);
    
    const { data: { user }, error: signupError } = await supabase.auth.signUp({
      email: u.email,
      password: 'Password123!',
    });

    if (signupError) {
      console.error(`❌ Failed to sign up ${u.email}`);
      console.error(`Reason: ${signupError.message}`);
      if (signupError.message.includes('Database error')) {
        console.error('CRITICAL: The SQL migration script has not been run in Supabase SQL Editor.');
        return; // Stop execution if DB schema is missing
      }
      continue;
    }

    console.log(`✅ User signed up successfully (ID: ${user?.id})`);

    // The trigger created the profile as 'Guest'. If role is different, update it.
    if (u.role !== 'Guest' && user) {
      console.log(`2. Updating role to ${u.role} in profiles table...`);
      // Warning: This works because our RLS policy allows users to update their own profile row.
      const { error: updateError } = await supabase
        .from('profiles')
        .update({ role: u.role })
        .eq('id', user.id);

      if (updateError) {
        console.error(`❌ Failed to set role for ${u.email}:`, updateError.message);
      } else {
        console.log(`✅ Successfully set role to ${u.role}`);
      }
    }

    // Sign out before creating the next user
    await supabase.auth.signOut();
  }
  
  console.log('\n🎉 Finished seeding test users!');
}

seed().catch(console.error);
