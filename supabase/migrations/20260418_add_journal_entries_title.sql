-- Add title column to journal_entries table
ALTER TABLE journal_entries ADD COLUMN IF NOT EXISTS title text;
