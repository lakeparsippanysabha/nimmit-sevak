import { createFileRoute, useNavigate } from '@tanstack/react-router';
import { ProtectedRoute } from '../components/ProtectedRoute';
import { useState, useEffect, useRef, useMemo } from 'react';
import { Reorder, AnimatePresence, motion } from 'framer-motion';
import { Map, Marker, Source, Layer } from 'react-map-gl/mapbox';
import 'mapbox-gl/dist/mapbox-gl.css';
import { MapPin, Search, Plus, GripVertical, Clock, X, Calendar as CalendarIcon, BookText, Share, Navigation, User, ChevronLeft, ChevronRight } from 'lucide-react';
import { Link } from '@tanstack/react-router';
import { supabase } from '../lib/supabase';
import { fetchDirections, geocode } from '../lib/mapbox';
import { handleMutationError } from '../lib/errors';
import type { ContactRow } from '../lib/database.types';
import { mapContactRows } from '../lib/mappers';
import type { Contact } from '../data/mockContacts';
import { useAuth } from '../contexts/AuthContext';

const MAPBOX_TOKEN = import.meta.env.VITE_MAPBOX_TOKEN;

interface TravelStop {
  id: string;
  order_index: number;
  type: 'contact' | 'custom' | 'break';
  title: string;
  address: string;
  lat: number;
  lng: number;
  planned_time?: string;
  drive_time_mins?: number;
}

const getTodayDateString = () => {
  const d = new Date();
  d.setMinutes(d.getMinutes() - d.getTimezoneOffset());
  return d.toISOString().split('T')[0];
};

export const Route = createFileRoute('/travel')({
  validateSearch: (search: Record<string, unknown>) => ({
    date: (search.date as string) || getTodayDateString(),
  }),
  loaderDeps: ({ search: { date } }) => ({ date }),
  loader: async ({ deps: { date } }) => {
    await supabase.auth.getSession();

    let planId = null;
    let stops: TravelStop[] = [];
    
    // Fetch current day plan
    const { data: plans } = await supabase.from('travel_plans').select('id').eq('date', date);
    if (plans && plans.length > 0) {
      planId = plans[0].id;
      const { data: stopsData } = await supabase
        .from('travel_stops')
        .select('*')
        .eq('plan_id', planId)
        .order('order_index', { ascending: true });
        
      if (stopsData) stops = stopsData;
    }

    // Fetch all active travel dates for calendar dots
    const { data: allPlans } = await supabase.from('travel_plans').select('date');
    const itineraryDates = (allPlans || []).map(p => p.date);
    
    // Fetch contacts for searching
    const { data: contactsData } = await supabase.from('contacts').select('*').order('first_name');
    const contacts = mapContactRows((contactsData || []) as ContactRow[]);

    return { date, planId, savedStops: stops, contacts, itineraryDates };
  },
  component: TravelPage,
});

function TravelPage() {
  const navigate = useNavigate({ from: '/travel' });
  const { date, planId: initialPlanId, savedStops, contacts, itineraryDates } = Route.useLoaderData();
  const { role } = useAuth();
  const isAdmin = role === 'Super Admin' || role === 'Admin';
  
  const [currentPlanId, setCurrentPlanId] = useState<string | null>(initialPlanId);
  const [stops, setStops] = useState<TravelStop[]>(savedStops);
  const [routeGeoJSON, setRouteGeoJSON] = useState<any>(null);
  const [toastMessage, setToastMessage] = useState<{title: string, type: 'success' | 'error'} | null>(null);
  const mapRef = useRef<any>(null);
  
  // Modals/UI State
  const [isAddStopOpen, setIsAddStopOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<any[]>([]);
  
  // Staging Stop (Requirement 7 & Contact logic)
  const [stagedStop, setStagedStop] = useState<{ title: string, address: string, lat: number, lng: number } | null>(null);
  const [stagedTitle, setStagedTitle] = useState('');

  // Calendar State
  const [isCalendarOpen, setIsCalendarOpen] = useState(false);
  const [calendarMonth, setCalendarMonth] = useState(new Date(date + 'T00:00:00'));

  const [isDarkTheme, setIsDarkTheme] = useState(false);
  const [activeTab, setActiveTab] = useState<'list' | 'map'>('list');

  useEffect(() => {
    setIsDarkTheme(document.documentElement.classList.contains('dark'));
    const observer = new MutationObserver(() => {
      setIsDarkTheme(document.documentElement.classList.contains('dark'));
    });
    observer.observe(document.documentElement, { attributes: true, attributeFilter: ['class'] });
    return () => observer.disconnect();
  }, []);

  // Force mapbox to repaint canvas when mobile tab switches to avoid bounding box glitch
  useEffect(() => {
    if (activeTab === 'map' && mapRef.current) {
      setTimeout(() => mapRef.current.resize(), 100);
    }
  }, [activeTab]);

  useEffect(() => {
    setCurrentPlanId(initialPlanId);
    setStops(savedStops);
  }, [savedStops, initialPlanId]);

  // Recalculate routes and drives
  useEffect(() => {
    if (stops.length < 2) {
      setRouteGeoJSON(null);
      return;
    }
    
    const coords: [number, number][] = stops.map(s => [s.lng, s.lat]);
    
    fetchDirections(coords).then((route) => {
      if (route && route.geometry) {
        setRouteGeoJSON(route.geometry);
        // Estimate drives between legs
        if (route.legs) {
          const updatedStops = [...stops];
          let changed = false;
          route.legs.forEach((leg: any, i: number) => {
            const driveMins = Math.round(leg.duration / 60);
            // Requirement 2: Leg i calculates time FROM stop i TO stop i + 1. 
            // We should store it on origin i so we don't skew the index on UI.
            if (updatedStops[i].drive_time_mins !== driveMins) {
              updatedStops[i].drive_time_mins = driveMins;
              changed = true;
            }
          });
          if (changed) {
            setStops(updatedStops);
            if (currentPlanId) {
               supabase.from('travel_stops').upsert(
                 updatedStops.map(s => ({
                   id: s.id,
                   plan_id: currentPlanId,
                   order_index: s.order_index,
                   type: s.type,
                   title: s.title,
                   address: s.address,
                   lat: s.lat,
                   lng: s.lng,
                   planned_time: s.planned_time,
                   drive_time_mins: s.drive_time_mins
                 }))
               ).then(() => {});
            }
          }
        }
      }
    });
  }, [stops.map(s => s.id).join(','), stops.length]);

  // Map fit bounds logic
  useEffect(() => {
    if (mapRef.current && stops.length > 0) {
      if (stops.length === 1) {
        mapRef.current.flyTo({ center: [stops[0].lng, stops[0].lat], zoom: 12, duration: 1000 });
      } else {
        const lngs = stops.map(s => s.lng);
        const lats = stops.map(s => s.lat);
        mapRef.current.fitBounds(
          [
             [Math.min(...lngs), Math.min(...lats)],
             [Math.max(...lngs), Math.max(...lats)]
          ],
          { padding: 80, duration: 1000 }
        );
      }
    }
  }, [stops.map(s => s.id).join(','), routeGeoJSON]);

  // Combined Search (Contacts + Mapbox)
  const contactResults = useMemo(() => {
    if (searchQuery.trim().length < 2) return [];
    const q = searchQuery.toLowerCase();
    return contacts.filter(c => 
      c.firstName.toLowerCase().includes(q) || 
      c.lastName.toLowerCase().includes(q) || 
      (c.city && c.city.toLowerCase().includes(q))
    ).slice(0, 5);
  }, [searchQuery, contacts]);

  useEffect(() => {
    const timer = setTimeout(() => {
      if (searchQuery.trim().length > 2) {
        geocode(searchQuery).then(results => setSearchResults(results.slice(0, 5)));
      } else {
        setSearchResults([]);
      }
    }, 400);
    return () => clearTimeout(timer);
  }, [searchQuery]);

  const handleReorder = async (newStops: TravelStop[]) => {
    const ordered = newStops.map((stop, index) => ({ ...stop, order_index: index }));
    setStops(ordered);
    if (currentPlanId) {
      const { error } = await supabase.from('travel_stops').upsert(
        ordered.map(s => ({
          id: s.id,
          plan_id: currentPlanId,
          order_index: s.order_index,
          type: s.type,
          title: s.title,
          address: s.address,
          lat: s.lat,
          lng: s.lng,
          planned_time: s.planned_time,
          drive_time_mins: s.drive_time_mins
        }))
      );
      if (error) handleMutationError('travel:reorder-sync', error);
    }
  };

  const handleContactSelection = async (contact: Contact) => {
    const fullAddress = `${contact.address1 || ''} ${contact.city || ''} ${contact.state || ''} ${contact.zip || ''}`.trim();
    if (!fullAddress) {
      alert("This contact does not have a saved address to route to.");
      return;
    }
    
    // Geocode the contact address to obtain precise lat/lng
    const geoResults = await geocode(fullAddress);
    if (geoResults && geoResults.length > 0) {
      const place = geoResults[0];
      setStagedStop({
        title: `${contact.firstName} ${contact.lastName}`,
        address: place.place_name,
        lat: place.center[1],
        lng: place.center[0]
      });
      setStagedTitle(`${contact.firstName} ${contact.lastName}`);
    } else {
      alert("Address could not be mapped reliably.");
    }
  };

  const handleMapboxSelection = (place: any) => {
    let defaultTitle = place.text;
    setStagedStop({
      title: defaultTitle,
      address: place.place_name,
      lat: place.center[1],
      lng: place.center[0]
    });
    setStagedTitle(defaultTitle);
  };

  const commitStagedStop = async () => {
    if (!stagedStop) return;
    
    let targetPlanId = currentPlanId;
    if (!targetPlanId) {
      let { data, error } = await supabase.from('travel_plans').insert({ date }).select().single();
      if (error && error.code === '23505') {
         const existing = await supabase.from('travel_plans').select('id').eq('date', date).single();
         data = existing.data;
         error = existing.error;
      }
      if (error || !data) {
        handleMutationError('travel:create-plan', error);
        return;
      }
      targetPlanId = data.id;
      setCurrentPlanId(targetPlanId);
    }
    
    const { data: newDbStop, error: stopError } = await supabase.from('travel_stops').insert({
      plan_id: targetPlanId,
      order_index: stops.length,
      type: 'custom',
      title: stagedTitle.trim() || stagedStop.title,
      address: stagedStop.address,
      lat: stagedStop.lat,
      lng: stagedStop.lng,
    }).select().single();
    
    if (stopError) {
      handleMutationError('travel:insert-stop', stopError);
      return;
    }

    setStops(prev => [...prev, newDbStop as TravelStop]);
    setStagedStop(null);
    setIsAddStopOpen(false);
    setSearchQuery('');
  };

  const removeStop = async (id: string) => {
    setStops(stops.filter(s => s.id !== id));
    await supabase.from('travel_stops').delete().eq('id', id);
  };

  const updateStopTime = async (id: string, timeValue: string) => {
    setStops(prev => prev.map(s => s.id === id ? { ...s, planned_time: timeValue } : s));
    await supabase.from('travel_stops').update({ planned_time: timeValue }).eq('id', id);
  };

  // Requirement 6: SMS Serialization
  const shareItinerary = async () => {
    if (stops.length === 0) return;
    
    let msg = `📅 *Itinerary: ${date}*\n\n`;
    stops.forEach((stop, i) => {
      msg += `📍 *${i + 1}. ${stop.title}*\n`;
      if (stop.planned_time) {
        // Format time nicely
        const [hh, mm] = stop.planned_time.split(':');
        const h = parseInt(hh);
        const ampm = h >= 12 ? 'PM' : 'AM';
        const h12 = h % 12 || 12;
        msg += `🕒 Time: ${h12}:${mm} ${ampm}\n`;
      }
      msg += `🏠 ${stop.address}\n`;
      
      // Since drive_time_mins is on the origin going to destination `i+1`
      if (i < stops.length - 1 && stop.drive_time_mins) {
        msg += `⬇️ 🚗 Drive ~${stop.drive_time_mins} min\n`;
      }
      msg += `\n`;
    });
    
    try {
      await navigator.clipboard.writeText(msg);
      setToastMessage({ title: 'Itinerary copied to clipboard!', type: 'success' });
      setTimeout(() => setToastMessage(null), 5000);
    } catch (err: any) {
      setToastMessage({ title: 'Failed to copy: ' + err.message, type: 'error' });
      setTimeout(() => setToastMessage(null), 5000);
    }
  };

  const centerLat = stops.length > 0 ? stops[0].lat : 40.7128;
  const centerLng = stops.length > 0 ? stops[0].lng : -74.0060;

  // Custom Calendar Generator
  const generateCalendarDays = () => {
    const year = calendarMonth.getFullYear();
    const month = calendarMonth.getMonth();
    const firstDay = new Date(year, month, 1);
    const lastDay = new Date(year, month + 1, 0);
    const days = [];
    
    // Padding blanks
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
      {!MAPBOX_TOKEN && (
        <div className="absolute top-16 left-0 z-50 w-full bg-destructive py-2 text-center text-sm font-bold text-destructive-foreground shadow-xl">
          Warning: Missing VITE_MAPBOX_TOKEN in .env. Map functionality is disabled.
        </div>
      )}
      
      {/* Mobile viewport height adjustment */}
      <div className="flex h-[calc(100vh-64px)] w-full overflow-hidden bg-background relative selection-none">
        
        {/* Mobile Toggle */}
        <div className="md:hidden absolute bottom-6 left-1/2 -translate-x-1/2 z-50 flex items-center justify-center rounded-full bg-foreground shadow-2xl p-1 gap-1">
          <button
            onClick={() => setActiveTab('list')}
            className={`rounded-full px-5 py-2 text-sm font-bold transition-all ${activeTab === 'list' ? 'bg-background text-foreground shadow-sm' : 'text-background/70 hover:text-background'}`}
          >
            Planner
          </button>
          <button
            onClick={() => setActiveTab('map')}
            className={`rounded-full px-5 py-2 text-sm font-bold transition-all ${activeTab === 'map' ? 'bg-background text-foreground shadow-sm' : 'text-background/70 hover:text-background'}`}
          >
            Map
          </button>
        </div>

        {/* Left Pane - Timeline Planner */}
        <div className={`relative h-full w-full flex-col border-r border-border bg-background md:w-[450px] xl:w-[500px] shadow-[10px_0_30px_rgba(0,0,0,0.05)] z-20 ${activeTab === 'list' ? 'flex' : 'hidden md:flex'}`}>
          
          {/* Header */}
          <div className="flex-shrink-0 bg-card p-6 pt-8 border-b border-border/60 z-[60] shadow-sm relative">
            <div className="flex items-center justify-between">
              <h1 className="text-2xl font-bold tracking-tight text-foreground font-serif">Travel Itinerary</h1>
              <button onClick={shareItinerary} title="Share Text" className="p-2 rounded-full bg-primary/10 text-primary hover:bg-primary/20 transition-colors">
                <Share className="h-4 w-4" />
              </button>
            </div>
            
            {/* Custom Interactive Calendar Trigger */}
            <div className="mt-5 relative">
              <button 
                onClick={() => setIsCalendarOpen(!isCalendarOpen)}
                className="flex items-center gap-3 w-full rounded-xl border border-border bg-background p-3 text-left font-sans hover:border-primary/50 transition-colors shadow-sm"
              >
                <div className="flex items-center justify-center rounded-lg bg-primary/10 p-2">
                  <CalendarIcon className="h-5 w-5 text-primary" />
                </div>
                <div className="flex-1">
                  <div className="text-xs text-muted-foreground font-bold tracking-wider uppercase">Selected Date</div>
                  <div className="text-sm font-bold text-foreground mt-0.5">
                    {new Date(date + 'T12:00:00').toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' })}
                  </div>
                </div>
              </button>

              {/* Calendar Popover */}
              <AnimatePresence>
                {isCalendarOpen && (
                  <motion.div 
                    initial={{ opacity: 0, y: -10, scale: 0.95 }}
                    animate={{ opacity: 1, y: 0, scale: 1 }}
                    exit={{ opacity: 0, y: -10, scale: 0.95 }}
                    className="absolute top-16 left-0 right-0 rounded-2xl bg-card border border-border shadow-2xl p-4 z-50 font-sans"
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
                        const hasItinerary = itineraryDates.includes(dateStr);
                        
                        return (
                          <button
                            key={i}
                            onClick={() => {
                              navigate({ search: { date: dateStr } });
                              setIsCalendarOpen(false);
                            }}
                            className={`relative flex h-8 items-center justify-center rounded-md text-xs transition-colors hover:bg-primary/20 hover:text-primary ${isSelected ? 'bg-primary text-primary-foreground font-bold shadow-md hover:bg-primary hover:text-primary-foreground' : 'text-foreground'}`}
                          >
                            {d.getDate()}
                            {/* Requirement 5 Indicator */}
                            {hasItinerary && !isSelected && (
                              <div className="absolute bottom-1 left-1/2 -translate-x-1/2 w-1 h-1 rounded-full bg-primary" />
                            )}
                            {hasItinerary && isSelected && (
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

          {/* Timeline Reorderable List */}
          <div className="flex-1 overflow-y-auto p-4 py-8 font-sans bg-muted/20">
            <Reorder.Group axis="y" values={stops} onReorder={handleReorder} className="space-y-10">
              {stops.map((stop, index) => (
                <Reorder.Item key={stop.id} value={stop} className="relative z-10 mx-auto w-full group/item">
                  
                  {/* Vertical Line Connector */}
                  {index > 0 && (
                    <div className="absolute -top-6 left-[34px] h-6 w-[3px] bg-primary/20 dark:bg-primary/10 rounded-full" />
                  )}

                  {/* Drive Time Indicator fetching time stored on Previous Index (Req 2) */}
                  {index > 0 && stops[index - 1].drive_time_mins !== undefined && stops[index-1].drive_time_mins! > 0 && (
                     <div className="absolute -top-4 left-[34px] z-20 flex -translate-y-1/2 -translate-x-1/2 items-center justify-center rounded-full bg-amber-100 dark:bg-amber-900/50 px-2.5 py-0.5 text-[10px] font-bold tracking-tight text-amber-700 dark:text-amber-400 shadow-sm border border-amber-200 dark:border-amber-800 backdrop-blur-md">
                       <Navigation className="h-3 w-3 mr-1 inline" />
                       {stops[index - 1].drive_time_mins} min drive
                     </div>
                  )}
                  
                  {/* Enhanced Card Layout (Req 3) */}
                  <div className="flex items-stretch gap-4 rounded-2xl border border-border/80 bg-card p-5 shadow-sm transition-all hover:border-primary/50 hover:shadow-lg">
                    <div className="flex cursor-grab flex-col items-center justify-start pt-1 text-muted-foreground/50 hover:text-primary active:cursor-grabbing">
                      <div className="flex h-7 w-7 items-center justify-center rounded-full bg-primary/10 text-primary font-bold text-xs ring-2 ring-background">
                        {index + 1}
                      </div>
                      <GripVertical className="h-4 w-4 mt-3 opacity-50" />
                    </div>
                    
                    <div className="flex-1 min-w-0 flex flex-col justify-between">
                      <div>
                        <div className="flex items-start justify-between gap-2">
                          <h3 className="font-bold text-foreground font-serif text-lg leading-tight w-full break-words pr-4">{stop.title}</h3>
                          <button onClick={() => removeStop(stop.id)} className="text-muted-foreground/40 hover:text-destructive hover:bg-destructive/10 p-1.5 rounded-md transition-colors -mt-1 -mr-1 flex-shrink-0">
                            <X className="h-4 w-4" />
                          </button>
                        </div>
                        <p className="mt-1.5 text-xs text-muted-foreground leading-relaxed line-clamp-2">
                          {stop.address}
                        </p>
                      </div>
                      
                      <div className="mt-5 flex items-center justify-between border-t border-border/50 pt-3">
                        <div className="flex items-center gap-1.5 text-xs font-semibold text-foreground bg-muted/50 border border-border px-2.5 py-1.5 rounded-lg focus-within:ring-1 focus-within:ring-primary focus-within:bg-background transition-colors">
                          <Clock className="h-3.5 w-3.5 text-primary/70" />
                          <input 
                            type="time" 
                            title="Set planned time"
                            value={stop.planned_time || ''}
                            onChange={(e) => updateStopTime(stop.id, e.target.value)}
                            className="bg-transparent outline-none w-[72px] cursor-text text-foreground placeholder:text-muted-foreground"
                          />
                        </div>
                        
                        <Link 
                          to="/journal" 
                          search={{ stopId: stop.id }} 
                          className="flex items-center gap-1.5 text-xs font-bold text-primary hover:text-primary-foreground bg-primary/10 hover:bg-primary px-3 py-1.5 rounded-lg transition-colors ring-1 ring-primary/20 hover:ring-primary shadow-sm"
                        >
                          <BookText className="h-3.5 w-3.5" />
                          Smruti Log
                        </Link>
                      </div>
                    </div>
                  </div>
                </Reorder.Item>
              ))}
              
              {stops.length === 0 && (
                <div className="text-center p-8 mt-4 text-muted-foreground border-2 border-dashed rounded-3xl border-border bg-card/50">
                  <MapPin className="h-8 w-8 mx-auto mb-3 opacity-20" />
                  <p className="text-sm font-bold font-serif text-foreground">No destinations set</p>
                  <p className="text-xs mt-1 leading-relaxed max-w-[200px] mx-auto">Add your first location below to start generating the itinerary map.</p>
                </div>
              )}
            </Reorder.Group>

            {/* Add Stop Button & Auto-complete logic */}
            {isAdmin && (
              <div className="mt-8 mb-12">
                {!isAddStopOpen ? (
                <button 
                  onClick={() => setIsAddStopOpen(true)}
                  className="flex w-full items-center justify-center gap-2 rounded-2xl border border-dashed border-primary/40 bg-primary/5 p-4 text-sm font-bold text-primary transition-all hover:bg-primary/20 hover:border-primary/60"
                >
                  <Plus className="h-5 w-5" />
                  Add Destination
                </button>
              ) : (
                <motion.div 
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="rounded-2xl border border-border bg-card p-4 shadow-xl mb-8"
                >
                  <div className="flex items-center justify-between mb-4">
                    <h4 className="text-sm font-bold text-foreground font-serif tracking-tight">Add Destination</h4>
                    <button onClick={() => { setIsAddStopOpen(false); setStagedStop(null); }} className="text-muted-foreground hover:bg-muted p-1 rounded-md transition-colors">
                      <X className="h-4 w-4" />
                    </button>
                  </div>
                  
                  {stagedStop ? (
                     <div className="space-y-4">
                       <div className="rounded-xl bg-primary/5 border border-primary/20 p-3">
                         <label className="text-[10px] uppercase font-bold text-primary tracking-wider mb-1 block">Title (Optional Override)</label>
                         <input 
                           autoFocus
                           className="w-full bg-background border border-border rounded-lg px-3 py-2 text-sm font-bold text-foreground shadow-sm focus:ring-1 focus:ring-primary outline-none" 
                           value={stagedTitle}
                           onChange={e => setStagedTitle(e.target.value)}
                         />
                         
                         <label className="text-[10px] uppercase font-bold text-muted-foreground tracking-wider mt-3 mb-1 block">Mapping Address</label>
                         <div className="text-xs text-muted-foreground bg-muted rounded-md p-2 line-clamp-2">{stagedStop.address}</div>
                       </div>
                       
                       <button onClick={commitStagedStop} className="w-full bg-primary text-primary-foreground font-bold text-sm py-3 rounded-xl shadow-md hover:opacity-90 active:scale-95 transition-all">
                         Confirm & Add to Route
                       </button>
                     </div>
                  ) : (
                    <>
                      <div className="relative">
                        <Search className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
                        <input 
                          autoFocus
                          type="text"
                          className="w-full rounded-xl border border-input bg-muted/50 py-2.5 pl-9 pr-3 text-sm focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary focus:bg-background text-foreground placeholder:text-muted-foreground transition-colors"
                          placeholder="Search contacts or places..."
                          value={searchQuery}
                          onChange={(e) => setSearchQuery(e.target.value)}
                        />
                      </div>
                      
                      {/* Unified Results */}
                      {(contactResults.length > 0 || searchResults.length > 0) && (
                        <div className="mt-3 flex max-h-64 flex-col overflow-y-auto rounded-xl border border-border bg-card shadow-inner divide-y divide-border/50">
                          
                          {/* Contacts Wrapper */}
                          {contactResults.length > 0 && (
                            <div className="pb-1">
                              <div className="px-3 py-2 text-[10px] font-bold uppercase tracking-wider text-muted-foreground flex items-center gap-1.5"><User className="h-3 w-3" /> Saved Contacts</div>
                              {contactResults.map(c => (
                                <div 
                                  key={c.id} 
                                  onClick={() => handleContactSelection(c)}
                                  className="cursor-pointer px-3 py-2.5 hover:bg-primary/10 transition-colors mx-1 rounded-lg"
                                >
                                  <div className="font-bold text-sm text-foreground flex items-center gap-2">
                                    {c.firstName} {c.lastName}
                                  </div>
                                  <div className="truncate text-xs text-muted-foreground mt-0.5">
                                    {c.address1} {c.city}, {c.state}
                                  </div>
                                </div>
                              ))}
                            </div>
                          )}
  
                          {/* Mapbox Wrapper */}
                          {searchResults.length > 0 && (
                            <div className="pb-1">
                              <div className="px-3 py-2 text-[10px] font-bold uppercase tracking-wider text-muted-foreground flex items-center gap-1.5"><MapPin className="h-3 w-3" /> Global Locations</div>
                              {searchResults.map(res => (
                                <div 
                                  key={res.id} 
                                  onClick={() => handleMapboxSelection(res)}
                                  className="cursor-pointer px-3 py-2.5 hover:bg-primary/10 transition-colors mx-1 rounded-lg"
                                >
                                  <div className="font-bold text-sm text-foreground">{res.text}</div>
                                  <div className="truncate text-xs text-muted-foreground mt-0.5">{res.place_name}</div>
                                </div>
                              ))}
                            </div>
                          )}
                          
                        </div>
                      )}
                    </>
                  )}
                </motion.div>
              )}
            </div>
            )}

          </div>
        </div>

        {/* Right Pane - Map Viewer (Req 1 Full viewport on mobile) */}
        <div className={`absolute md:relative inset-0 md:inset-auto flex-1 bg-muted z-10 w-full md:w-auto h-full ${activeTab === 'map' ? 'block' : 'hidden md:block'}`}>
          {MAPBOX_TOKEN ? (
            <Map
              ref={mapRef}
              initialViewState={{
                longitude: centerLng,
                latitude: centerLat,
                zoom: stops.length > 0 ? 12 : 3
              }}
              mapStyle={isDarkTheme ? "mapbox://styles/mapbox/navigation-night-v1" : "mapbox://styles/mapbox/streets-v12"}
              mapboxAccessToken={MAPBOX_TOKEN}
              style={{ width: '100%', height: '100%' }}
            >
              {stops.map((stop, index) => (
                <Marker key={stop.id} longitude={stop.lng} latitude={stop.lat}>
                  <div className="flex h-8 w-8 items-center justify-center rounded-full border-[3px] border-background bg-primary font-bold text-primary-foreground shadow-lg font-sans transition-transform hover:scale-110">
                    {index + 1}
                  </div>
                </Marker>
              ))}

              {routeGeoJSON && (
                <Source id="route" type="geojson" data={routeGeoJSON}>
                  <Layer
                    id="route-line"
                    type="line"
                    layout={{
                      'line-join': 'round',
                      'line-cap': 'round'
                    }}
                    paint={{
                      'line-color': isDarkTheme ? '#d97706' : '#ea580c',
                      'line-width': 6,
                      'line-opacity': 0.8
                    }}
                  />
                </Source>
              )}
            </Map>
          ) : (
            <div className="flex h-full w-full flex-col items-center justify-center p-8 text-center text-muted-foreground font-sans">
              <MapPin className="mb-4 h-16 w-16 opacity-20" />
              <h2 className="text-xl font-bold text-foreground font-serif">Map Integration Pending</h2>
              <p className="mt-2 max-w-sm">Please add `VITE_MAPBOX_TOKEN` to your `.env` file to unlock the interactive map routing and geocoding capabilities.</p>
            </div>
          )}
        </div>

        {/* Global Action Toast Notification */}
        <AnimatePresence>
          {toastMessage && (
            <motion.div
              initial={{ opacity: 0, y: 50, scale: 0.9 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: 50, scale: 0.9 }}
              className={`fixed bottom-24 right-6 md:bottom-6 z-[100] flex items-center gap-3 rounded-xl px-5 py-4 shadow-2xl font-sans ${
                toastMessage.type === 'success' 
                  ? 'bg-emerald-600 text-white' 
                  : 'bg-red-600 text-white'
              }`}
            >
              <span className="text-sm font-bold tracking-wide">{toastMessage.title}</span>
            </motion.div>
          )}
        </AnimatePresence>

      </div>
    </ProtectedRoute>
  );
}
