CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- CONTACTS TABLE
CREATE TABLE public.contacts (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    first_name TEXT NOT NULL,
    last_name TEXT NOT NULL,
    avatar_url TEXT,
    company TEXT,
    job_title TEXT,
    notes TEXT,
    fields JSONB DEFAULT '[]'::jsonb,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

ALTER TABLE public.contacts ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Contacts are viewable by authenticated users" 
ON public.contacts FOR SELECT 
TO authenticated 
USING (true);

CREATE POLICY "Contacts are editable by admins" 
ON public.contacts FOR ALL 
TO authenticated 
USING (public.get_user_role(auth.uid()) IN ('Admin', 'Super Admin'));

-- ATTENDANCE RECORDS TABLE
CREATE TABLE public.attendance_records (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    contact_id UUID REFERENCES public.contacts(id) ON DELETE CASCADE NOT NULL,
    date DATE NOT NULL,
    status TEXT NOT NULL CHECK (status IN ('Present', 'Absent', 'Excused', 'Late')),
    notes TEXT,
    recorded_by UUID REFERENCES auth.users(id),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    UNIQUE(contact_id, date)
);

ALTER TABLE public.attendance_records ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Attendance viewable by users" 
ON public.attendance_records FOR SELECT 
TO authenticated 
USING (true);

CREATE POLICY "Attendance editable by users" 
ON public.attendance_records FOR ALL 
TO authenticated 
USING (public.get_user_role(auth.uid()) IN ('User', 'Admin', 'Super Admin'));
