/**
 * Supabase Database Types
 * 
 * Manually derived from the migration files in supabase/migrations/.
 * These types eliminate the need for `any` casts throughout the codebase.
 * 
 * To regenerate from a live Supabase instance:
 *   npx supabase gen types typescript --project-id <your-project-id> > src/lib/database.types.ts
 */

// ──────────────────────────────────────────────
// Row Types (what you SELECT from the database)
// ──────────────────────────────────────────────

export interface ProfileRow {
  id: string;
  full_name: string | null;
  avatar_url: string | null;
  role: 'Super Admin' | 'Admin' | 'User' | 'Guest';
  created_at: string;
}

export interface ContactRow {
  id: string;
  first_name: string;
  last_name: string;
  nickname: string | null;
  gender: string | null;
  age: number | null;
  email: string | null;
  cellphone: string | null;
  member_type: string | null;
  address1: string | null;
  address2: string | null;
  city: string | null;
  county: string | null;
  state: string | null;
  zip: string | null;
  country: string | null;
  followup: string | null;
  mandal: string | null;
  avatar_url: string | null;
  notes: string | null;
  created_at: string;
}

export interface AttendanceRecordRow {
  id: string;
  contact_id: string;
  date: string;
  status: 'Present' | 'Absent' | 'Late' | 'Excused';
  created_at: string;
}

export interface TravelPlanRow {
  id: string;
  date: string;
  created_at: string;
}

export interface TravelStopRow {
  id: string;
  plan_id: string;
  order_index: number;
  type: 'contact' | 'custom' | 'break';
  title: string;
  address: string;
  lat: number;
  lng: number;
  planned_time: string | null;
  drive_time_mins: number | null;
}

export interface JournalEntryRow {
  id: string;
  title: string | null;
  content: string | null;
  travel_plan_id: string | null;
  travel_stop_id: string | null;
  created_by: string | null;
  created_at: string;
}

export interface JournalMediaRow {
  id: string;
  entry_id: string;
  file_path: string;
  file_type: 'image' | 'video' | 'audio';
  url: string;
  caption: string | null;
}

// ──────────────────────────────────────────────
// Insert Types (what you INSERT into the database)
// ──────────────────────────────────────────────

export type ContactInsert = Omit<ContactRow, 'id' | 'created_at'>;
export type AttendanceRecordUpsert = Omit<AttendanceRecordRow, 'id' | 'created_at'>;
export type TravelPlanInsert = Pick<TravelPlanRow, 'date'>;
export type TravelStopInsert = Omit<TravelStopRow, 'id'>;
export type JournalEntryInsert = Omit<JournalEntryRow, 'id' | 'created_at'>;
export type JournalMediaInsert = Omit<JournalMediaRow, 'id'>;
