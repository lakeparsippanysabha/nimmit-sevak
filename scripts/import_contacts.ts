import { createClient } from '@supabase/supabase-js';
import { readFileSync, createReadStream, existsSync } from 'fs';
import { parse } from 'csv-parse';
import path from 'path';

// Helper to normalize phone numbers (digits only, last 10 digits for US numbers)
function normalizePhone(phone: string | null | undefined): string {
  if (!phone) return '';
  const digits = phone.replace(/\D/g, '');
  if (digits.length === 11 && digits.startsWith('1')) {
    return digits.substring(1);
  }
  return digits;
}

// Helper to format names nicely if they are all caps or all lowercase
function formatName(name: string | null | undefined): string {
  if (!name) return '';
  const trimmed = name.trim();
  if (!trimmed) return '';
  // Check if all uppercase or all lowercase
  if (trimmed === trimmed.toUpperCase() || trimmed === trimmed.toLowerCase()) {
    return trimmed
      .toLowerCase()
      .replace(/(?:^|\s|-|')\S/g, (match) => match.toUpperCase());
  }
  return trimmed;
}

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
  console.log('✅ Logged in successfully.');

  // 1. Fetch all existing contacts from the DB with pagination
  console.log('Fetching all existing contacts from database...');
  let dbContacts: any[] = [];
  let dbStart = 0;
  const PAGE_SIZE = 1000;

  while (true) {
    const { data, error } = await supabase
      .from('contacts')
      .select('*')
      .range(dbStart, dbStart + PAGE_SIZE - 1)
      .order('id');

    if (error) {
      console.error('❌ Error fetching contacts:', error.message);
      return;
    }
    if (!data || data.length === 0) {
      break;
    }
    dbContacts = dbContacts.concat(data);
    if (data.length < PAGE_SIZE) {
      break;
    }
    dbStart += PAGE_SIZE;
  }
  console.log(`✅ Fetched ${dbContacts.length} existing contacts.`);

  // Create lookup map for existing DB contacts
  const dbMap = new Map<string, any>();
  for (const contact of dbContacts) {
    const fn = (contact.first_name || '').trim().toLowerCase();
    const ln = (contact.last_name || '').trim().toLowerCase();
    const phone = normalizePhone(contact.cellphone);
    const key = `${fn}|${ln}|${phone}`;
    dbMap.set(key, contact);
  }

  // 2. Parse and normalize CSV records in-memory, deduplicating them
  console.log('Parsing CSV...');
  const csvMap = new Map<string, any>();
  let totalCsvLines = 0;

  const parser = createReadStream(contactsFilePath).pipe(
    parse({
      columns: true,
      skip_empty_lines: true,
      trim: true
    })
  );

  for await (const record of parser) {
    totalCsvLines++;
    const first_name = formatName(record.first_name);
    const last_name = formatName(record.last_name);
    
    // Parse age safely
    let age: number | null = null;
    if (record.age) {
      const parsedAge = parseInt(record.age, 10);
      if (!isNaN(parsedAge)) {
        age = parsedAge;
      }
    }

    const row = {
      first_name,
      last_name,
      nickname: record.nickname ? formatName(record.nickname) : null,
      gender: record.gender ? record.gender.trim() : null,
      age,
      email: record.email ? record.email.trim() : null,
      cellphone: record.cellphone ? record.cellphone.trim() : null,
      member_type: record.member_type ? record.member_type.trim() : null,
      address1: record.address1 ? record.address1.trim() : null,
      address2: record.address2 ? record.address2.trim() : null,
      city: record.city ? record.city.trim() : null,
      county: record.county ? record.county.trim() : null,
      state: record.state ? record.state.trim() : null,
      zip: record.zip ? record.zip.trim() : null,
      country: record.country ? record.country.trim() : null,
      followup: record.followup ? record.followup.trim() : null,
      mandal: record.mandal ? record.mandal.trim() : null,
      notes: record.notes ? record.notes.trim() : null,
      avatar_url: 'https://iamakshar.com/wp-content/uploads/2020/05/Logo-460x-300x300.png'
    };

    const fnKey = first_name.toLowerCase();
    const lnKey = last_name.toLowerCase();
    const phoneKey = normalizePhone(row.cellphone);
    const key = `${fnKey}|${lnKey}|${phoneKey}`;

    if (csvMap.has(key)) {
      // Merge records in the CSV itself
      const existingRow = csvMap.get(key);
      const merged = { ...existingRow };

      // Overwrite/update empty fields
      for (const field of Object.keys(row) as Array<keyof typeof row>) {
        if (!merged[field] && row[field]) {
          merged[field] = row[field] as any;
        }
      }

      // Concatenate notes and followups
      if (row.notes && row.notes.trim() && merged.notes !== row.notes) {
        merged.notes = merged.notes ? `${merged.notes.trim()}\n${row.notes.trim()}` : row.notes.trim();
      }
      if (row.followup && row.followup.trim() && merged.followup !== row.followup) {
        merged.followup = merged.followup ? `${merged.followup.trim()}\n${row.followup.trim()}` : row.followup.trim();
      }

      csvMap.set(key, merged);
    } else {
      csvMap.set(key, row);
    }
  }

  console.log(`📦 Parsed ${totalCsvLines} lines from CSV. Unique records in CSV: ${csvMap.size}`);

  // 3. Process into updates vs inserts
  const updatesToDb: any[] = [];
  const insertsToDb: any[] = [];

  for (const [key, csvRow] of csvMap.entries()) {
    if (dbMap.has(key)) {
      // Merging with existing DB record
      const dbRecord = dbMap.get(key);
      const merged = { ...dbRecord };

      // Only update fields with non-empty CSV values
      for (const field of Object.keys(csvRow) as Array<keyof typeof csvRow>) {
        if (csvRow[field] !== null && csvRow[field] !== undefined && csvRow[field] !== '') {
          merged[field] = csvRow[field];
        }
      }

      // Concatenate notes and followups
      if (csvRow.notes && csvRow.notes.trim()) {
        const csvNotes = csvRow.notes.trim();
        if (!dbRecord.notes) {
          merged.notes = csvNotes;
        } else if (!dbRecord.notes.includes(csvNotes)) {
          merged.notes = `${dbRecord.notes.trim()}\n${csvNotes}`;
        }
      }

      if (csvRow.followup && csvRow.followup.trim()) {
        const csvFollowup = csvRow.followup.trim();
        if (!dbRecord.followup) {
          merged.followup = csvFollowup;
        } else if (!dbRecord.followup.includes(csvFollowup)) {
          merged.followup = `${dbRecord.followup.trim()}\n${csvFollowup}`;
        }
      }

      updatesToDb.push(merged);
    } else {
      insertsToDb.push(csvRow);
    }
  }

  console.log(`📊 Processing plan:`);
  console.log(`- New contacts to insert: ${insertsToDb.length}`);
  console.log(`- Existing contacts to update: ${updatesToDb.length}`);

  // 4. Batch DB operations
  const BATCH_SIZE = 100;

  // Insert batch
  if (insertsToDb.length > 0) {
    console.log(`Inserting ${insertsToDb.length} new contacts in batches of ${BATCH_SIZE}...`);
    for (let i = 0; i < insertsToDb.length; i += BATCH_SIZE) {
      const batch = insertsToDb.slice(i, i + BATCH_SIZE);
      const { error } = await supabase
        .from('contacts')
        .insert(batch);

      if (error) {
        console.error(`❌ Error inserting batch ${i / BATCH_SIZE + 1}:`, error.message);
      } else {
        console.log(`✅ Inserted batch ${i / BATCH_SIZE + 1} / ${Math.ceil(insertsToDb.length / BATCH_SIZE)}`);
      }
    }
  }

  // Update batch
  if (updatesToDb.length > 0) {
    console.log(`Updating ${updatesToDb.length} existing contacts in batches of ${BATCH_SIZE}...`);
    for (let i = 0; i < updatesToDb.length; i += BATCH_SIZE) {
      const batch = updatesToDb.slice(i, i + BATCH_SIZE);
      // Upsert without onConflict works by matching matching ID since we provided dbRecord.id
      const { error } = await supabase
        .from('contacts')
        .upsert(batch);

      if (error) {
        console.error(`❌ Error updating batch ${i / BATCH_SIZE + 1}:`, error.message);
      } else {
        console.log(`✅ Updated batch ${i / BATCH_SIZE + 1} / ${Math.ceil(updatesToDb.length / BATCH_SIZE)}`);
      }
    }
  }

  console.log('\n✨ Contacts import completed successfully!');
}

importContacts().catch(console.error);
