-- Ensure pgcrypto is enabled to hash passwords
CREATE EXTENSION IF NOT EXISTS pgcrypto;

DO $$
DECLARE
  super_id UUID := gen_random_uuid();
  admin_id UUID := gen_random_uuid();
  user_id UUID := gen_random_uuid();
  guest_id UUID := gen_random_uuid();
BEGIN
  -- Insert users directly into auth.users (Bypasses API rate limits)
  INSERT INTO auth.users (id, instance_id, aud, role, email, encrypted_password, email_confirmed_at, raw_app_meta_data, raw_user_meta_data, created_at, updated_at)
  VALUES 
    (super_id, '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'superadmin@example.com', crypt('Password123!', gen_salt('bf')), now(), '{"provider":"email","providers":["email"]}', '{"full_name":"Super Admin"}', now(), now()),
    (admin_id, '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'admin@example.com', crypt('Password123!', gen_salt('bf')), now(), '{"provider":"email","providers":["email"]}', '{"full_name":"Admin"}', now(), now()),
    (user_id, '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'user@example.com', crypt('Password123!', gen_salt('bf')), now(), '{"provider":"email","providers":["email"]}', '{"full_name":"User"}', now(), now()),
    (guest_id, '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'guest@example.com', crypt('Password123!', gen_salt('bf')), now(), '{"provider":"email","providers":["email"]}', '{"full_name":"Guest"}', now(), now());

  -- The trigger automatically created 'Guest' profiles for all of them.
  -- Update their roles correctly now:
  UPDATE public.profiles SET role = 'Super Admin'::user_role WHERE id = super_id;
  UPDATE public.profiles SET role = 'Admin'::user_role WHERE id = admin_id;
  UPDATE public.profiles SET role = 'User'::user_role WHERE id = user_id;
  UPDATE public.profiles SET role = 'Guest'::user_role WHERE id = guest_id;
END $$;
