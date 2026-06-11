CREATE TABLE contact_followups (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  contact_id UUID REFERENCES contacts(id) ON DELETE CASCADE NOT NULL,
  reason TEXT NOT NULL CHECK (reason IN ('Mandir Event', 'Sabha', 'Shibir', 'Seva', 'Other')),
  followup_date TIMESTAMP WITH TIME ZONE NOT NULL,
  notes TEXT,
  created_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

ALTER TABLE contact_followups ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Enable read access for all users" ON contact_followups FOR SELECT USING (true);
CREATE POLICY "Enable insert for authenticated users" ON contact_followups FOR INSERT WITH CHECK (auth.role() = 'authenticated');
CREATE POLICY "Enable update for users based on created_by" ON contact_followups FOR UPDATE USING (auth.uid() = created_by);
CREATE POLICY "Enable delete for users based on created_by" ON contact_followups FOR DELETE USING (auth.uid() = created_by);
