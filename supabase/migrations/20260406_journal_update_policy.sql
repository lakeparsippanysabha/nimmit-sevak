-- Added missing UPDATE policy giving Authenticated users the ability to perform Row Level edits natively.
CREATE POLICY "Journal entries updatable by authenticated" 
ON public.journal_entries 
FOR UPDATE TO authenticated 
USING (true);
