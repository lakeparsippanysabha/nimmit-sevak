import { createFileRoute, useRouter } from '@tanstack/react-router';
import { ProtectedRoute } from '../components/ProtectedRoute';
import { useState, useCallback, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import { handleMutationError } from '../lib/errors';
import { MediaUploader, type UploadedMedia } from '../components/MediaUploader';
import { MediaGalleries } from '../components/MediaGalleries';
import { PenLine, Send, Calendar, MapPin, Loader2, Navigation, Edit2, Check, X } from 'lucide-react';
import { format } from 'date-fns';

export const Route = createFileRoute('/journal')({
  validateSearch: (search: Record<string, unknown>) => ({
    stopId: (search.stopId as string) || undefined,
  }),
  loader: async () => {
    // Fetch journal entries with their attached media, linked travel date, and explicit stops
    const { data: entries } = await supabase
      .from('journal_entries')
      .select('*, journal_media(*), travel_plans:travel_plan_id(id, date), travel_stops:travel_stop_id(id, title)')
      .order('created_at', { ascending: false });

    // We fetch plans so we can match a stopId back up to its implicit parent Plan ID silently
    const { data: plans } = await supabase
      .from('travel_plans')
      .select('id, date, travel_stops(id, title)')
      .order('date', { ascending: false });

    return {
      entries: entries || [],
      plans: plans || [],
    };
  },
  component: JournalPage,
});

function JournalPage() {
  const { entries: initialEntries, plans: initialPlans } = Route.useLoaderData();
  const { stopId } = Route.useSearch();
  const router = useRouter();

  const [entries, setEntries] = useState<any[]>(initialEntries);
  const [plans, setPlans] = useState<any[]>(initialPlans);


  useEffect(() => {
    const hydrateJournal = async () => {
      const { data: hEntries } = await supabase
        .from('journal_entries')
        .select('*, journal_media(*), travel_plans:travel_plan_id(id, date), travel_stops:travel_stop_id(id, title)')
        .order('created_at', { ascending: false });

      const { data: hPlans } = await supabase
        .from('travel_plans')
        .select('id, date, travel_stops(id, title)')
        .order('date', { ascending: false });

      if (hEntries) setEntries(hEntries);
      if (hPlans) setPlans(hPlans);
    };
    hydrateJournal();
  }, []);

  // Find plan context implicitly if arriving from a specific stop link
  const prefilledPlanId = stopId ? plans.find(p => p.travel_stops.some((s: any) => s.id === stopId))?.id || '' : '';

  const [content, setContent] = useState('');
  const [pendingMedia, setPendingMedia] = useState<UploadedMedia[]>([]);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Advanced Edit Mode States
  const [editingEntryId, setEditingEntryId] = useState<string | null>(null);
  const [editContent, setEditContent] = useState('');
  const [editPendingMedia, setEditPendingMedia] = useState<UploadedMedia[]>([]);
  const [isSavingEdit, setIsSavingEdit] = useState(false);

  // New Post Submission
  const handleMediaUploaded = useCallback((newMedia: UploadedMedia[]) => {
    setPendingMedia(prev => [...prev, ...newMedia]);
  }, []);

  const handleSubmit = async () => {
    if (!content.trim() && pendingMedia.length === 0) return;
    setIsSubmitting(true);

    try {
      const { data: user } = await supabase.auth.getUser();

      // 1. Create the Entry globally or mapped explicitly via the URL params automatically
      const { data: entry, error: entryError } = await supabase
        .from('journal_entries')
        .insert({
          content: content.trim(),
          travel_plan_id: prefilledPlanId || null,
          travel_stop_id: stopId || null,
          created_by: user?.user?.id || null,
        })
        .select()
        .single();

      if (entryError) throw entryError;

      // 2. Attach Media
      if (pendingMedia.length > 0 && entry) {
        const mediaPayload = pendingMedia.map(m => ({
          ...m,
          entry_id: entry.id,
        }));
        const { error: mediaError } = await supabase.from('journal_media').insert(mediaPayload);
        if (mediaError) throw mediaError;
      }

      // Cleanup
      setContent('');
      setPendingMedia([]);
      router.invalidate();
    } catch (err) {
      handleMutationError('journal:submit', err);
    } finally {
      setIsSubmitting(false);
    }
  };

  // Editing Subsystem
  const startEditing = (entry: any) => {
    setEditingEntryId(entry.id);
    setEditContent(entry.content);
    setEditPendingMedia([]);
  };

  const cancelEditing = () => {
    setEditingEntryId(null);
    setEditContent('');
    setEditPendingMedia([]);
  };
  
  const handleEditMediaUploaded = useCallback((newMedia: UploadedMedia[]) => {
    setEditPendingMedia(prev => [...prev, ...newMedia]);
  }, []);

  const handleDeleteExistingMedia = async (media: any) => {
    if (!confirm('Are you sure you want to permanently delete this media file?')) return;
    try {
       await supabase.storage.from('journal-media').remove([media.file_path]);
       await supabase.from('journal_media').delete().eq('id', media.id);
       router.invalidate(); // instantly remove from screen
    } catch (err) {
       handleMutationError('journal:delete-media', err);
    }
  };

  const saveEdit = async () => {
    if (!editingEntryId) return;
    setIsSavingEdit(true);
    try {
      // Save text adjustments
      const { error: textErr } = await supabase
        .from('journal_entries')
        .update({ content: editContent.trim() })
        .eq('id', editingEntryId);
      if (textErr) throw textErr;
      
      // Save staged appended media
      if (editPendingMedia.length > 0) {
        const appendedMedia = editPendingMedia.map(m => ({
          ...m,
          entry_id: editingEntryId,
        }));
        const { error: mErr } = await supabase.from('journal_media').insert(appendedMedia);
        if (mErr) throw mErr;
      }
      
      setEditingEntryId(null);
      router.invalidate();
    } catch (error) {
      handleMutationError('journal:save-edit', error);
    } finally {
      setIsSavingEdit(false);
    }
  };


  return (
    <ProtectedRoute allowedRoles={['Super Admin', 'Admin', 'User']}>
      <div className="h-[calc(100vh-64px)] w-full overflow-y-auto bg-background py-8 px-4 sm:px-8">
        <div className="mx-auto w-full max-w-[1800px] pb-20">
          
          <div className="mb-10 text-center sm:text-left">
            <h1 className="text-4xl font-extrabold tracking-tight text-foreground drop-shadow-sm font-serif">Travel Logbook</h1>
            <p className="text-sm font-medium text-muted-foreground mt-2 max-w-lg mx-auto sm:mx-0 font-sans">
              {stopId ? "You are drafting a localized entry for this specific itinerary stop. It will be mapped permanently to the timeline." : "Record generic events from the road. Upload media, drop thoughts, and chronicle the journey."}
            </p>
          </div>

          {/* New Modern Composer Panel */}
          <div className="mb-12 rounded-[2rem] bg-card p-6 shadow-sm border border-border transition-all">
            <div className="flex items-start gap-4 flex-col sm:flex-row">
              <div className="hidden sm:flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-primary text-primary-foreground shadow-md">
                <PenLine className="h-5 w-5" />
              </div>
              <div className="flex-1 w-full relative">
                 {/* Fully visible layout fix - Solid background explicitly forcing contrast */}
                <textarea
                  value={content}
                  onChange={(e) => setContent(e.target.value)}
                  placeholder={stopId ? "What happened at this location?" : "Launch a new transmission..."}
                  className="w-full resize-none rounded-xl bg-background border border-input p-4 text-[15px] font-medium leading-relaxed text-foreground outline-none focus:ring-1 focus:ring-primary shadow-sm font-sans placeholder:text-muted-foreground"
                  rows={4}
                />
                
                <div className="mt-2 font-sans">
                  <MediaUploader onFilesUploaded={handleMediaUploaded} />
                </div>

                {pendingMedia.length > 0 && (
                  <div className="mt-4 flex flex-wrap gap-2 font-sans">
                    {pendingMedia.map((m, i) => (
                      <div key={i} className="flex items-center gap-1.5 rounded-full bg-primary/10 px-3 py-1.5 text-xs font-bold tracking-wide text-primary shadow-sm border border-primary/20">
                        {m.file_type === 'image' ? '🖼️' : m.file_type === 'video' ? '🎬' : '🎵'}
                        {m.file_type.toUpperCase()} Attached
                      </div>
                    ))}
                  </div>
                )}
                
                <div className="mt-4 flex items-center justify-end font-sans">
                  <button
                    onClick={handleSubmit}
                    disabled={isSubmitting || (!content.trim() && pendingMedia.length === 0)}
                    className="group flex items-center gap-2 rounded-full bg-primary pl-4 pr-5 py-2.5 text-sm font-bold text-primary-foreground shadow-lg shadow-primary/30 transition-all hover:bg-primary/90 disabled:pointer-events-none disabled:opacity-50"
                  >
                    {isSubmitting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4 transition-transform group-hover:translate-x-1" />}
                    Publish Log
                  </button>
                </div>
              </div>
            </div>
          </div>

          {/* Majestic Chronological Feed */}
          <div className="columns-1 md:columns-2 xl:columns-3 gap-6 space-y-6">
            {entries.length === 0 ? (
              <div className="flex flex-col items-center justify-center rounded-3xl border-2 border-dashed border-border py-20 font-sans">
                <Navigation className="h-10 w-10 text-muted-foreground mb-4 opacity-50" />
                <h3 className="text-lg font-bold text-foreground font-serif">The Archive is Empty</h3>
                <p className="text-sm font-medium text-muted-foreground mt-1">First transmissions will appear sequentially here.</p>
              </div>
            ) : (
              entries.map((entry: any) => (
                <article key={entry.id} className="relative break-inside-avoid mb-6 rounded-[2rem] bg-card p-6 sm:p-8 shadow-sm border border-border transition-all hover:shadow-md">
                  
                  {/* Glassmorphic Date Badge */}
                  <div className="absolute -top-3 left-8 z-10 flex items-center gap-2 rounded-full border border-primary/20 bg-card px-3 py-1 text-xs font-bold text-primary shadow-sm font-sans">
                    <Calendar className="h-3.5 w-3.5" />
                    {format(new Date(entry.created_at), "MMM do, h:mm a")}
                  </div>

                  {/* Header Authoring */}
                  <div className="flex items-start justify-between mb-5 mt-2 font-sans">
                    <div className="flex items-center gap-3">
                      <div className="h-10 w-10 shrink-0 overflow-hidden rounded-full border border-border bg-background shadow-inner">
                         <img src={`https://api.dicebear.com/9.x/notionists/svg?seed=${entry.created_by || 'admin'}`} alt="Avatar" className="h-full w-full object-cover opacity-80" />
                      </div>
                      <div className="flex flex-col">
                        <h4 className="text-[15px] font-bold text-foreground font-serif tracking-tight pr-1">Expedition Log</h4>
                        {/* Implicit Geographical Link Display */}
                        {entry.travel_stops && (
                          <div className="flex items-center gap-1 text-[11px] font-bold uppercase tracking-wider text-emerald-600 dark:text-emerald-400 mt-0.5">
                            <MapPin className="h-3 w-3" />
                            {entry.travel_stops.title}
                          </div>
                        )}
                        {entry.travel_plans && !entry.travel_stops && (
                          <div className="flex items-center gap-1 text-[11px] font-bold uppercase tracking-wider text-primary mt-0.5 opacity-80">
                             Linked Itinerary Date: {entry.travel_plans.date}
                          </div>
                        )}
                      </div>
                    </div>

                    <button 
                      onClick={() => startEditing(entry)}
                      className="rounded-full p-2.5 text-muted-foreground hover:bg-muted hover:text-foreground transition-colors"
                      title="Edit Entry"
                    >
                      <Edit2 className="h-4 w-4" />
                    </button>
                  </div>
                  
                  {/* Advanced In-Line Editor */}
                  {editingEntryId === entry.id ? (
                    <div className="animate-in fade-in slide-in-from-top-2 relative mt-4 rounded-2xl border-2 border-primary/20 bg-primary/5 p-5 shadow-inner font-sans">
                       
                       {/* Editor Label */}
                       <div className="absolute -top-3 right-4 bg-primary text-primary-foreground text-[10px] font-black uppercase tracking-widest px-2 py-0.5 rounded-sm">
                         Live Edit Mode
                       </div>

                       <textarea
                         autoFocus
                         value={editContent}
                         onChange={(e) => setEditContent(e.target.value)}
                         className="w-full resize-none rounded-xl bg-background border border-input p-3 text-[15px] leading-relaxed text-foreground outline-none focus:ring-1 focus:ring-primary shadow-sm"
                         rows={4}
                       />

                       <div className="mt-4 border-t border-border pt-4">
                         <h5 className="text-xs font-bold text-muted-foreground uppercase tracking-wider mb-3">Modify Master Asset Bank</h5>
                         <MediaGalleries media={entry.journal_media} onDeleteMedia={handleDeleteExistingMedia} />
                         <div className="mt-3">
                           <MediaUploader onFilesUploaded={handleEditMediaUploaded} />
                         </div>
                       </div>

                       {/* Edit Staged Media Indicators */}
                       {editPendingMedia.length > 0 && (
                          <div className="mt-3 flex flex-wrap gap-2">
                            {editPendingMedia.map((m, i) => (
                              <div key={i} className="flex items-center gap-1.5 rounded-full bg-emerald-100 px-3 py-1 text-xs font-bold text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-300">
                                + NEW {m.file_type.toUpperCase()}
                              </div>
                            ))}
                          </div>
                       )}

                       <div className="mt-5 flex items-center justify-end gap-3">
                         <button onClick={cancelEditing} className="flex items-center gap-1.5 rounded-full px-5 py-2 text-sm font-bold text-muted-foreground hover:bg-muted hover:text-foreground transition-colors">
                           <X className="h-4 w-4" /> Cancel
                         </button>
                         <button onClick={saveEdit} disabled={isSavingEdit} className="flex items-center gap-1.5 rounded-full bg-primary px-6 py-2 text-sm font-bold text-primary-foreground hover:bg-primary/90 disabled:opacity-50 shadow-md">
                           {isSavingEdit ? <Loader2 className="h-4 w-4 animate-spin" /> : <Check className="h-4 w-4" />} Save Master
                         </button>
                       </div>
                    </div>
                  ) : (
                    <>
                      {entry.content && (
                        <p className="whitespace-pre-wrap text-[15.5px] leading-relaxed text-foreground font-serif mb-5 relative z-10 px-1">
                          {entry.content}
                        </p>
                      )}
                      {/* Standard Un-editable Gallery */}
                      <MediaGalleries media={entry.journal_media} />
                    </>
                  )}
                </article>
              ))
            )}
          </div>

        </div>
      </div>
    </ProtectedRoute>
  );
}
