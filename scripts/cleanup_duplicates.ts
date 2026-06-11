import { createClient } from '@supabase/supabase-js';
import { readFileSync } from 'fs';

// Helper to normalize phone numbers (digits only, last 10 digits for US numbers)
function normalizePhone(phone: string | null | undefined): string {
  if (!phone) return '';
  const digits = phone.replace(/\D/g, '');
  if (digits.length === 11 && digits.startsWith('1')) {
    return digits.substring(1);
  }
  return digits;
}

const env = readFileSync('.env', 'utf8');
const matchUrl = env.match(/VITE_SUPABASE_URL=(.*)/);
const matchKey = env.match(/VITE_SUPABASE_ANON_KEY=(.*)/);

const supabaseUrl = matchUrl ? matchUrl[1].trim() : '';
const supabaseKey = matchKey ? matchKey[1].trim() : '';

const supabase = createClient(supabaseUrl, supabaseKey);

async function cleanupDuplicates() {
  console.log('🚀 Starting Contacts Cleanup Process with Pagination...');

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

  // Fetch all contacts using pagination
  console.log('Fetching all contacts from database...');
  let contacts: any[] = [];
  let start = 0;
  const PAGE_SIZE = 1000;

  while (true) {
    const { data, error } = await supabase
      .from('contacts')
      .select('*')
      .range(start, start + PAGE_SIZE - 1)
      .order('id');

    if (error) {
      console.error('❌ Error fetching contacts:', error.message);
      return;
    }
    if (!data || data.length === 0) {
      break;
    }
    contacts = contacts.concat(data);
    console.log(`Fetched ${contacts.length} contacts so far...`);
    if (data.length < PAGE_SIZE) {
      break;
    }
    start += PAGE_SIZE;
  }

  console.log(`✅ Completed fetching contacts. Total contacts found: ${contacts.length}`);

  // 2. Group contacts by Name + Cellphone
  const groups: Record<string, typeof contacts> = {};
  for (const contact of contacts) {
    const fn = (contact.first_name || '').trim().toLowerCase();
    const ln = (contact.last_name || '').trim().toLowerCase();
    const phone = normalizePhone(contact.cellphone);
    const key = `${fn}|${ln}|${phone}`;
    if (!groups[key]) {
      groups[key] = [];
    }
    groups[key].push(contact);
  }

  const duplicateGroups = Object.entries(groups).filter(([_, list]) => list.length > 1);

  if (duplicateGroups.length === 0) {
    console.log('✨ No duplicates found. Database is already clean!');
    return;
  }

  console.log(`Found ${duplicateGroups.length} duplicate groups containing duplicates.`);

  // Collect all duplicate IDs and primary IDs
  const duplicateIds: string[] = [];
  const primaryIds: string[] = [];
  const groupMappings: Array<{ primary: any; duplicates: any[] }> = [];

  for (const [_, list] of duplicateGroups) {
    // Sort by created_at ascending to keep the oldest as primary
    list.sort((a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime());
    const primary = list[0];
    const duplicates = list.slice(1);

    primaryIds.push(primary.id);
    duplicates.forEach(d => duplicateIds.push(d.id));
    groupMappings.push({ primary, duplicates });
  }

  console.log(`Analyzing references for ${duplicateIds.length} duplicate records...`);

  // Fetch all referencing tables for duplicates in batches of 100 to avoid query limit issues
  const allAttRecs: any[] = [];
  const allListContacts: any[] = [];
  const allFollowups: any[] = [];
  const allTravelStops: any[] = [];

  const FETCH_BATCH_SIZE = 100;
  for (let i = 0; i < duplicateIds.length; i += FETCH_BATCH_SIZE) {
    const batch = duplicateIds.slice(i, i + FETCH_BATCH_SIZE);
    
    const { data: att } = await supabase.from('attendance_records').select('*').in('contact_id', batch);
    if (att) allAttRecs.push(...att);

    const { data: lst } = await supabase.from('followup_list_contacts').select('*').in('contact_id', batch);
    if (lst) allListContacts.push(...lst);

    const { data: fup } = await supabase.from('contact_followups').select('*').in('contact_id', batch);
    if (fup) allFollowups.push(...fup);

    const { data: trv } = await supabase.from('travel_stops').select('*').in('contact_id', batch);
    if (trv) allTravelStops.push(...trv);
  }

  // Fetch referencing tables for primaries in batches
  const allPrimaryAttRecs: any[] = [];
  const allPrimaryListContacts: any[] = [];
  for (let i = 0; i < primaryIds.length; i += FETCH_BATCH_SIZE) {
    const batch = primaryIds.slice(i, i + FETCH_BATCH_SIZE);

    const { data: att } = await supabase.from('attendance_records').select('*').in('contact_id', batch);
    if (att) allPrimaryAttRecs.push(...att);

    const { data: lst } = await supabase.from('followup_list_contacts').select('*').in('contact_id', batch);
    if (lst) allPrimaryListContacts.push(...lst);
  }

  // Setup maps for quick lookup of primary records
  const primaryAttMap = new Set<string>(); // "primaryId|date"
  allPrimaryAttRecs.forEach(r => {
    primaryAttMap.add(`${r.contact_id}|${r.date}`);
  });

  const primaryListMap = new Set<string>(); // "primaryId|listId"
  allPrimaryListContacts.forEach(r => {
    primaryListMap.add(`${r.contact_id}|${r.list_id}`);
  });

  // Lists of updates and deletes to perform
  const attendanceToDelete: string[] = [];
  const attendanceToUpdate: Array<{ id: string; contact_id: string }> = [];

  const listContactsToDelete: Array<{ list_id: string; contact_id: string }> = [];
  const listContactsToInsert: Array<{ list_id: string; contact_id: string }> = [];

  const followupsToUpdate: Array<{ id: string; contact_id: string }> = [];
  const travelStopsToUpdate: Array<{ id: string; contact_id: string }> = [];

  const contactsToDelete: string[] = [];
  const contactsToUpdate: any[] = [];

  let mergedFieldsCount = 0;

  for (const { primary, duplicates } of groupMappings) {
    const merged = { ...primary };
    let primaryUpdated = false;

    for (const duplicate of duplicates) {
      // 1. Merge fields from duplicate to primary
      const textFields = [
        'nickname', 'gender', 'email', 'member_type', 'address1', 'address2',
        'city', 'county', 'state', 'zip', 'country', 'mandal', 'avatar_url'
      ];

      for (const field of textFields) {
        if (!merged[field] && duplicate[field]) {
          merged[field] = duplicate[field];
          primaryUpdated = true;
          mergedFieldsCount++;
        }
      }

      if (!merged.age && duplicate.age) {
        merged.age = duplicate.age;
        primaryUpdated = true;
        mergedFieldsCount++;
      }

      // Concatenate text notes and followup history if present
      if (duplicate.notes && duplicate.notes.trim()) {
        const dupNotes = duplicate.notes.trim();
        if (!merged.notes) {
          merged.notes = dupNotes;
          primaryUpdated = true;
        } else if (!merged.notes.includes(dupNotes)) {
          merged.notes = `${merged.notes.trim()}\n${dupNotes}`;
          primaryUpdated = true;
        }
      }

      if (duplicate.followup && duplicate.followup.trim()) {
        const dupFollowup = duplicate.followup.trim();
        if (!merged.followup) {
          merged.followup = dupFollowup;
          primaryUpdated = true;
        } else if (!merged.followup.includes(dupFollowup)) {
          merged.followup = `${merged.followup.trim()}\n${dupFollowup}`;
          primaryUpdated = true;
        }
      }

      // 2. Re-link attendance records
      const dupAtt = allAttRecs.filter(r => r.contact_id === duplicate.id);
      for (const r of dupAtt) {
        const key = `${primary.id}|${r.date}`;
        if (primaryAttMap.has(key)) {
          attendanceToDelete.push(r.id);
        } else {
          attendanceToUpdate.push({ id: r.id, contact_id: primary.id });
          primaryAttMap.add(key);
        }
      }

      // 3. Re-link followup list contacts
      const dupList = allListContacts.filter(r => r.contact_id === duplicate.id);
      for (const r of dupList) {
        const key = `${primary.id}|${r.list_id}`;
        if (primaryListMap.has(key)) {
          listContactsToDelete.push({ list_id: r.list_id, contact_id: duplicate.id });
        } else {
          listContactsToDelete.push({ list_id: r.list_id, contact_id: duplicate.id });
          listContactsToInsert.push({ list_id: r.list_id, contact_id: primary.id });
          primaryListMap.add(key);
        }
      }

      // 4. Re-link contact follow-ups
      const dupFollowups = allFollowups.filter(r => r.contact_id === duplicate.id);
      dupFollowups.forEach(r => {
        followupsToUpdate.push({ id: r.id, contact_id: primary.id });
      });

      // 5. Re-link travel stops
      const dupStops = allTravelStops.filter(r => r.contact_id === duplicate.id);
      dupStops.forEach(r => {
        travelStopsToUpdate.push({ id: r.id, contact_id: primary.id });
      });

      contactsToDelete.push(duplicate.id);
    }

    if (primaryUpdated) {
      contactsToUpdate.push(merged);
    }
  }

  console.log('\n📊 Summary of Actions to Perform:');
  console.log(`- Contacts to delete (duplicates): ${contactsToDelete.length}`);
  console.log(`- Contacts to update (primaries with merged fields): ${contactsToUpdate.length}`);
  console.log(`- Fields merged: ${mergedFieldsCount}`);
  console.log(`- Attendance records to delete: ${attendanceToDelete.length}`);
  console.log(`- Attendance records to re-link: ${attendanceToUpdate.length}`);
  console.log(`- Follow-up list contacts to delete: ${listContactsToDelete.length}`);
  console.log(`- Follow-up list contacts to insert: ${listContactsToInsert.length}`);
  console.log(`- Contact followups to re-link: ${followupsToUpdate.length}`);
  console.log(`- Travel stops to re-link: ${travelStopsToUpdate.length}`);

  // Execute database changes
  console.log('\n⌛ Executing changes in database...');

  // 1. Delete conflicting attendance records
  if (attendanceToDelete.length > 0) {
    console.log(`Deleting ${attendanceToDelete.length} conflicting attendance records...`);
    const { error } = await supabase
      .from('attendance_records')
      .delete()
      .in('id', attendanceToDelete);
    if (error) throw new Error(`Failed to delete attendance: ${error.message}`);
  }

  // 2. Re-link attendance records
  if (attendanceToUpdate.length > 0) {
    console.log(`Re-linking ${attendanceToUpdate.length} attendance records...`);
    const { error } = await supabase
      .from('attendance_records')
      .upsert(attendanceToUpdate);
    if (error) throw new Error(`Failed to update attendance: ${error.message}`);
  }

  // 3. Delete list contacts
  if (listContactsToDelete.length > 0) {
    console.log(`Removing ${listContactsToDelete.length} duplicate list contacts...`);
    for (const item of listContactsToDelete) {
      const { error } = await supabase
        .from('followup_list_contacts')
        .delete()
        .eq('list_id', item.list_id)
        .eq('contact_id', item.contact_id);
      if (error) throw new Error(`Failed to delete list contact: ${error.message}`);
    }
  }

  // 4. Insert new list contacts
  if (listContactsToInsert.length > 0) {
    console.log(`Adding ${listContactsToInsert.length} list contacts to primary records...`);
    const { error } = await supabase
      .from('followup_list_contacts')
      .insert(listContactsToInsert);
    if (error) throw new Error(`Failed to insert list contacts: ${error.message}`);
  }

  // 5. Re-link contact follow-ups
  if (followupsToUpdate.length > 0) {
    console.log(`Re-linking ${followupsToUpdate.length} contact follow-ups...`);
    const { error } = await supabase
      .from('contact_followups')
      .upsert(followupsToUpdate);
    if (error) throw new Error(`Failed to update contact follow-ups: ${error.message}`);
  }

  // 6. Re-link travel stops
  if (travelStopsToUpdate.length > 0) {
    console.log(`Re-linking ${travelStopsToUpdate.length} travel stops...`);
    const { error } = await supabase
      .from('travel_stops')
      .upsert(travelStopsToUpdate);
    if (error) throw new Error(`Failed to update travel stops: ${error.message}`);
  }

  // 7. Delete duplicate contacts
  if (contactsToDelete.length > 0) {
    console.log(`Deleting ${contactsToDelete.length} duplicate contacts...`);
    const DELETE_BATCH_SIZE = 100;
    for (let i = 0; i < contactsToDelete.length; i += DELETE_BATCH_SIZE) {
      const batch = contactsToDelete.slice(i, i + DELETE_BATCH_SIZE);
      const { error } = await supabase
        .from('contacts')
        .delete()
        .in('id', batch);
      if (error) throw new Error(`Failed to delete contacts batch: ${error.message}`);
    }
  }

  // 8. Update primary contacts with merged fields
  if (contactsToUpdate.length > 0) {
    console.log(`Updating ${contactsToUpdate.length} primary contacts with merged data...`);
    const UPDATE_BATCH_SIZE = 100;
    for (let i = 0; i < contactsToUpdate.length; i += UPDATE_BATCH_SIZE) {
      const batch = contactsToUpdate.slice(i, i + UPDATE_BATCH_SIZE);
      const { error } = await supabase
        .from('contacts')
        .upsert(batch);
      if (error) throw new Error(`Failed to update primary contacts batch: ${error.message}`);
    }
  }

  console.log('\n✨ Database deduplication and cleanup completed successfully!');
}

cleanupDuplicates().catch(err => {
  console.error('\n❌ Cleanup process failed:', err.message || err);
});
