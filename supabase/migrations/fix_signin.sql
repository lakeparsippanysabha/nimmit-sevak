-- 1. Fix the GoTrue schema crash caused by manual user injection
-- Supabase GoTrue crashes during sign-in if these token columns are NULL instead of empty strings
UPDATE auth.users
SET 
  confirmation_token = COALESCE(confirmation_token, ''),
  recovery_token = COALESCE(recovery_token, ''),
  email_change_token_new = COALESCE(email_change_token_new, ''),
  email_change = COALESCE(email_change, '')
WHERE email IN ('superadmin@example.com', 'admin@example.com', 'user@example.com', 'guest@example.com');

-- 2. Fix the Infinite Recursion in the RLS Policy
-- Policy #3 evaluated public.profiles inside a SELECT policy for public.profiles, causing an infinite loop.
DROP POLICY IF EXISTS "Admins can view all profiles" ON public.profiles;

-- Create a SECURITY DEFINER function to read the role bypassing RLS
CREATE OR REPLACE FUNCTION public.get_user_role(user_id uuid)
RETURNS public.user_role
LANGUAGE sql
SECURITY DEFINER SET search_path = public
AS $$
  SELECT role FROM public.profiles WHERE id = user_id;
$$;

-- Create the new, safe policy
CREATE POLICY "Admins can view all profiles" ON public.profiles
  FOR SELECT USING (
    public.get_user_role(auth.uid()) IN ('Admin', 'Super Admin')
  );
