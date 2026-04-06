CREATE TABLE public.travel_plans (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    date DATE UNIQUE NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

ALTER TABLE public.travel_plans ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Travel plans viewable by authenticated users" 
ON public.travel_plans FOR SELECT TO authenticated USING (true);

CREATE POLICY "Travel plans editable by admins" 
ON public.travel_plans FOR ALL TO authenticated 
USING (public.get_user_role(auth.uid()) IN ('Admin', 'Super Admin'));

CREATE TABLE public.travel_stops (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    plan_id UUID REFERENCES public.travel_plans(id) ON DELETE CASCADE NOT NULL,
    order_index INTEGER NOT NULL,
    type TEXT NOT NULL CHECK (type IN ('contact', 'custom', 'break')),
    contact_id UUID REFERENCES public.contacts(id) ON DELETE SET NULL,
    title TEXT NOT NULL,
    address TEXT,
    lat DOUBLE PRECISION,
    lng DOUBLE PRECISION,
    planned_time TIME,
    drive_time_mins INTEGER,
    notes TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

ALTER TABLE public.travel_stops ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Stops viewable by authenticated users" 
ON public.travel_stops FOR SELECT TO authenticated USING (true);

CREATE POLICY "Stops editable by admins" 
ON public.travel_stops FOR ALL TO authenticated 
USING (public.get_user_role(auth.uid()) IN ('Admin', 'Super Admin'));
