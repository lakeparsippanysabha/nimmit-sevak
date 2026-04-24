-- Create Follow-up Lists Table
CREATE TABLE public.followup_lists (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name TEXT NOT NULL,
    description TEXT,
    is_public BOOLEAN DEFAULT false,
    created_by UUID REFERENCES auth.users(id) NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- Enable RLS for Follow-up Lists
ALTER TABLE public.followup_lists ENABLE ROW LEVEL SECURITY;

-- Policies for Follow-up Lists
CREATE POLICY "Lists are viewable by creator or if public" 
ON public.followup_lists FOR SELECT 
TO authenticated 
USING (is_public = true OR created_by = auth.uid());

CREATE POLICY "Lists are editable by creator" 
ON public.followup_lists FOR ALL 
TO authenticated 
USING (created_by = auth.uid());

-- Admin policy (override)
CREATE POLICY "Lists are fully managed by admins"
ON public.followup_lists FOR ALL
TO authenticated
USING (public.get_user_role(auth.uid()) IN ('Admin', 'Super Admin'));

-- Create Follow-up List Contacts Join Table
CREATE TABLE public.followup_list_contacts (
    list_id UUID REFERENCES public.followup_lists(id) ON DELETE CASCADE NOT NULL,
    contact_id UUID REFERENCES public.contacts(id) ON DELETE CASCADE NOT NULL,
    added_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    PRIMARY KEY (list_id, contact_id)
);

-- Enable RLS for Join Table
ALTER TABLE public.followup_list_contacts ENABLE ROW LEVEL SECURITY;

-- Policies for Join Table
-- Inherit SELECT logic: if they can see the list, they can see its contacts
CREATE POLICY "List contacts viewable if list is viewable" 
ON public.followup_list_contacts FOR SELECT 
TO authenticated 
USING (
    EXISTS (
        SELECT 1 FROM public.followup_lists
        WHERE id = followup_list_contacts.list_id
        AND (is_public = true OR created_by = auth.uid() OR public.get_user_role(auth.uid()) IN ('Admin', 'Super Admin'))
    )
);

-- Inherit ALL logic: if they own the list or are admin, they can edit its contacts
CREATE POLICY "List contacts editable if list is editable" 
ON public.followup_list_contacts FOR ALL 
TO authenticated 
USING (
    EXISTS (
        SELECT 1 FROM public.followup_lists
        WHERE id = followup_list_contacts.list_id
        AND (created_by = auth.uid() OR public.get_user_role(auth.uid()) IN ('Admin', 'Super Admin'))
    )
);
