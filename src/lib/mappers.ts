/**
 * Data Mappers
 * 
 * Shared mapping functions between Supabase snake_case rows and
 * application-level camelCase interfaces. Centralizing these prevents
 * inconsistencies when multiple routes perform the same transformation.
 */

import type { ContactRow } from './database.types';
import type { Contact } from '../data/mockContacts';

/**
 * Maps a Supabase `contacts` row (snake_case) to the application's
 * `Contact` interface (camelCase).
 */
export function mapContactRow(row: ContactRow): Contact {
  return {
    id: row.id,
    firstName: row.first_name,
    lastName: row.last_name,
    nickname: row.nickname ?? undefined,
    gender: row.gender ?? undefined,
    age: row.age ?? undefined,
    email: row.email ?? undefined,
    cellphone: row.cellphone ?? undefined,
    memberType: row.member_type ?? undefined,
    address1: row.address1 ?? undefined,
    address2: row.address2 ?? undefined,
    city: row.city ?? undefined,
    county: row.county ?? undefined,
    state: row.state ?? undefined,
    zip: row.zip ?? undefined,
    country: row.country ?? undefined,
    followup: row.followup ?? undefined,
    mandal: row.mandal ?? undefined,
    avatarUrl: row.avatar_url ?? undefined,
    notes: row.notes ?? undefined,
  };
}

/**
 * Maps an array of Supabase `contacts` rows to application `Contact[]`.
 */
export function mapContactRows(rows: ContactRow[]): Contact[] {
  return rows.map(mapContactRow);
}
