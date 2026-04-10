import { describe, it, expect } from 'vitest';
import { mapContactRow, mapContactRows } from './mappers';
import type { ContactRow } from './database.types';

describe('Contact Mappers', () => {
  const mockRow: ContactRow = {
    id: '123',
    first_name: 'John',
    last_name: 'Doe',
    nickname: 'Johnny',
    gender: 'Male',
    age: 30,
    email: 'john@example.com',
    cellphone: '+123456789',
    member_type: 'Admin',
    address1: '123 Main St',
    address2: null,
    city: 'Parsippany',
    county: 'Morris',
    state: 'NJ',
    zip: '07054',
    country: 'USA',
    followup: '2026-05-01',
    mandal: 'Lake Parsippany',
    avatar_url: 'https://example.com/photo.jpg',
    notes: 'Test notes',
    created_at: '2026-04-09T00:00:00Z',
  };

  it('correctly maps a contact row from snake_case to camelCase', () => {
    const result = mapContactRow(mockRow);

    expect(result.id).toBe(mockRow.id);
    expect(result.firstName).toBe(mockRow.first_name);
    expect(result.lastName).toBe(mockRow.last_name);
    expect(result.nickname).toBe(mockRow.nickname);
    expect(result.gender).toBe(mockRow.gender);
    expect(result.age).toBe(mockRow.age);
    expect(result.email).toBe(mockRow.email);
    expect(result.cellphone).toBe(mockRow.cellphone);
    expect(result.memberType).toBe(mockRow.member_type);
    expect(result.address1).toBe(mockRow.address1);
    expect(result.mandal).toBe(mockRow.mandal);
    expect(result.avatarUrl).toBe(mockRow.avatar_url);
    expect(result.notes).toBe(mockRow.notes);
  });

  it('handles null values by returning undefined in camelCase', () => {
    const nullRow: ContactRow = {
      ...mockRow,
      nickname: null,
      email: null,
      cellphone: null,
      address1: null,
      mandal: null,
      avatar_url: null,
      notes: null,
    };

    const result = mapContactRow(nullRow);

    expect(result.nickname).toBeUndefined();
    expect(result.email).toBeUndefined();
    expect(result.cellphone).toBeUndefined();
    expect(result.address1).toBeUndefined();
    expect(result.mandal).toBeUndefined();
    expect(result.avatarUrl).toBeUndefined();
    expect(result.notes).toBeUndefined();
  });

  it('maps an array of rows correctly', () => {
    const rows = [mockRow, { ...mockRow, id: '456', first_name: 'Jane' }];
    const result = mapContactRows(rows);

    expect(result).toHaveLength(2);
    expect(result[0].id).toBe('123');
    expect(result[1].id).toBe('456');
    expect(result[1].firstName).toBe('Jane');
  });
});
