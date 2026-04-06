-- Create Journal Entries Table
CREATE TABLE public.journal_entries (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    content TEXT NOT NULL,
    travel_plan_id UUID REFERENCES public.travel_plans(id) ON DELETE SET NULL,
    created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

ALTER TABLE public.journal_entries ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Journal entries viewable by authenticated users" 
ON public.journal_entries FOR SELECT TO authenticated USING (true);

CREATE POLICY "Journal entries insertable by authenticated" 
ON public.journal_entries FOR INSERT TO authenticated WITH CHECK (true);

CREATE POLICY "Journal entries deletable by creator" 
ON public.journal_entries FOR DELETE TO authenticated 
USING (auth.uid() = created_by OR public.get_user_role(auth.uid()) IN ('Admin', 'Super Admin'));


-- Create Journal Media Table
CREATE TABLE public.journal_media (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    entry_id UUID REFERENCES public.journal_entries(id) ON DELETE CASCADE NOT NULL,
    file_path TEXT NOT NULL,
    file_type TEXT NOT NULL CHECK (file_type IN ('image', 'video', 'audio')),
    file_size INTEGER,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

ALTER TABLE public.journal_media ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Journal media viewable by authenticated users" 
ON public.journal_media FOR SELECT TO authenticated USING (true);

CREATE POLICY "Journal media insertable by authenticated" 
ON public.journal_media FOR INSERT TO authenticated WITH CHECK (true);

CREATE POLICY "Journal media deletable by authenticated" 
ON public.journal_media FOR DELETE TO authenticated USING (true);


-- Storage Bucket Setup (Must run as Supabase Administrator if permissions block insert into storage.buckets natively, 
-- but we assume standard migration script access. Otherwise, manual creation in dashboard is required.)

INSERT INTO storage.buckets (id, name, public, file_size_limit) 
VALUES ('journal-media', 'journal-media', true, 52428800) -- 50MB limit
ON CONFLICT (id) DO NOTHING;

CREATE POLICY "Public media access" ON storage.objects 
FOR SELECT USING (bucket_id = 'journal-media');

CREATE POLICY "Auth media upload" ON storage.objects 
FOR INSERT WITH CHECK (bucket_id = 'journal-media' AND auth.role() = 'authenticated');

CREATE POLICY "Auth media update" ON storage.objects 
FOR UPDATE USING (bucket_id = 'journal-media' AND auth.role() = 'authenticated');

CREATE POLICY "Auth media delete" ON storage.objects 
FOR DELETE USING (bucket_id = 'journal-media' AND auth.role() = 'authenticated');
