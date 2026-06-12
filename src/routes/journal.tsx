import { createFileRoute, useRouter } from '@tanstack/react-router';
import { ProtectedRoute } from '../components/ProtectedRoute';
import { useState, useCallback, useEffect, useMemo } from 'react';
import { supabase } from '../lib/supabase';
import { handleMutationError } from '../lib/errors';
import { MediaUploader, type UploadedMedia } from '../components/MediaUploader';
import { MediaGalleries } from '../components/MediaGalleries';
import { useConfirm } from '../contexts/ConfirmContext';
import { useToast } from '../contexts/ToastContext';
import { PenLine, Send, Calendar as CalendarIcon, MapPin, Loader2, Navigation, Edit2, Check, X, ChevronLeft, ChevronRight, BookOpen } from 'lucide-react';
import { format } from 'date-fns';
import { AnimatePresence, motion } from 'framer-motion';

const getTodayDateString = () => {
  const d = new Date();
  d.setMinutes(d.getMinutes() - d.getTimezoneOffset());
  return d.toISOString().split('T')[0];
};

const extractEntryDateStr = (entry: any) => {
  if (entry.travel_plans && entry.travel_plans.date) {
    return entry.travel_plans.date;
  }
  const d = new Date(entry.created_at);
  const offset = d.getTimezoneOffset();
  const rawLocal = new Date(d.getTime() - (offset * 60 * 1000));
  return rawLocal.toISOString().split('T')[0];
};

export const Route = createFileRoute('/journal')({
  validateSearch: (search: Record<string, unknown>) => ({
    stopId: (search.stopId as string) || undefined,
    date: (search.date as string) || getTodayDateString(),
  }),
  loaderDeps: ({ search: { date } }) => ({ date }),
  loader: async ({ deps: { date } }) => {
    await supabase.auth.getSession();

    const { data: entries } = await supabase
      .from('journal_entries')
      .select('*, journal_media(*), travel_plans:travel_plan_id(id, date), travel_stops:travel_stop_id(id, title)')
      .order('created_at', { ascending: false });

    const { data: plans } = await supabase
      .from('travel_plans')
      .select('id, date, travel_stops(id, title)')
      .order('date', { ascending: false });

    return {
      date,
      entries: entries || [],
      plans: plans || [],
    };
  },
  component: JournalPage,
});

function JournalPage() {
  const navigate = Route.useNavigate();
  const { date, entries: initialEntries, plans: initialPlans } = Route.useLoaderData();
  const { stopId } = Route.useSearch();
  const router = useRouter();
  const { confirm } = useConfirm();
  const { toast } = useToast();

  const [entries, setEntries] = useState<any[]>(initialEntries);
  const [plans, setPlans] = useState<any[]>(initialPlans);

  // Hard Refresh Method - called after creating / modifying records to kill stale states guarantees 0ms UI delay.
  const syncJournalStates = async () => {
    const { data: hEntries } = await supabase
      .from('journal_entries')
      .select('*, journal_media(*), travel_plans:travel_plan_id(id, date), travel_stops:travel_stop_id(id, title)')
      .order('created_at', { ascending: false });

    if (hEntries) setEntries(hEntries);
  };

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

  const prefilledPlanId = stopId ? plans.find(p => p.travel_stops.some((s: any) => s.id === stopId))?.id || '' : '';

  const [title, setTitle] = useState('');
  const [content, setContent] = useState('');
  const [pendingMedia, setPendingMedia] = useState<UploadedMedia[]>([]);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Calendar Engine
  const [isCalendarOpen, setIsCalendarOpen] = useState(false);
  const [calendarMonth, setCalendarMonth] = useState(new Date(date + 'T00:00:00'));

  // Derive dates holding data
  const journalDatesWithContent = useMemo(() => {
    const dates = new Set<string>();
    entries.forEach(e => dates.add(extractEntryDateStr(e)));
    return Array.from(dates);
  }, [entries]);

  // Derived target entries matching URL parameter date
  const filteredEntries = useMemo(() => {
    return entries.filter(e => extractEntryDateStr(e) === date);
  }, [entries, date]);

  // Advanced Edit Mode States
  const [editingEntryId, setEditingEntryId] = useState<string | null>(null);
  const [editTitle, setEditTitle] = useState('');
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

      const { data: entry, error: entryError } = await supabase
        .from('journal_entries')
        .insert({
          title: title.trim() || null,
          content: content.trim(),
          travel_plan_id: prefilledPlanId || null,
          travel_stop_id: stopId || null,
          created_by: user?.user?.id || null,
        })
        .select()
        .single();

      if (entryError) throw entryError;

      if (pendingMedia.length > 0 && entry) {
        const mediaPayload = pendingMedia.map(m => ({
          ...m,
          entry_id: entry.id,
        }));
        const { error: mediaError } = await supabase.from('journal_media').insert(mediaPayload);
        if (mediaError) throw mediaError;
      }

      await syncJournalStates(); // Immediate hydration blocking

      setTitle('');
      setContent('');
      setPendingMedia([]);
      router.invalidate();

      // Auto-jump to the date in the URL for this new entry so they can see it
      if (!date && prefilledPlanId) {
        // It might be nested in plans
      }

    } catch (err) {
      handleMutationError('journal:submit', err);
    } finally {
      setIsSubmitting(false);
    }
  };

  // Editing Subsystem
  const startEditing = (entry: any) => {
    setEditingEntryId(entry.id);
    setEditTitle(entry.title || '');
    setEditContent(entry.content || '');
    setEditPendingMedia([]);
  };

  const cancelEditing = () => {
    setEditingEntryId(null);
    setEditTitle('');
    setEditContent('');
    setEditPendingMedia([]);
  };

  const handleEditMediaUploaded = useCallback((newMedia: UploadedMedia[]) => {
    setEditPendingMedia(prev => [...prev, ...newMedia]);
  }, []);

  const handleDeleteExistingMedia = async (media: any) => {
    if (!(await confirm({ title: 'Delete Media', description: 'Are you sure you want to permanently delete this media file?', confirmText: 'Delete', danger: true }))) return;
    try {
      await supabase.storage.from('journal-media').remove([media.file_path]);
      await supabase.from('journal_media').delete().eq('id', media.id);
      await syncJournalStates();
      router.invalidate();
    } catch (err) {
      handleMutationError('journal:delete-media', err);
    }
  };

  const saveEdit = async () => {
    if (!editingEntryId) return;
    setIsSavingEdit(true);
    try {
      const { error: textErr } = await supabase
        .from('journal_entries')
        .update({ title: editTitle.trim() || null, content: editContent.trim() })
        .eq('id', editingEntryId);
      if (textErr) throw textErr;

      if (editPendingMedia.length > 0) {
        const appendedMedia = editPendingMedia.map(m => ({
          ...m,
          entry_id: editingEntryId,
        }));
        const { error: mErr } = await supabase.from('journal_media').insert(appendedMedia);
        if (mErr) throw mErr;
      }

      await syncJournalStates();

      router.invalidate();
    } catch (error) {
      handleMutationError('journal:save-edit', error);
    } finally {
      setEditingEntryId(null);
      setIsSavingEdit(false);
    }
  };


  const generateCalendarDays = () => {
    const year = calendarMonth.getFullYear();
    const month = calendarMonth.getMonth();
    const firstDay = new Date(year, month, 1);
    const lastDay = new Date(year, month + 1, 0);
    const days = [];

    for (let i = 0; i < firstDay.getDay(); i++) days.push(null);
    for (let i = 1; i <= lastDay.getDate(); i++) days.push(new Date(year, month, i));
    return days;
  };

  return (
    <ProtectedRoute allowedRoles={['Super Admin', 'Admin', 'User']}>
      <div className="h-[calc(100vh-64px)] w-full overflow-y-auto bg-background py-8 px-4 sm:px-8">
        <div className="mx-auto w-full max-w-3xl pb-24 font-sans">

          <div className="mb-10 text-center sm:text-left">
            <h1 className="text-4xl font-extrabold tracking-tight text-foreground drop-shadow-sm font-serif">Smruties</h1>
            <p className="text-sm font-medium text-muted-foreground mt-2 max-w-lg mx-auto sm:mx-0">
              {stopId ? "You are drafting a localized entry for this specific itinerary stop. It will be mapped permanently to the timeline." : "Capture smruties (glimpses) of any event or moments. Upload media (audio, images, videos) upto 50mb per file, add notes and let's archive our smruties."}
            </p>
          </div>

          {/* Calendar Selector Filter */}
          <div className="relative mb-8 z-30">
            <button
              onClick={() => setIsCalendarOpen(!isCalendarOpen)}
              className="flex items-center justify-between w-full sm:w-[300px] rounded-2xl border border-border bg-card p-4 text-left font-sans hover:border-primary/50 transition-colors shadow-sm"
            >
              <div className="flex items-center gap-4">
                <div className="flex items-center justify-center rounded-xl bg-primary/10 p-2.5">
                  <CalendarIcon className="h-6 w-6 text-primary" />
                </div>
                <div>
                  <div className="text-[11px] text-muted-foreground font-black tracking-widest uppercase">Viewing Smruties For</div>
                  <div className="text-sm font-bold text-foreground mt-0.5">
                    {new Date(date + 'T12:00:00').toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' })}
                  </div>
                </div>
              </div>
            </button>

            <AnimatePresence>
              {isCalendarOpen && (
                <motion.div
                  initial={{ opacity: 0, y: -10, scale: 0.95 }}
                  animate={{ opacity: 1, y: 0, scale: 1 }}
                  exit={{ opacity: 0, y: -10, scale: 0.95 }}
                  className="absolute top-20 left-0 w-full sm:w-[320px] rounded-2xl bg-card border border-border shadow-2xl p-4 z-50 font-sans"
                >
                  <div className="flex items-center justify-between mb-4 px-1">
                    <button
                      onClick={() => setCalendarMonth(new Date(calendarMonth.getFullYear(), calendarMonth.getMonth() - 1, 1))}
                      className="p-1 hover:bg-muted rounded-md transition-colors text-muted-foreground hover:text-foreground"
                    >
                      <ChevronLeft className="h-5 w-5" />
                    </button>
                    <h3 className="font-bold text-[15px] cursor-default font-serif tracking-tight">
                      {calendarMonth.toLocaleDateString('en-US', { month: 'long', year: 'numeric' })}
                    </h3>
                    <button
                      onClick={() => setCalendarMonth(new Date(calendarMonth.getFullYear(), calendarMonth.getMonth() + 1, 1))}
                      className="p-1 hover:bg-muted rounded-md transition-colors text-muted-foreground hover:text-foreground"
                    >
                      <ChevronRight className="h-5 w-5" />
                    </button>
                  </div>

                  <div className="grid grid-cols-7 gap-1 text-center mb-2 px-1">
                    {['S', 'M', 'T', 'W', 'T', 'F', 'S'].map((d, idx) => (
                      <div key={idx} className="text-[11px] font-black tracking-wider text-muted-foreground/60">{d}</div>
                    ))}
                  </div>

                  <div className="grid grid-cols-7 gap-1.5 px-1">
                    {generateCalendarDays().map((d, i) => {
                      if (!d) return <div key={i} className="h-9" />;

                      const dateStr = [
                        d.getFullYear(),
                        String(d.getMonth() + 1).padStart(2, '0'),
                        String(d.getDate()).padStart(2, '0')
                      ].join('-');

                      const isSelected = date === dateStr;
                      const hasLogs = journalDatesWithContent.includes(dateStr);

                      return (
                        <button
                          key={i}
                          onClick={() => {
                            navigate({ search: { date: dateStr } });
                            setIsCalendarOpen(false);
                          }}
                          className={`relative flex h-9 items-center justify-center rounded-lg text-sm transition-all hover:bg-primary/10 hover:text-primary ${isSelected ? 'bg-primary text-primary-foreground font-bold shadow-md hover:bg-primary hover:text-primary-foreground pointer-events-none' : 'text-foreground font-medium'}`}
                        >
                          {d.getDate()}
                          {hasLogs && !isSelected && (
                            <div className="absolute bottom-1 left-1/2 -translate-x-1/2 w-1 h-1 rounded-full bg-primary" />
                          )}
                          {hasLogs && isSelected && (
                            <div className="absolute bottom-1 left-1/2 -translate-x-1/2 w-1 h-1 rounded-full bg-primary-foreground opacity-80" />
                          )}
                        </button>
                      );
                    })}
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </div>

          {/* New Modern Composer Panel */}
          <div className="mb-12 rounded-[2rem] bg-card p-6 sm:p-8 shadow-sm border border-border transition-all">
            <div className="flex items-start gap-4 flex-col sm:flex-row">
              <div className="hidden sm:flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-primary text-primary-foreground shadow-md ring-4 ring-primary/10">
                <PenLine className="h-5 w-5" />
              </div>
              <div className="flex-1 w-full relative">
                <input
                  type="text"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  placeholder="Title (optional)"
                  className="w-full rounded-t-xl bg-background border border-border border-b-0 px-4 py-3 text-[16px] font-bold text-foreground outline-none focus:ring-1 focus:ring-primary shadow-sm font-serif placeholder:text-muted-foreground/60 transition-colors"
                />
                <textarea
                  value={content}
                  onChange={(e) => setContent(e.target.value)}
                  placeholder={stopId ? "What happened at this location?" : "Add your notes..."}
                  className="w-full resize-none rounded-b-xl bg-background border border-border p-4 pb-5 text-[15px] font-medium leading-relaxed text-foreground outline-none focus:ring-1 focus:ring-primary shadow-sm font-sans placeholder:text-muted-foreground transition-colors"
                  rows={4}
                />

                <div className="mt-3">
                  <MediaUploader
                    onFilesUploaded={handleMediaUploaded}
                    onUploadError={(msg) => toast(msg, 'error')}
                  />
                </div>

                {pendingMedia.length > 0 && (
                  <div className="mt-4 flex flex-wrap gap-2">
                    {pendingMedia.map((m, i) => (
                      <div key={i} className="flex items-center gap-1.5 rounded-full bg-primary/10 px-3 py-1.5 text-xs font-bold tracking-wide text-primary shadow-inner border border-primary/20">
                        {m.file_type === 'image' ? '🖼️' : m.file_type === 'video' ? '🎬' : '🎵'}
                        {m.file_type.toUpperCase()} Attached
                      </div>
                    ))}
                  </div>
                )}

                <div className="mt-5 flex items-center justify-end border-t border-border/50 pt-5">
                  <button
                    onClick={handleSubmit}
                    disabled={isSubmitting || (!content.trim() && pendingMedia.length === 0)}
                    className="group flex items-center gap-2 rounded-full bg-primary pl-4 pr-5 py-2.5 text-sm font-bold text-primary-foreground shadow-xl shadow-primary/25 transition-all hover:bg-primary/90 hover:scale-[1.02] active:scale-95 disabled:pointer-events-none disabled:opacity-50"
                  >
                    {isSubmitting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4 transition-transform group-hover:translate-x-1" />}
                    Submit
                  </button>
                </div>
              </div>
            </div>
          </div>

          {/* Full-width Chronological Feed */}
          <div className="space-y-8 flex flex-col relative w-full">
            {filteredEntries.length === 0 ? (
              <div className="flex flex-col items-center justify-center rounded-[2rem] border-2 border-dashed border-border py-24 font-sans bg-muted/20">
                <div className="h-16 w-16 bg-muted rounded-full flex items-center justify-center mb-5 shrink-0">
                  <Navigation className="h-8 w-8 text-muted-foreground opacity-50" />
                </div>
                <h3 className="text-xl font-bold text-foreground font-serif tracking-tight">Timeline is empty!</h3>
                <p className="text-sm font-medium text-muted-foreground mt-2 max-w-[250px] text-center leading-relaxed">
                  No logbook records matched your current calendar filter.
                </p>
              </div>
            ) : (
              filteredEntries.map((entry: any, index: number) => (
                <div key={entry.id} className="relative w-full group">

                  {/* Vertical Timeline Track element (hidden on last item if we want) */}
                  {index !== filteredEntries.length - 1 && (
                    <div className="absolute left-8 top-20 bottom-[-32px] w-[2px] bg-border/50 hidden sm:block pointer-events-none" />
                  )}

                  <article className="relative w-full rounded-[2rem] bg-card p-6 sm:p-9 shadow-sm border border-border/60 transition-all hover:shadow-lg hover:border-border overflow-hidden">

                    {/* Header Authoring */}
                    <div className="flex items-start justify-between mb-6 z-10 relative">
                      <div className="flex items-center gap-4">
                        <div className="h-12 w-12 shrink-0 flex items-center justify-center overflow-hidden rounded-full border border-border bg-primary/10 shadow-sm relative z-20">
                          <BookOpen className="h-5 w-5 text-primary stroke-[2.5px]" />
                        </div>
                        <div className="flex flex-col">
                          <div className="flex items-center gap-2">
                            <h4 className="text-[17px] font-bold text-foreground font-serif tracking-tight">{entry.title || "Expedition Log"}</h4>
                            <span className="text-xs font-bold text-muted-foreground bg-muted px-2 py-0.5 rounded-full whitespace-nowrap">
                              {new Date(entry.created_at).toLocaleTimeString('en-US', { timeZone: 'America/New_York', hour: 'numeric', minute: '2-digit' })}
                            </span>
                          </div>

                          {/* Implicit Geographical Link Display */}
                          {entry.travel_stops && (
                            <div className="flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-wider text-emerald-600 dark:text-emerald-400 mt-1">
                              <MapPin className="h-3.5 w-3.5" />
                              {entry.travel_stops.title}
                            </div>
                          )}
                          {entry.travel_plans && !entry.travel_stops && (
                            <div className="flex items-center gap-1 text-[11px] font-bold uppercase tracking-wider text-primary mt-1 opacity-80">
                              Linked Itinerary Date: {entry.travel_plans.date}
                            </div>
                          )}
                        </div>
                      </div>

                      <button
                        onClick={() => startEditing(entry)}
                        className="rounded-full p-2.5 text-muted-foreground/60 hover:bg-muted hover:text-foreground transition-colors"
                        title="Edit Entry"
                      >
                        <Edit2 className="h-5 w-5" />
                      </button>
                    </div>

                    {/* Advanced In-Line Editor */}
                    {editingEntryId === entry.id ? (
                      <div className="animate-in fade-in slide-in-from-top-2 relative mt-2 rounded-[1.5rem] border-2 border-primary/20 bg-primary/5 p-6 shadow-inner font-sans">

                        {/* Editor Label */}
                        <div className="absolute -top-3.5 right-6 bg-primary text-primary-foreground text-[10px] font-black uppercase tracking-widest px-3 py-1 rounded-full shadow-sm z-10">
                          Edit Mode
                        </div>

                        <input
                          type="text"
                          value={editTitle}
                          onChange={(e) => setEditTitle(e.target.value)}
                          className="w-full rounded-t-xl bg-background border border-border border-b-0 px-4 py-3 text-[16px] font-bold text-foreground outline-none focus:ring-1 focus:ring-primary shadow-sm font-serif placeholder:text-muted-foreground/60 transition-colors"
                          placeholder="Title (optional)"
                        />
                        <textarea
                          autoFocus
                          value={editContent}
                          onChange={(e) => setEditContent(e.target.value)}
                          className="w-full resize-none rounded-b-xl bg-background border border-border p-4 pb-6 text-[16px] leading-relaxed text-foreground outline-none focus:ring-1 focus:ring-primary shadow-sm"
                          rows={5}
                        />

                        <div className="mt-5 border-t border-border/50 pt-5">
                          <h5 className="text-xs font-bold text-muted-foreground uppercase tracking-wider mb-4">Modify Asset Bank</h5>
                          <MediaGalleries media={entry.journal_media} onDeleteMedia={handleDeleteExistingMedia} />
                          <div className="mt-4">
                            <MediaUploader
                              onFilesUploaded={handleEditMediaUploaded}
                              onUploadError={(msg) => toast(msg, 'error')}
                            />
                          </div>
                        </div>

                        {/* Edit Staged Media Indicators */}
                        {editPendingMedia.length > 0 && (
                          <div className="mt-4 flex flex-wrap gap-2">
                            {editPendingMedia.map((m, i) => (
                              <div key={i} className="flex items-center gap-1.5 rounded-full bg-emerald-100 px-3 py-1 text-xs font-bold text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-300">
                                + NEW {m.file_type.toUpperCase()}
                              </div>
                            ))}
                          </div>
                        )}

                        <div className="mt-6 flex items-center justify-end gap-3 border-t border-border/50 pt-5">
                          <button onClick={cancelEditing} className="flex items-center gap-1.5 rounded-full px-5 py-2.5 text-sm font-bold text-muted-foreground hover:bg-muted hover:text-foreground transition-colors">
                            <X className="h-4 w-4" /> Cancel
                          </button>
                          <button onClick={saveEdit} disabled={isSavingEdit} className="flex items-center gap-1.5 rounded-full bg-primary px-6 py-2.5 text-sm font-bold text-primary-foreground hover:bg-primary/90 disabled:opacity-50 shadow-md transition-all active:scale-95">
                            {isSavingEdit ? <Loader2 className="h-4 w-4 animate-spin" /> : <Check className="h-4 w-4" />} Save
                          </button>
                        </div>
                      </div>
                    ) : (
                      <>
                        {entry.content && (
                          <p className="whitespace-pre-wrap text-[16px] leading-8 text-foreground/90 font-serif mb-6 relative z-10 px-1 sm:px-2">
                            {entry.content}
                          </p>
                        )}
                        {/* Standard Un-editable Gallery */}
                        <MediaGalleries media={entry.journal_media} />
                      </>
                    )}
                  </article>
                </div>
              ))
            )}
          </div>

        </div>
      </div>
    </ProtectedRoute>
  );
}
