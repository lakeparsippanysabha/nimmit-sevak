import { createFileRoute, useNavigate } from '@tanstack/react-router';
import { ProtectedRoute } from '../components/ProtectedRoute';
import { useState, useMemo, useRef, useEffect } from 'react';
import { useVirtualizer } from '@tanstack/react-virtual';
import { motion, AnimatePresence } from 'framer-motion';
import { Search, Calendar, CheckCircle2, XCircle, Clock } from 'lucide-react';
import { supabase } from '../lib/supabase';
import type { Contact } from '../data/mockContacts';

// Date formatter for default today
const getTodayDateString = () => {
  const d = new Date();
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
    // Fetch all contacts
    const { data: contactsData, error: contactsError } = await supabase
      .from('contacts')
      .select('*')
      .order('first_name');
    
    // Fetch attendance for the specific date
    const { data: attendanceData, error: attendanceError } = await supabase
      .from('attendance_records')
      .select('*')
      .eq('date', date);

    if (contactsError) console.error('Contacts error:', contactsError);
    if (attendanceError) console.error('Attendance error:', attendanceError);

    const contacts = (contactsData || []).map((row: any) => ({
      id: row.id,
      firstName: row.first_name,
      lastName: row.last_name,
      avatarUrl: row.avatar_url,
      company: row.company,
      jobTitle: row.job_title,
    })) as Contact[];

    // Map attendance records by contact_id for O(1) lookup
    const attendanceMap = new Map<string, any>();
    (attendanceData || []).forEach((record: any) => {
      attendanceMap.set(record.contact_id, record);
    });

    return { contacts, attendanceMap: Array.from(attendanceMap.entries()) };
  },
  component: AttendancePage,
});

function AttendancePage() {
  const navigate = useNavigate({ from: '/attendance' });
  const { date } = Route.useSearch();
  const { contacts, attendanceMap: loadedAttendance } = Route.useLoaderData();
  
  const [searchQuery, setSearchQuery] = useState('');
  
  // Local state for optimistic UI updates
  const [attendance, setAttendance] = useState<Map<string, any>>(new Map());

  // Restore the Map from the loader data
  useEffect(() => {
    setAttendance(new Map(loadedAttendance));
  }, [loadedAttendance]);

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
    
    filtered.sort((a, b) => {
      const nameA = `${a.firstName} ${a.lastName}`.toLowerCase();
      const nameB = `${b.firstName} ${b.lastName}`.toLowerCase();
      return nameA.localeCompare(nameB);
    });

    return filtered;
  }, [contacts, searchQuery]);

  const parentRef = useRef<HTMLDivElement>(null);
  
  // Virtual list to power 60fps scrolling
  const virtualizer = useVirtualizer({
    count: processedContacts.length,
    getScrollElement: () => parentRef.current,
    estimateSize: () => 72,
    overscan: 10,
  });

  const handleDateChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    navigate({ search: { date: e.target.value } });
  };

  const markAttendance = async (contactId: string, status: 'Present' | 'Absent' | 'Late' | 'Excused') => {
    // Optimistic UI updates
    const previousState = new Map(attendance);
    const optimism = new Map(attendance);
    optimism.set(contactId, { contact_id: contactId, date, status });
    setAttendance(optimism);

    const { error } = await supabase
      .from('attendance_records')
      .upsert({ 
        contact_id: contactId, 
        date, 
        status 
      }, { onConflict: 'contact_id,date' });

    if (error) {
      console.error('Failed to update attendance:', error);
      // Revert optimistic update
      setAttendance(previousState);
    }
  };

  const getStatusColor = (status: string) => {
    switch(status) {
      case 'Present': return 'bg-emerald-100 text-emerald-700 border-emerald-200 dark:bg-emerald-950 dark:border-emerald-800 dark:text-emerald-400';
      case 'Absent': return 'bg-red-100 text-red-700 border-red-200 dark:bg-red-950 dark:border-red-800 dark:text-red-400';
      case 'Late': return 'bg-amber-100 text-amber-700 border-amber-200 dark:bg-amber-950 dark:border-amber-800 dark:text-amber-400';
      case 'Excused': return 'bg-primary/10 text-primary border-primary/20';
      default: return 'bg-muted text-muted-foreground border-border';
    }
  };

  // Metrics calculation
  const presentCount = Array.from(attendance.values()).filter(r => r.status === 'Present').length;
  const absentCount = Array.from(attendance.values()).filter(r => r.status === 'Absent').length;
  const lateCount = Array.from(attendance.values()).filter(r => r.status === 'Late').length;
  const totalMarked = attendance.size;
  const totalContacts = contacts.length;
  
  const presentRate = totalMarked > 0 ? Math.round((presentCount / totalMarked) * 100) : 0;

  const [activeTab, setActiveTab] = useState<'list' | 'metrics'>('list');

  return (
    <ProtectedRoute allowedRoles={['Super Admin', 'Admin', 'User']}>
      <div className="flex h-[calc(100vh-64px)] w-full overflow-hidden bg-background relative">
        
        {/* Mobile Toggle */}
        <div className="md:hidden absolute bottom-6 left-1/2 -translate-x-1/2 z-50 flex items-center justify-center rounded-full bg-foreground shadow-2xl p-1 gap-1">
          <button
            onClick={() => setActiveTab('list')}
            className={`rounded-full px-5 py-2 text-sm font-bold transition-all ${activeTab === 'list' ? 'bg-background text-foreground shadow-sm' : 'text-background/70 hover:text-background'}`}
          >
            List
          </button>
          <button
            onClick={() => setActiveTab('metrics')}
            className={`rounded-full px-5 py-2 text-sm font-bold transition-all ${activeTab === 'metrics' ? 'bg-background text-foreground shadow-sm' : 'text-background/70 hover:text-background'}`}
          >
            Metrics
          </button>
        </div>

        {/* Left Pane - Master List  */}
        <div className={`relative h-full w-full flex-col border-r border-border bg-card md:w-[450px] xl:w-[500px] ${activeTab === 'list' ? 'flex' : 'hidden md:flex'}`}>
          <div className="z-10 flex-shrink-0 bg-card/80 p-4 pt-6 backdrop-blur-xl">
            <h1 className="text-2xl font-bold tracking-tight text-foreground font-serif">Attendance List</h1>
            
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
                const record = attendance.get(contact.id);
                const currentStatus = record?.status;

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
                            {contact.firstName} <span className="font-bold">{contact.lastName}</span>
                          </span>
                          <span className="truncate text-xs text-muted-foreground">
                            {contact.company || 'No Company'}
                          </span>
                        </div>
                      </div>

                      {/* Action Buttons */}
                      <div className="flex items-center gap-1">
                        <AnimatePresence>
                          <motion.button
                            whileHover={{ scale: 1.1 }}
                            whileTap={{ scale: 0.9 }}
                            onClick={() => markAttendance(contact.id, 'Present')}
                            className={`flex h-8 w-8 items-center justify-center rounded-full border transition-all ${currentStatus === 'Present' ? 'bg-emerald-500 border-emerald-600 text-white shadow-md' : 'border-border bg-card text-muted-foreground hover:border-emerald-500 hover:text-emerald-500'}`}
                            title="Present"
                          >
                            <CheckCircle2 className="h-5 w-5" />
                          </motion.button>
                          
                          <motion.button
                            whileHover={{ scale: 1.1 }}
                            whileTap={{ scale: 0.9 }}
                            onClick={() => markAttendance(contact.id, 'Absent')}
                            className={`flex h-8 w-8 items-center justify-center rounded-full border transition-all ${currentStatus === 'Absent' ? 'bg-red-500 border-red-600 text-white shadow-md' : 'border-border bg-card text-muted-foreground hover:border-red-500 hover:text-red-500'}`}
                            title="Absent"
                          >
                            <XCircle className="h-5 w-5" />
                          </motion.button>

                          <motion.button
                            whileHover={{ scale: 1.1 }}
                            whileTap={{ scale: 0.9 }}
                            onClick={() => markAttendance(contact.id, 'Late')}
                            className={`flex h-8 w-8 items-center justify-center rounded-full border transition-all ${currentStatus === 'Late' ? 'bg-amber-500 border-amber-600 text-white shadow-md' : 'border-border bg-card text-muted-foreground hover:border-amber-500 hover:text-amber-500'}`}
                            title="Late"
                          >
                            <Clock className="h-4 w-4" />
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
            <div className="flex items-center justify-between mb-8">
              <div>
                <h2 className="text-3xl font-bold tracking-tight text-foreground font-serif">Daily Overview</h2>
                <p className="mt-1 text-muted-foreground font-sans">Review attendance metrics and manage records.</p>
              </div>
              <div className="flex items-center gap-3 rounded-xl border border-border bg-card p-2 pr-4 shadow-sm font-sans">
                <div className="flex items-center justify-center rounded-lg bg-primary/10 p-2">
                  <Calendar className="h-5 w-5 text-primary" />
                </div>
                <input 
                  type="date"
                  value={date}
                  onChange={handleDateChange}
                  className="bg-transparent text-sm font-medium text-foreground focus:outline-none"
                />
              </div>
            </div>

            {/* Metrics Grid */}
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4 font-sans">
              <div className="rounded-2xl border border-border bg-card p-6 shadow-sm">
                <p className="text-sm font-medium text-muted-foreground">Total Marked</p>
                <div className="mt-2 flex items-baseline gap-2">
                  <span className="text-4xl font-bold text-foreground font-serif">{totalMarked}</span>
                  <span className="text-sm text-muted-foreground">of {totalContacts}</span>
                </div>
                <div className="mt-4 h-2 w-full overflow-hidden rounded-full bg-muted">
                  <div 
                    className="h-full bg-primary transition-all duration-500" 
                    style={{ width: `${totalContacts > 0 ? (totalMarked / totalContacts) * 100 : 0}%` }}
                  />
                </div>
              </div>

              <div className="rounded-2xl border border-emerald-200 bg-emerald-50 p-6 shadow-sm dark:border-emerald-900/30 dark:bg-emerald-950/20">
                <div className="flex items-center gap-2">
                  <CheckCircle2 className="h-5 w-5 text-emerald-600 hover:scale-105 transition-transform" />
                  <p className="text-sm font-medium text-emerald-800 dark:text-emerald-400">Present</p>
                </div>
                <div className="mt-2 flex items-baseline gap-2">
                  <span className="text-4xl font-bold text-emerald-700 dark:text-emerald-300 font-serif">{presentCount}</span>
                </div>
                <p className="mt-1 text-sm font-medium text-emerald-600 dark:text-emerald-500">{presentRate}% of marked</p>
              </div>

              <div className="rounded-2xl border border-red-200 bg-red-50 p-6 shadow-sm dark:border-red-900/30 dark:bg-red-950/20">
                <div className="flex items-center gap-2">
                  <XCircle className="h-5 w-5 text-red-600 hover:scale-105 transition-transform" />
                  <p className="text-sm font-medium text-red-800 dark:text-red-400">Absent</p>
                </div>
                <div className="mt-2 flex items-baseline gap-2">
                  <span className="text-4xl font-bold text-red-700 dark:text-red-300 font-serif">{absentCount}</span>
                </div>
              </div>

              <div className="rounded-2xl border border-amber-200 bg-amber-50 p-6 shadow-sm dark:border-amber-900/30 dark:bg-amber-950/20">
                <div className="flex items-center gap-2">
                  <Clock className="h-5 w-5 text-amber-600 hover:scale-105 transition-transform" />
                  <p className="text-sm font-medium text-amber-800 dark:text-amber-400">Late</p>
                </div>
                <div className="mt-2 flex items-baseline gap-2">
                  <span className="text-4xl font-bold text-amber-700 dark:text-amber-300 font-serif">{lateCount}</span>
                </div>
              </div>
            </div>

            {/* Quick Actions / Summary List */}
            <div className="mt-8 rounded-2xl border border-border bg-card shadow-sm overflow-hidden font-sans">
              <div className="border-b border-border bg-muted/50 px-6 py-4">
                <h3 className="text-sm font-bold text-foreground font-serif tracking-tight">Recent Updates</h3>
              </div>
              <div className="divide-y divide-border">
                {Array.from(attendance.values()).slice(-5).reverse().map((record: any, idx) => {
                  const contact = contacts.find(c => c.id === record.contact_id);
                  if (!contact) return null;
                  
                  return (
                    <div key={idx} className="flex items-center justify-between px-6 py-3">
                      <div className="flex items-center gap-3">
                        <img src={contact.avatarUrl} className="h-8 w-8 rounded-full border border-border" alt="" />
                        <span className="text-sm font-medium text-foreground">{contact.firstName} {contact.lastName}</span>
                      </div>
                      <span className={`px-2.5 py-1 rounded-full text-[10px] uppercase tracking-wider font-bold border ${getStatusColor(record.status)}`}>
                        {record.status}
                      </span>
                    </div>
                  );
                })}
                {attendance.size === 0 && (
                  <div className="p-8 text-center text-sm text-muted-foreground">No attendance marked for this date.</div>
                )}
              </div>
            </div>
            
          </motion.div>
        </div>

      </div>
    </ProtectedRoute>
  );
}
