import { createClient } from '@supabase/supabase-js';
import { readFileSync } from 'fs';
import { generateMockContacts } from '../src/data/mockContacts.js';

// Read local .env file because this script runs outside Vite
const env = readFileSync('.env', 'utf8');
const matchUrl = env.match(/VITE_SUPABASE_URL=(.*)/);
const matchKey = env.match(/VITE_SUPABASE_ANON_KEY=(.*)/);

const supabaseUrl = matchUrl ? matchUrl[1].trim() : '';
const supabaseKey = matchKey ? matchKey[1].trim() : '';

const supabase = createClient(supabaseUrl, supabaseKey);

async function seed() {
  console.log('Logging in as superadmin to bypass RLS for inserts...');
  const { error: loginError } = await supabase.auth.signInWithPassword({
    email: 'superadmin@example.com',
    password: 'Password123!',
  });

  if (loginError) {
    console.error('Failed to login:', loginError.message);
    return;
  }

  console.log('Logged in successfully. Generating mock contacts...');
  
  // Notice we generate 100 to avoid overloading the free-tier Supabase
  // while keeping it virtualized properly.
  const mockContacts = generateMockContacts(250); 
  
  const rows = mockContacts.map(c => ({
    first_name: c.firstName,
    last_name: c.lastName,
    avatar_url: c.avatarUrl,
    company: c.company,
    job_title: c.jobTitle,
    notes: c.notes,
    fields: c.fields
  }));

  console.log('Inserting into public.contacts in batches of 50...');
  
  const BATCH_SIZE = 50;
  for (let i = 0; i < rows.length; i += BATCH_SIZE) {
    const batch = rows.slice(i, i + BATCH_SIZE);
    
    const { error: insertError } = await supabase
      .from('contacts')
      .insert(batch);
      
    if (insertError) {
      console.error(`Error inserting batch ${i / BATCH_SIZE + 1}:`, insertError.message);
    } else {
      console.log(`Inserted batch ${i / BATCH_SIZE + 1} / ${Math.ceil(rows.length / BATCH_SIZE)} ✅`);
    }
  }

  console.log('✅ Contacts seeding completed!');
}

seed().catch(console.error);
