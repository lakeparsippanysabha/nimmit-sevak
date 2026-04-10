-- 1. Identify and remove duplicate contacts
-- A duplicate is defined as having the same first_name, last_name, and cellphone.
-- We keep the record with the most recent created_at/id.

DELETE FROM public.contacts a
USING public.contacts b
WHERE a.id < b.id
  AND a.first_name = b.first_name
  AND a.last_name = b.last_name
  AND (
    (a.cellphone IS NOT NULL AND a.cellphone = b.cellphone) OR 
    (a.cellphone IS NULL AND b.cellphone IS NULL)
  );

-- 2. Add a unique constraint to prevent future duplicates
-- This ensures that the combination of first_name, last_name, and cellphone must be unique.
-- We use a NULL-safe unique constraint if needed, but in standard Postgres, 
-- multiple NULLs are allowed in a UNIQUE index. 
-- However, we want to prevent multiple (Name, Name, NULL) too.
-- For simplicity and standard CRM behavior, we'll apply a standard unique constraint.

ALTER TABLE public.contacts 
ADD CONSTRAINT contacts_unique_identity UNIQUE (first_name, last_name, cellphone);
