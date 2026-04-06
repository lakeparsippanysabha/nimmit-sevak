-- Alter Journal Entries table to append targeted travel stop foreign linkage
ALTER TABLE public.journal_entries 
ADD COLUMN travel_stop_id UUID REFERENCES public.travel_stops(id) ON DELETE SET NULL;
