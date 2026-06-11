import type { Contact } from '../data/mockContacts';

export interface FollowupList {
  id: string;
  name: string;
  description?: string;
  isPublic: boolean;
  createdBy: string;
  createdAt: string;
  updatedAt: string;
}

export interface FollowupListWithContacts extends FollowupList {
  contacts: Contact[];
}

export interface ContactFollowup {
  id: string;
  contactId: string;
  reason: 'Mandir Event' | 'Sabha' | 'Shibir' | 'Seva' | 'Other';
  followupDate: string;
  notes: string | null;
  createdBy: string | null;
  createdAt: string;
}

