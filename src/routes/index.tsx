import { createFileRoute, ErrorComponent, Link } from '@tanstack/react-router';
import { ProtectedRoute } from '../components/ProtectedRoute';
import { supabase } from '../lib/supabase';
import { Users, CheckCircle2, Navigation, BookText, ArrowRight, Calendar, Activity } from 'lucide-react';
import { format } from 'date-fns';
import { Spinner } from '#/components/ui/spinner';

const getTodayDateString = () => {
  const d = new Date();
  d.setMinutes(d.getMinutes() - d.getTimezoneOffset());
  return d.toISOString().split('T')[0];
};

export const Route = createFileRoute('/')({
  loader: {
    handler: async () => {
      // Explicitly block and wait for Supabase to resolve the session from Local Storage before issuing data sweeps
      await supabase.auth.getSession();

      const today = getTodayDateString();

      // Parallel fetch aggregate metrics securely from Supabase
      const [
        contactsRes,
        attendanceRes,
        travelRes,
        journalRes
      ] = await Promise.all([
        supabase.from('contacts').select('*', { count: 'exact', head: true }),
        supabase.from('attendance_records').select('*', { count: 'exact', head: true }).eq('date', today).eq('status', 'Present'),
        supabase.from('travel_plans').select('date, travel_stops(title)').order('date', { ascending: false }).limit(1).maybeSingle(),
        supabase.from('journal_entries').select('content, created_at, journal_media(file_type, file_path)').order('created_at', { ascending: false }).limit(1).maybeSingle(),
      ]);

      // console.log({ contactsRes, attendanceRes, travelRes, journalRes })

      return {
        contactsCount: contactsRes?.count,
        attendanceCount: attendanceRes?.count,
        latestTravel: travelRes?.data,
        latestJournal: journalRes?.data,
      };
    },
    staleReloadMode: 'blocking',
  },
  component: Dashboard,
  pendingComponent: () => <Spinner />,
  pendingMs: 500,
  pendingMinMs: 300,
  errorComponent: ({ error }) => {
    return <ErrorComponent error={error} />
  },
  onError: ({ error }) => {
    console.error(error)
  },
});

function Dashboard() {
  const { contactsCount, attendanceCount, latestTravel, latestJournal } = Route.useLoaderData();
  const today = new Date();

  return (
    <ProtectedRoute allowedRoles={['Super Admin', 'Admin', 'User']}>
      <div className="min-h-[calc(100vh-64px)] w-full p-4 sm:p-8 md:p-12 overflow-y-auto bg-background">
        <div className="mx-auto max-w-6xl">

          {/* Hero Header */}
          <div className="mb-10 flex flex-col md:flex-row md:items-end justify-between gap-6">
            <div>
              <p className="flex items-center gap-2 text-sm font-bold tracking-widest text-primary uppercase mb-2 font-sans">
                <Activity className="h-4 w-4" /> Mission Double
              </p>
              <h1 className="text-4xl sm:text-5xl font-extrabold text-foreground drop-shadow-sm font-serif">
                Dashboard
              </h1>
              <p className="mt-3 text-base font-medium text-muted-foreground max-w-xl font-sans">
                Jai Swaminarayan, das na das banavshoji 🙇🏻‍♂️
              </p>
            </div>

            <div className="flex shrink-0 items-center gap-3 rounded-2xl bg-card p-4 shadow-sm border border-border font-sans">
              <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-primary/10 text-primary">
                <Calendar className="h-6 w-6" />
              </div>
              <div>
                <p className="text-xs font-bold text-muted-foreground uppercase tracking-wider font-sans">Today's Date</p>
                <p className="text-lg font-bold text-foreground font-serif">{format(today, "MMMM do, yyyy")}</p>
              </div>
            </div>
          </div>

          {/* Bento Box Grid */}
          <div className="grid grid-cols-1 gap-6 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 auto-rows-[minmax(180px,auto)]">

            {/* Contacts Tile */}
            <Link to="/contacts" className="group relative overflow-hidden rounded-[1.5rem] bg-card p-6 shadow-sm border border-border transition-all hover:-translate-y-1 hover:shadow-md hover:border-primary/50 xl:col-span-1 flex flex-col justify-between">
              <div className="relative z-10 flex h-full flex-col justify-between">
                <div className="flex items-center gap-3 text-foreground">
                  <div className="rounded-xl bg-primary/10 p-2.5 text-primary">
                    <Users className="h-6 w-6" />
                  </div>
                  <h3 className="font-semibold text-lg font-serif">Contacts</h3>
                </div>
                <div className="mt-8">
                  <p className="text-muted-foreground text-sm font-medium mb-1 font-sans">Total Network</p>
                  <div className="flex items-end justify-between">
                    <p className="text-5xl font-black text-foreground font-serif">{contactsCount}</p>
                    <div className="flex items-center gap-1 text-primary text-sm font-semibold opacity-0 -translate-x-2 transition-all group-hover:opacity-100 group-hover:translate-x-0 font-sans">
                      Manage <ArrowRight className="h-4 w-4" />
                    </div>
                  </div>
                </div>
              </div>
            </Link>

            {/* Attendance Tile */}
            <Link to="/attendance" className="group relative overflow-hidden rounded-[1.5rem] bg-card p-6 shadow-sm border border-border transition-all hover:-translate-y-1 hover:shadow-md hover:border-primary/50 xl:col-span-1 flex flex-col justify-between">
              <div className="relative z-10 flex h-full flex-col justify-between">
                <div className="flex items-center gap-3 text-foreground">
                  <div className="rounded-xl bg-primary/10 p-2.5 text-primary">
                    <CheckCircle2 className="h-6 w-6" />
                  </div>
                  <h3 className="font-semibold text-lg font-serif">Attendance</h3>
                </div>
                <div className="mt-8">
                  <p className="text-muted-foreground text-sm font-medium mb-1 font-sans">Present Today</p>
                  <div className="flex items-end justify-between">
                    <div className="flex items-baseline gap-1">
                      <p className="text-5xl font-black text-foreground font-serif">{attendanceCount}</p>
                      <span className="text-muted-foreground font-medium font-sans">/ {contactsCount}</span>
                    </div>
                    <div className="flex items-center gap-1 text-primary text-sm font-semibold opacity-0 -translate-x-2 transition-all group-hover:opacity-100 group-hover:translate-x-0 font-sans">
                      Roll Call <ArrowRight className="h-4 w-4" />
                    </div>
                  </div>
                </div>
              </div>
            </Link>

            {/* Travel Tile (Double Width on large screens) */}
            <Link to="/travel" search={{ date: new Date().toISOString().split('T')[0] }} className="group relative overflow-hidden rounded-[1.5rem] bg-card p-6 shadow-sm border border-border transition-all hover:-translate-y-1 hover:shadow-md hover:border-primary/50 md:col-span-2 xl:col-span-2 flex flex-col sm:flex-row gap-6">
              <div className="flex-1 flex flex-col justify-between relative z-10">
                <div>
                  <div className="flex items-center gap-2 text-primary mb-4 font-sans">
                    <Navigation className="h-5 w-5" />
                    <h3 className="font-bold text-sm tracking-widest uppercase">Vicharan</h3>
                  </div>

                  {latestTravel ? (
                    <>
                      <h4 className="text-2xl font-black text-foreground mb-2 font-serif">Upcoming Trip: {latestTravel.date}</h4>
                      <div className="flex flex-wrap gap-2 mt-3 font-sans">
                        {latestTravel.travel_stops?.slice(0, 3).map((stop: any, idx: number) => (
                          <div key={idx} className="bg-muted rounded-lg px-3 py-1.5 text-sm font-semibold text-muted-foreground flex items-center gap-2 border border-border">
                            <div className="h-2 w-2 rounded-full bg-primary" />
                            {stop.title.split(',')[0]}
                          </div>
                        ))}
                        {(latestTravel.travel_stops?.length || 0) > 3 && (
                          <div className="bg-muted border border-border rounded-lg px-3 py-1.5 text-sm font-medium text-muted-foreground">
                            + {(latestTravel.travel_stops?.length || 0) - 3} more stops
                          </div>
                        )}
                      </div>
                    </>
                  ) : (
                    <div className="h-full flex flex-col justify-center font-sans">
                      <h4 className="text-xl font-bold text-muted-foreground mb-1">No upcoming routes mapped</h4>
                      <p className="text-sm font-medium text-muted-foreground">Click to configure the itinerary builder.</p>
                    </div>
                  )}
                </div>

                <div className="mt-6 flex items-center gap-1.5 font-bold text-primary font-sans">
                  Open Travel Planner <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-1" />
                </div>
              </div>
            </Link>

            {/* Journal Tile (Spans remaining width) */}
            <Link to="/journal" search={{ stopId: undefined }} className="group relative overflow-hidden rounded-[1.5rem] bg-card p-6 shadow-sm border border-border transition-all hover:-translate-y-1 hover:shadow-md hover:border-primary/50 md:col-span-2 xl:col-span-2 flex flex-col justify-between">
              {latestJournal?.journal_media?.find((m: any) => m.file_type === 'image') && (
                <>
                  <div className="absolute inset-0 z-0 opacity-[0.03] mix-blend-overlay transition-transform duration-700 group-hover:scale-105 pointer-events-none">
                    <img
                      src={supabase.storage.from('journal-media').getPublicUrl(latestJournal.journal_media.find((m: any) => m.file_type === 'image')!.file_path).data.publicUrl}
                      className="h-full w-full object-cover grayscale"
                      alt=""
                    />
                  </div>
                </>
              )}

              <div className="relative z-10 flex items-center justify-between text-muted-foreground mb-6 border-b border-border pb-4 font-sans">
                <div className="flex items-center gap-2 uppercase tracking-widest text-xs font-bold text-primary">
                  <BookText className="h-4 w-4" /> Smruties
                </div>
                {latestJournal && (
                  <div className="text-xs font-semibold">
                    {format(new Date(latestJournal.created_at), "MMM do, h:mm a")}
                  </div>
                )}
              </div>

              <div className="relative z-10 flex-1 flex flex-col justify-center">
                {latestJournal ? (
                  <>
                    <p className="text-xl font-medium leading-relaxed text-foreground line-clamp-3 font-serif">
                      {latestJournal.content || "Media attached. Click to view full log details and galleries."}
                    </p>

                    {latestJournal.journal_media && latestJournal.journal_media.length > 0 && (
                      <div className="flex gap-2 mt-4 font-sans">
                        <div className="rounded-full bg-muted px-3 py-1 text-xs font-bold text-muted-foreground border border-border">
                          {latestJournal.journal_media.length} Attachments
                        </div>
                      </div>
                    )}
                  </>
                ) : (
                  <div className="text-center py-4 font-sans">
                    <BookText className="h-8 w-8 text-muted-foreground mx-auto mb-3" />
                    <p className="text-muted-foreground font-medium">The journal archive is empty.</p>
                  </div>
                )}
              </div>

              <div className="relative z-10 mt-6 flex items-center justify-between font-sans">
                <span className="text-primary text-sm font-bold opacity-0 -translate-x-2 transition-all group-hover:opacity-100 group-hover:translate-x-0">
                  Open Archive
                </span>
                <div className="h-10 w-10 text-primary bg-primary/10 rounded-full flex items-center justify-center transition-transform group-hover:scale-110">
                  <ArrowRight className="h-5 w-5" />
                </div>
              </div>
            </Link>

          </div>
        </div>
      </div>
    </ProtectedRoute>
  );
}
