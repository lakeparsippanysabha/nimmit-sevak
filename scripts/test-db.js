import { createClient } from '@supabase/supabase-js';
import { readFileSync } from 'fs';

const env = readFileSync('.env', 'utf8');
const matchUrl = env.match(/VITE_SUPABASE_URL=(.*)/);
const matchKey = env.match(/VITE_SUPABASE_ANON_KEY=(.*)/);

const supabaseUrl = matchUrl ? matchUrl[1].trim() : '';
const supabaseKey = matchKey ? matchKey[1].trim() : '';

const supabase = createClient(supabaseUrl, supabaseKey);

async function testConnection() {
  console.log('Testing Supabase connection...');
  
  // 1. Try to sign up a test user to see the exact error
  const testEmail = `test_${Date.now()}@example.com`;
  console.log(`Attempting to sign up: ${testEmail}`);
  
  const { data, error } = await supabase.auth.signUp({
    email: testEmail,
    password: 'TestPassword123!',
  });
  
  if (error) {
    console.error('SIGNUP ERROR:');
    console.error(error.message);
    if (error.message.includes('Database error saving new user')) {
      console.error('-> This usually means a Database Trigger failed! Did you run the SQL migration script?');
    }
  } else {
    console.log('Signup SUCCESS! User ID:', data.user?.id);
    console.log('Wait, is email confirmation required? user.identities:', data.user?.identities);
  }
}

testConnection().catch(console.error);
