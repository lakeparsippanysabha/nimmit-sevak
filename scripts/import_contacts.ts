import { createClient } from '@supabase/supabase-js';
import { readFileSync, createReadStream, existsSync } from 'fs';
import { parse } from 'csv-parse';
import path from 'path';

// Read local .env file because this script runs outside Vite
const env = readFileSync('.env', 'utf8');
const matchUrl = env.match(/VITE_SUPABASE_URL=(.*)/);
const matchKey = env.match(/VITE_SUPABASE_ANON_KEY=(.*)/);

const supabaseUrl = matchUrl ? matchUrl[1].trim() : '';
const supabaseKey = matchKey ? matchKey[1].trim() : '';

const supabase = createClient(supabaseUrl, supabaseKey);

async function importContacts() {
  const filePathArg = process.argv[2];
  const contactsFilePath = path.resolve(filePathArg || 'data/contacts.csv');

  console.log(`🚀 Starting import process for: ${contactsFilePath}`);
  
  if (!existsSync(contactsFilePath)) {
    console.error(`❌ Error: File not found at ${contactsFilePath}`);
    console.log('Usage: npx tsx scripts/import_contacts.ts [path/to/your/file.csv]');
    return;
  }

  console.log('Logging in to Supabase...');
  const { error: loginError } = await supabase.auth.signInWithPassword({
    email: 'superadmin@example.com',
    password: 'Password123!',
  });

  if (loginError) {
    console.error('❌ Failed to login:', loginError.message);
    return;
  }

  console.log('✅ Logged in successfully. Parsing CSV...');
  const records: any[] = [];
  
  const parser = createReadStream(contactsFilePath).pipe(
    parse({
      columns: true,
      skip_empty_lines: true,
      trim: true
    })
  );

  for await (const record of parser) {
    // Map CSV columns to database columns (snake_case)
    const row = {
      first_name: record.first_name,
      last_name: record.last_name,
      nickname: record.nickname || null,
      gender: record.gender || null,
      age: record.age ? parseInt(record.age) : null,
      email: record.email || null,
      cellphone: record.cellphone || null,
      member_type: record.member_type || null,
      address1: record.address1 || null,
      address2: record.address2 || null,
      city: record.city || null,
      county: record.county || null,
      state: record.state || null,
      zip: record.zip || null,
      country: record.country || null,
      followup: record.followup || null,
      mandal: record.mandal || null,
      notes: record.notes || null,
      avatar_url: 'https://iamakshar.com/wp-content/uploads/2020/05/Logo-460x-300x300.png'
    };
    records.push(row);
  }

  console.log(`📦 Found ${records.length} records in CSV. Starting batch import...`);

  // Batch insert
  const BATCH_SIZE = 50;
  for (let i = 0; i < records.length; i += BATCH_SIZE) {
    const batch = records.slice(i, i + BATCH_SIZE);
    
    const { error: upsertError } = await supabase
      .from('contacts')
      .upsert(batch, { 
        onConflict: 'first_name,last_name,cellphone' 
      });
      
    if (upsertError) {
      console.error(`❌ Error upserting batch ${i / BATCH_SIZE + 1}:`, upsertError.message);
    } else {
      console.log(`✅ Upserted batch ${i / BATCH_SIZE + 1} / ${Math.ceil(records.length / BATCH_SIZE)}`);
    }
  }

  console.log('\n✨ Contacts import completed successfully!');
}

importContacts().catch(console.error);
