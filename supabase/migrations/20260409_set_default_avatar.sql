-- Set a default avatar URL for all contacts and update existing ones
-- Target URL: https://iamakshar.com/wp-content/uploads/2020/05/Logo-460x-300x300.png

-- 1. Update all existing contacts to use the new avatar
UPDATE public.contacts 
SET avatar_url = 'https://iamakshar.com/wp-content/uploads/2020/05/Logo-460x-300x300.png'
WHERE avatar_url IS NULL OR avatar_url LIKE 'https://i.pravatar.cc/%';

-- 2. Set as default for new records
ALTER TABLE public.contacts 
ALTER COLUMN avatar_url SET DEFAULT 'https://iamakshar.com/wp-content/uploads/2020/05/Logo-460x-300x300.png';
