import { createFileRoute, useNavigate } from '@tanstack/react-router';
import { ProtectedRoute } from '../components/ProtectedRoute';
import { useState, useMemo, useRef, useEffect } from 'react';
import { useVirtualizer } from '@tanstack/react-virtual';
import { motion, AnimatePresence } from 'framer-motion';
import { Search, Calendar as CalendarIcon, CheckCircle2, Save, Activity, ChevronLeft, ChevronRight } from 'lucide-react';
import { supabase } from '../lib/supabase';
import type { Contact } from '../data/mockContacts';
import type { ContactRow } from '../lib/database.types';
import { mapContactRows } from '../lib/mappers';
import { handleLoaderError } from '../lib/errors';

// Date formatter for default today
const getTodayDateString = () => {
  const d = new Date();
  d.setMinutes(d.getMinutes() - d.getTimezoneOffset());
  return d.toISOString().split('T')[0];
};

interface AttendanceSearchParams {
  date?: string;
}

export const Route = createFileRoute('/attendance')({
  validateSearch: (search: Record<string, unknown>): AttendanceSearchParams => {
    return {
      date: (search.date as string) || getTodayDateString(),
    };
  },
  loaderDeps: ({ search: { date } }) => ({ date }),
  loader: async ({ deps: { date } }) => {
    await supabase.auth.getSession();

    // Fetch all contacts
    const { data: contactsData, error: contactsError } = await supabase
      .from('contacts')
      .select('*')
      .order('first_name');

    // Fetch attendance for the specific date
    const { data: attendanceData, error: attendanceError } = await supabase
      .from('attendance_records')
      .select('*')
      .eq('date', date)
      .eq('status', 'Present'); // Only load present records now

    // Fetch all dates with attendance records for calendar highlighting
    const { data: allAttendanceDates } = await supabase
      .from('attendance_records')
      .select('date');

    if (contactsError) handleLoaderError('attendance:contacts', contactsError, null);
    if (attendanceError) handleLoaderError('attendance:records', attendanceError, null);

    const contacts = mapContactRows((contactsData || []) as ContactRow[]);

    // Map attendance records by contact_id for O(1) lookup
    const attendanceMap = new Map<string, any>();
    (attendanceData || []).forEach((record: any) => {
      attendanceMap.set(record.contact_id, record);
    });

    const attendanceDates = Array.from(new Set((allAttendanceDates || []).map((record: any) => record.date).filter(Boolean)));

    return { contacts, dbAttendanceMap: Array.from(attendanceMap.entries()), attendanceDates };
  },
  component: AttendancePage,
});

// Helper for proper title casing
const titleCase = (str: string | undefined | null) => {
  if (!str) return '';
  return str.split(' ').map(w => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase()).join(' ');
};

function AttendancePage() {
  const navigate = useNavigate({ from: '/attendance' });
  const { date } = Route.useSearch();
  const { contacts: initialContacts, dbAttendanceMap: initialDbAttendanceMap, attendanceDates } = Route.useLoaderData();

  const [searchQuery, setSearchQuery] = useState('');
  const [showYouthOnly, setShowYouthOnly] = useState(false);

  // Track client hydration and sync state 
  const [contacts, setContacts] = useState<Contact[]>(initialContacts);
  const [prevDate, setPrevDate] = useState(date);

  const [attendance, setAttendance] = useState<Map<string, any>>(() => new Map(initialDbAttendanceMap));
  const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [toastMessage, setToastMessage] = useState<{ title: string, type: 'success' | 'error' } | null>(null);
  const [isCalendarOpen, setIsCalendarOpen] = useState(false);
  const [calendarMonth, setCalendarMonth] = useState(new Date(date + 'T00:00:00'));

  // Hydrate strictly client-side allowing Supabase SDK to securely rebuild identity token states before firing row level queries
  useEffect(() => {
    const hydrateData = async () => {
      // Fetch Contacts
      const { data: contactsData } = await supabase.from('contacts').select('*').order('first_name');
      if (contactsData) {
        setContacts(mapContactRows(contactsData as ContactRow[]));
      }

      // Fetch Attendance for Date
      const { data: attendanceData } = await supabase
        .from('attendance_records')
        .select('*')
        .eq('date', date)
        .eq('status', 'Present');

      const freshMap = new Map<string, any>();
      (attendanceData || []).forEach((record: any) => {
        freshMap.set(record.contact_id, record);
      });

      setAttendance(freshMap);
      setHasUnsavedChanges(false);

      // Now attempt to overlay local storage if there are unsaved drafts
      try {
        const localData = localStorage.getItem(`attendance_${date}`);
        if (localData) {
          const parsed = JSON.parse(localData);
          setAttendance(new Map(parsed));
          setHasUnsavedChanges(true); // There are unpersisted edits!
        }
      } catch (e) {
        console.error('Failed to parse local storage attendance', e);
      }
    };

    hydrateData();
  }, [date]); // Re-fetch all data safely when date changes client-side

  useEffect(() => {
    setCalendarMonth(new Date(date + 'T00:00:00'));
  }, [date]);

  // Synchronously catch navigation updates if TanStack `loader` triggers a date switch without remounting
  if (date !== prevDate) {
    setPrevDate(date);
    setSearchQuery('');
  }

  // Client-side Sorting and filtering logic
  const processedContacts = useMemo(() => {
    let filtered = contacts;
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      filtered = filtered.filter(c =>
        c.firstName.toLowerCase().includes(q) ||
        c.lastName.toLowerCase().includes(q)
      );
    }

    if (showYouthOnly) {
      filtered = filtered.filter(c => c.youthSabhaMember);
    }

    filtered.sort((a, b) => {
      const nameA = `${a.firstName} ${a.lastName}`.toLowerCase();
      const nameB = `${b.firstName} ${b.lastName}`.toLowerCase();
      return nameA.localeCompare(nameB);
    });

    return filtered;
  }, [contacts, searchQuery, showYouthOnly]);

  const parentRef = useRef<HTMLDivElement>(null);

  // Virtual list to power 60fps scrolling
  const virtualizer = useVirtualizer({
    count: processedContacts.length,
    getScrollElement: () => parentRef.current,
    estimateSize: () => 72,
    overscan: 10,
  });

  const toggleAttendance = (contactId: string) => {
    const newAttendance = new Map(attendance);

    // If present, remove (implicit absence). If absent, set as Present.
    if (newAttendance.has(contactId)) {
      newAttendance.delete(contactId);
    } else {
      newAttendance.set(contactId, { contact_id: contactId, date, status: 'Present' });
    }

    setAttendance(newAttendance);
    setHasUnsavedChanges(true);

    // Persist optimistic state to local storage to prevent data loss
    localStorage.setItem(`attendance_${date}`, JSON.stringify(Array.from(newAttendance.entries())));
  };

  const handleSaveAttendance = async () => {
    setIsSaving(true);
    try {
      // Clean delete existing attendance for this date (so implicit absences are correctly handled)
      await supabase.from('attendance_records').delete().eq('date', date);

      const recordsToInsert = Array.from(attendance.values()).map(r => ({
        contact_id: r.contact_id,
        date: r.date,
        status: 'Present'
      }));

      if (recordsToInsert.length > 0) {
        const { error } = await supabase.from('attendance_records').insert(recordsToInsert);
        if (error) throw error;
      }

      // Cleanup local storage 
      localStorage.removeItem(`attendance_${date}`);
      setHasUnsavedChanges(false);

      setToastMessage({ title: 'Attendance saved successfully!', type: 'success' });
      setTimeout(() => setToastMessage(null), 5000);
    } catch (e: any) {
      console.error('Save failed:', e);
      setToastMessage({ title: 'Failed to save attendance: ' + e.message, type: 'error' });
      setTimeout(() => setToastMessage(null), 5000);
    } finally {
      setIsSaving(false);
    }
  };

  // Metrics calculation
  const totalMarked = attendance.size;
  const totalContacts = contacts.length;
  const presentRate = totalMarked > 0 ? Math.round((totalMarked / totalContacts) * 100) : 0;

  const [activeTab, setActiveTab] = useState<'list' | 'metrics'>('list');

  const generateCalendarDays = () => {
    const year = calendarMonth.getFullYear();
    const month = calendarMonth.getMonth();
    const firstDay = new Date(year, month, 1);
    const lastDay = new Date(year, month + 1, 0);
    const days = [];

    for (let i = 0; i < firstDay.getDay(); i++) {
      days.push(null);
    }
    for (let i = 1; i <= lastDay.getDate(); i++) {
      days.push(new Date(year, month, i));
    }
    return days;
  };

  return (
    <ProtectedRoute allowedRoles={['Super Admin', 'Admin', 'User']}>
      <div className="flex h-[calc(100vh-64px)] w-full overflow-hidden bg-background relative">

        {/* Mobile Toggle */}
        <div className="md:hidden absolute bottom-6 left-1/2 -translate-x-1/2 z-50 flex items-center justify-center rounded-full bg-foreground shadow-2xl p-1 gap-1">
          <button
            onClick={() => setActiveTab('list')}
            className={`rounded-full px-5 py-2 text-sm font-bold transition-all outline-none ${activeTab === 'list' ? 'bg-background text-foreground shadow-sm' : 'text-background/70 hover:text-background'}`}
          >
            List
          </button>
          <button
            onClick={() => setActiveTab('metrics')}
            className={`rounded-full px-5 py-2 text-sm font-bold transition-all outline-none ${activeTab === 'metrics' ? 'bg-background text-foreground shadow-sm' : 'text-background/70 hover:text-background'}`}
          >
            Metrics
          </button>
        </div>

        {/* Left Pane - Master List  */}
        <div className={`relative h-full w-full flex-col border-r border-border bg-card md:w-[450px] xl:w-[500px] ${activeTab === 'list' ? 'flex' : 'hidden md:flex'}`}>
          <div className="z-10 flex-shrink-0 bg-card/80 p-4 pt-6 backdrop-blur-xl">
            <div className="flex items-center justify-between gap-3">
              <h1 className="min-w-0 text-2xl font-bold tracking-tight text-foreground font-serif">Attendance</h1>

              <button
                onClick={handleSaveAttendance}
                disabled={!hasUnsavedChanges || isSaving}
                className="flex shrink-0 items-center gap-2 whitespace-nowrap rounded-lg bg-primary px-3 py-2 text-xs font-bold text-primary-foreground shadow transition-all disabled:opacity-50 disabled:grayscale sm:px-4 sm:text-sm"
              >
                {isSaving ? <Activity className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
                {isSaving ? 'Saving...' : 'Save'}
              </button>
            </div>

            <motion.div className="relative mt-4">
              <div className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3">
                <Search className="h-4 w-4 text-muted-foreground" />
              </div>
              <input
                type="text"
                placeholder="Search contacts..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="block w-full rounded-xl border border-input bg-background py-2.5 pl-10 pr-4 text-sm focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary font-sans placeholder:text-muted-foreground"
              />
            </motion.div>

            <div className="mt-4 flex items-center justify-between px-1 font-sans">
              <label className="group flex cursor-pointer items-center gap-3 text-sm font-medium text-foreground">
                <button
                  type="button"
                  onClick={() => setShowYouthOnly(!showYouthOnly)}
                  className={`relative inline-flex h-5 w-9 items-center rounded-full transition-colors ${showYouthOnly ? 'bg-primary' : 'bg-muted-foreground/30'}`}
                >
                  <span className={`inline-block h-3.5 w-3.5 transform rounded-full bg-white transition-transform ${showYouthOnly ? 'translate-x-4' : 'translate-x-1'}`} />
                </button>
                <span className="transition-colors group-hover:text-primary">Youth Sabha Members Only</span>
              </label>
            </div>
          </div>

          <div className="relative flex-1 overflow-hidden outline-none font-sans" ref={parentRef} style={{ overflowY: 'auto' }}>
            <div
              style={{
                height: `${virtualizer.getTotalSize()}px`,
                width: '100%',
                position: 'relative',
              }}
            >
              {virtualizer.getVirtualItems().map((virtualItem) => {
                const contact = processedContacts[virtualItem.index];
                const isPresent = attendance.has(contact.id);

                return (
                  <div
                    key={virtualItem.key}
                    style={{
                      position: 'absolute',
                      top: 0,
                      left: 0,
                      width: '100%',
                      height: `${virtualItem.size}px`,
                      transform: `translateY(${virtualItem.start}px)`,
                    }}
                    className="flex flex-col justify-center border-b border-border px-4 transition-colors hover:bg-muted/50"
                  >
                    <div className="flex items-center justify-between gap-3">
                      <div className="flex items-center gap-3 truncate">
                        <img
                          src={contact.avatarUrl}
                          alt=""
                          className="h-10 w-10 flex-shrink-0 rounded-full object-cover border border-border"
                          loading="lazy"
                        />
                        <div className="flex flex-col truncate">
                          <span className="truncate text-sm font-medium text-foreground tracking-tight py-0.5">
                            {titleCase(contact.firstName)} <span className="font-bold">{titleCase(contact.lastName)}</span>
                          </span>
                          {contact.mandal && (
                            <span className="truncate text-[10px] text-primary bg-primary/10 px-1.5 py-0.5 rounded-full font-bold uppercase tracking-wider w-fit">
                              {contact.mandal}
                            </span>
                          )}
                        </div>
                      </div>

                      {/* Action Buttons */}
                      <div className="flex items-center gap-1">
                        <AnimatePresence>
                          <motion.button
                            whileHover={{ scale: 1.1 }}
                            whileTap={{ scale: 0.9 }}
                            onClick={() => toggleAttendance(contact.id)}
                            className={`flex h-8 w-8 items-center justify-center rounded-full border transition-all ${isPresent ? 'bg-emerald-500 border-emerald-600 text-white shadow-md' : 'border-border bg-card text-muted-foreground hover:border-emerald-500 hover:text-emerald-500'}`}
                            title={isPresent ? "Marked Present" : "Mark Present"}
                          >
                            <CheckCircle2 className="h-5 w-5" />
                          </motion.button>
                        </AnimatePresence>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
            {processedContacts.length === 0 && (
              <div className="flex h-full items-center justify-center text-muted-foreground font-sans">No contacts found</div>
            )}
          </div>
        </div>

        {/* Right Pane - Metrics & Controls */}
        <div className={`flex-1 flex-col overflow-y-auto bg-background p-6 lg:p-12 ${activeTab === 'metrics' ? 'flex' : 'hidden md:flex'}`}>
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="mx-auto w-full max-w-3xl"
          >
            {/* Improved Header for Small Viewports */}
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-8">
              <div>
                <h2 className="text-3xl font-bold tracking-tight text-foreground font-serif">Daily Overview</h2>
                <p className="mt-1 text-muted-foreground font-sans">Review attendance metrics and manage records.</p>
              </div>
              <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3">
                <div className="relative min-w-[19rem] w-full sm:w-auto">
                  <button
                    onClick={() => setIsCalendarOpen(!isCalendarOpen)}
                    className="flex w-full min-w-[19rem] items-center gap-3 rounded-xl border border-border bg-card p-2 pr-4 shadow-sm font-sans flex-shrink-0 hover:border-primary/50 transition-colors"
                  >
                    <div className="flex items-center justify-center rounded-lg bg-primary/10 p-2">
                      <CalendarIcon className="h-5 w-5 text-primary" />
                    </div>
                    <div className="text-left">
                      <div className="text-xs text-muted-foreground font-bold tracking-wider uppercase">Selected Date</div>
                      <div className="text-sm font-medium text-foreground mt-0.5">
                        {new Date(date + 'T12:00:00').toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' })}
                      </div>
                    </div>
                  </button>

                  <AnimatePresence>
                    {isCalendarOpen && (
                      <motion.div
                        initial={{ opacity: 0, y: -10, scale: 0.95 }}
                        animate={{ opacity: 1, y: 0, scale: 1 }}
                        exit={{ opacity: 0, y: -10, scale: 0.95 }}
                        className="absolute top-16 left-0 right-0 w-full min-w-[19rem] rounded-2xl bg-card border border-border shadow-2xl p-4 z-50 font-sans"
                      >
                        <div className="flex items-center justify-between mb-4">
                          <button
                            onClick={() => setCalendarMonth(new Date(calendarMonth.getFullYear(), calendarMonth.getMonth() - 1, 1))}
                            className="p-1 hover:bg-muted rounded-md"
                          >
                            <ChevronLeft className="h-5 w-5" />
                          </button>
                          <h3 className="font-bold text-sm">
                            {calendarMonth.toLocaleDateString('en-US', { month: 'long', year: 'numeric' })}
                          </h3>
                          <button
                            onClick={() => setCalendarMonth(new Date(calendarMonth.getFullYear(), calendarMonth.getMonth() + 1, 1))}
                            className="p-1 hover:bg-muted rounded-md"
                          >
                            <ChevronRight className="h-5 w-5" />
                          </button>
                        </div>

                        <div className="grid grid-cols-7 gap-1 text-center mb-2">
                          {['Su', 'Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa'].map(d => (
                            <div key={d} className="text-[10px] uppercase font-bold text-muted-foreground">{d}</div>
                          ))}
                        </div>

                        <div className="grid grid-cols-7 gap-1">
                          {generateCalendarDays().map((d, i) => {
                            if (!d) return <div key={i} className="h-8" />;

                            const dateStr = [
                              d.getFullYear(),
                              String(d.getMonth() + 1).padStart(2, '0'),
                              String(d.getDate()).padStart(2, '0')
                            ].join('-');

                            const isSelected = date === dateStr;
                            const hasAttendanceData = attendanceDates.includes(dateStr);

                            return (
                              <button
                                key={i}
                                onClick={() => {
                                  navigate({ search: { date: dateStr } });
                                  setIsCalendarOpen(false);
                                }}
                                className={`relative flex h-8 items-center justify-center rounded-md text-xs transition-colors hover:bg-primary/20 hover:text-primary ${isSelected ? 'bg-primary text-primary-foreground font-bold shadow-md hover:bg-primary hover:text-primary-foreground' : 'text-foreground'
                                  } ${hasAttendanceData && !isSelected ? 'ring-1 ring-primary/25' : ''}`}
                              >
                                {d.getDate()}
                                {hasAttendanceData && !isSelected && (
                                  <div className="absolute bottom-1 left-1/2 -translate-x-1/2 w-1 h-1 rounded-full bg-primary" />
                                )}
                                {hasAttendanceData && isSelected && (
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

              </div>
            </div>

            {hasUnsavedChanges && (
              <div className="mb-6 rounded-xl bg-amber-50 dark:bg-amber-950/20 border border-amber-200 dark:border-amber-900/40 p-4 text-sm font-semibold text-amber-800 dark:text-amber-400 font-sans flex items-center">
                <span className="w-2 h-2 rounded-full bg-amber-500 mr-3 animate-pulse"></span>
                You have unsaved attendance changes. Remember to hit save!
              </div>
            )}

            {/* Metrics Grid */}
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 font-sans">
              <div className="rounded-2xl border border-border bg-card p-6 shadow-sm">
                <p className="text-sm font-medium text-muted-foreground">Total Network Size</p>
                <div className="mt-2 flex items-baseline gap-2">
                  <span className="text-4xl font-bold text-foreground font-serif">{totalContacts}</span>
                </div>
              </div>

              <div className="rounded-2xl border border-emerald-200 bg-emerald-50 p-6 shadow-sm dark:border-emerald-900/30 dark:bg-emerald-950/20">
                <div className="flex items-center gap-2">
                  <CheckCircle2 className="h-5 w-5 text-emerald-600 hover:scale-105 transition-transform" />
                  <p className="text-sm font-medium text-emerald-800 dark:text-emerald-400">Total Present</p>
                </div>
                <div className="mt-2 flex items-baseline gap-2">
                  <span className="text-4xl font-bold text-emerald-700 dark:text-emerald-300 font-serif">{totalMarked}</span>
                </div>
                <p className="mt-1 text-sm font-medium text-emerald-600 dark:text-emerald-500">{presentRate}% of total network</p>
              </div>
            </div>

            {/* Quick Actions / Summary List */}
            <div className="mt-8 rounded-2xl border border-border bg-card shadow-sm overflow-hidden font-sans">
              <div className="border-b border-border bg-muted/50 px-6 py-4">
                <h3 className="text-sm font-bold text-foreground font-serif tracking-tight">Recent Updates (Present)</h3>
              </div>
              <div className="divide-y divide-border">
                {Array.from(attendance.values()).slice(-10).reverse().map((record: any) => {
                  const contact = contacts.find(c => c.id === record.contact_id);
                  if (!contact) return null;

                  return (
                    <div key={contact.id} className="flex items-center justify-between px-6 py-3">
                      <div className="flex items-center gap-3">
                        <img src={contact.avatarUrl} className="h-8 w-8 rounded-full border border-border" alt="" />
                        <span className="text-sm font-medium text-foreground">{titleCase(contact.firstName)} {titleCase(contact.lastName)}</span>
                      </div>
                      <span className="px-2.5 py-1 rounded-full text-[10px] uppercase tracking-wider font-bold border bg-emerald-100 text-emerald-700 border-emerald-200 dark:bg-emerald-950 dark:border-emerald-800 dark:text-emerald-400">
                        Present
                      </span>
                    </div>
                  );
                })}
                {attendance.size === 0 && (
                  <div className="p-8 text-center text-sm text-muted-foreground">Nobody has been marked present for this date.</div>
                )}
              </div>
            </div>

          </motion.div>
        </div>

        {/* Global Action Toast Notification */}
        <AnimatePresence>
          {toastMessage && (
            <motion.div
              initial={{ opacity: 0, y: 50, scale: 0.9 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: 50, scale: 0.9 }}
              className={`fixed bottom-6 right-6 z-[100] flex items-center gap-3 rounded-xl px-5 py-4 shadow-2xl font-sans ${toastMessage.type === 'success'
                  ? 'bg-emerald-600 text-white'
                  : 'bg-red-600 text-white'
                }`}
            >
              {toastMessage.type === 'success' ? <CheckCircle2 className="h-6 w-6" /> : <Activity className="h-6 w-6" />}
              <span className="text-sm font-bold tracking-wide">{toastMessage.title}</span>
            </motion.div>
          )}
        </AnimatePresence>

      </div>
    </ProtectedRoute>
  );
}
