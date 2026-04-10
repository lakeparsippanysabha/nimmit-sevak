-- Drop dependent tables first to allow clean recreation of contacts
DROP TABLE IF EXISTS public.attendance_records;
DROP TABLE IF EXISTS public.journal_media;
DROP TABLE IF EXISTS public.journal_entries;
DROP TABLE IF EXISTS public.travel_stops;
DROP TABLE IF EXISTS public.travel_plans;
DROP TABLE IF EXISTS public.contacts;

-- RECREATE CONTACTS TABLE
CREATE TABLE public.contacts (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    first_name TEXT NOT NULL,
    last_name TEXT NOT NULL,
    nickname TEXT,
    gender TEXT,
    age INTEGER,
    email TEXT,
    cellphone TEXT,
    member_type TEXT,
    address1 TEXT,
    address2 TEXT,
    city TEXT,
    county TEXT,
    state TEXT,
    zip TEXT,
    country TEXT,
    followup TEXT,
    mandal TEXT,
    avatar_url TEXT,
    notes TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- Enable RLS
ALTER TABLE public.contacts ENABLE ROW LEVEL SECURITY;

-- Policies
CREATE POLICY "Contacts are viewable by authenticated users" 
ON public.contacts FOR SELECT 
TO authenticated 
USING (true);

CREATE POLICY "Contacts are editable by admins" 
ON public.contacts FOR ALL 
TO authenticated 
USING (public.get_user_role(auth.uid()) IN ('Admin', 'Super Admin'));

-- RECREATE DEPENDENT TABLES (Standard boilerplate from previous migrations to maintain integrity)

-- ATTENDANCE RECORDS
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

-- TRAVEL PLANS
CREATE TABLE public.travel_plans (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    date DATE NOT NULL UNIQUE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

ALTER TABLE public.travel_plans ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Travel plans viewable by users" ON public.travel_plans FOR SELECT TO authenticated USING (true);
CREATE POLICY "Travel plans editable by admins" ON public.travel_plans FOR ALL TO authenticated USING (public.get_user_role(auth.uid()) IN ('Admin', 'Super Admin'));

-- TRAVEL STOPS
CREATE TABLE public.travel_stops (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    plan_id UUID REFERENCES public.travel_plans(id) ON DELETE CASCADE NOT NULL,
    order_index INTEGER NOT NULL,
    type TEXT NOT NULL CHECK (type IN ('contact', 'custom', 'break')),
    title TEXT NOT NULL,
    address TEXT NOT NULL,
    lat DOUBLE PRECISION NOT NULL,
    lng DOUBLE PRECISION NOT NULL,
    planned_time TEXT,
    drive_time_mins INTEGER,
    contact_id UUID REFERENCES public.contacts(id) ON DELETE SET NULL
);

ALTER TABLE public.travel_stops ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Travel stops viewable by users" ON public.travel_stops FOR SELECT TO authenticated USING (true);
CREATE POLICY "Travel stops editable by admins" ON public.travel_stops FOR ALL TO authenticated USING (public.get_user_role(auth.uid()) IN ('Admin', 'Super Admin'));

-- JOURNAL ENTRIES
CREATE TABLE public.journal_entries (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    content TEXT,
    travel_plan_id UUID REFERENCES public.travel_plans(id) ON DELETE SET NULL,
    travel_stop_id UUID REFERENCES public.travel_stops(id) ON DELETE SET NULL,
    created_by UUID REFERENCES auth.users(id),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

ALTER TABLE public.journal_entries ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Journal entries viewable by authenticated users" ON public.journal_entries FOR SELECT TO authenticated USING (true);
CREATE POLICY "Journal entries editable by creators and admins" ON public.journal_entries FOR ALL TO authenticated 
USING (auth.uid() = created_by OR public.get_user_role(auth.uid()) IN ('Admin', 'Super Admin'));

-- JOURNAL MEDIA
CREATE TABLE public.journal_media (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    entry_id UUID REFERENCES public.journal_entries(id) ON DELETE CASCADE NOT NULL,
    file_path TEXT NOT NULL,
    file_type TEXT NOT NULL CHECK (file_type IN ('image', 'video', 'audio')),
    url TEXT NOT NULL,
    caption TEXT
);

ALTER TABLE public.journal_media ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Journal media viewable by authenticated users" ON public.journal_media FOR SELECT TO authenticated USING (true);
CREATE POLICY "Journal media editable by creators and admins" ON public.journal_media FOR ALL TO authenticated 
USING (
    EXISTS (
        SELECT 1 FROM public.journal_entries 
        WHERE id = journal_media.entry_id 
        AND (created_by = auth.uid() OR public.get_user_role(auth.uid()) IN ('Admin', 'Super Admin'))
    )
);
