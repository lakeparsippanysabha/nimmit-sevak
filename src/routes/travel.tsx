import { createFileRoute, useNavigate } from '@tanstack/react-router';
import { ProtectedRoute } from '../components/ProtectedRoute';
import { useState, useEffect, useRef } from 'react';
import { Reorder } from 'framer-motion';
import { Map, Marker, Source, Layer } from 'react-map-gl/mapbox';
import 'mapbox-gl/dist/mapbox-gl.css';
import { MapPin, Search, Plus, GripVertical, Clock, X, Calendar, BookText } from 'lucide-react';
import { Link } from '@tanstack/react-router';
import { supabase } from '../lib/supabase';
import { fetchDirections, geocode } from '../lib/mapbox';
import { handleMutationError } from '../lib/errors';

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

const getTodayDateString = () => new Date().toISOString().split('T')[0];

export const Route = createFileRoute('/travel')({
  validateSearch: (search: Record<string, unknown>) => ({
    date: (search.date as string) || getTodayDateString(),
  }),
  loaderDeps: ({ search: { date } }) => ({ date }),
  loader: async ({ deps: { date } }) => {
    // Attempt to load the travel plan and stops for the date
    let planId = null;
    const { data: plans } = await supabase.from('travel_plans').select('id').eq('date', date);
    
    let stops: TravelStop[] = [];
    if (plans && plans.length > 0) {
      planId = plans[0].id;
      const { data: stopsData } = await supabase
        .from('travel_stops')
        .select('*')
        .eq('plan_id', planId)
        .order('order_index', { ascending: true });
        
      if (stopsData) stops = stopsData;
    }

    return { date, planId, savedStops: stops };
  },
  component: TravelPage,
});

function TravelPage() {
  const navigate = useNavigate({ from: '/travel' });
  const { date, planId: initialPlanId, savedStops } = Route.useLoaderData();
  
  const [currentPlanId, setCurrentPlanId] = useState<string | null>(initialPlanId);
  const [stops, setStops] = useState<TravelStop[]>(savedStops);
  const [routeGeoJSON, setRouteGeoJSON] = useState<any>(null);
  const mapRef = useRef<any>(null);
  
  // Modals/UI State
  const [isAddStopOpen, setIsAddStopOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<any[]>([]);
  const [isDarkTheme, setIsDarkTheme] = useState(false);

  useEffect(() => {
    setIsDarkTheme(document.documentElement.classList.contains('dark'));
    const observer = new MutationObserver(() => {
      setIsDarkTheme(document.documentElement.classList.contains('dark'));
    });
    observer.observe(document.documentElement, { attributes: true, attributeFilter: ['class'] });
    return () => observer.disconnect();
  }, []);

  // Update stops if loader data changes
  useEffect(() => {
    setCurrentPlanId(initialPlanId);
    setStops(savedStops);
  }, [savedStops, initialPlanId]);

  // Recalculate routes whenever stops change and map them
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
            if (updatedStops[i].drive_time_mins !== driveMins) {
              updatedStops[i].drive_time_mins = driveMins;
              changed = true;
            }
          });
          if (changed) {
            setStops(updatedStops);
            if (currentPlanId) {
               // Background sync updated drive times without blocking UI
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

  // Debounced search for locations
  useEffect(() => {
    const timer = setTimeout(() => {
      if (searchQuery.trim().length > 2) {
        geocode(searchQuery).then(results => setSearchResults(results));
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
      // Background sync
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

  const handleAddStop = async (place: any) => {
    // If no plan exists for this date, create one
    let targetPlanId = currentPlanId;
    if (!targetPlanId) {
      let { data, error } = await supabase.from('travel_plans').insert({ date }).select().single();
      
      // If the plan was created by another session/tab or uniquely conflicts, fetch existing
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
    
    setIsAddStopOpen(false);
    setSearchQuery('');
    
    // Pessimistically add the stop so Supabase computes the valid UUID
    const { data: newDbStop, error: stopError } = await supabase.from('travel_stops').insert({
      plan_id: targetPlanId,
      order_index: stops.length,
      type: 'custom',
      title: place.text,
      address: place.place_name,
      lat: place.center[1],
      lng: place.center[0],
    }).select().single();
    
    if (stopError) {
      handleMutationError('travel:insert-stop', stopError);
      return;
    }

    setStops(prev => [...prev, newDbStop as TravelStop]);
  };

  const removeStop = async (id: string) => {
    setStops(stops.filter(s => s.id !== id));
    await supabase.from('travel_stops').delete().eq('id', id);
  };

  const updateStopTime = async (id: string, timeValue: string) => {
    setStops(prev => prev.map(s => s.id === id ? { ...s, planned_time: timeValue } : s));
    await supabase.from('travel_stops').update({ planned_time: timeValue }).eq('id', id);
  };

  const centerLat = stops.length > 0 ? stops[0].lat : 40.7128; // Default NYC
  const centerLng = stops.length > 0 ? stops[0].lng : -74.0060;

  const [activeTab, setActiveTab] = useState<'list' | 'map'>('list');

  return (
    <ProtectedRoute allowedRoles={['Super Admin', 'Admin', 'User']}>
      {!MAPBOX_TOKEN && (
        <div className="absolute top-16 left-0 z-50 w-full bg-destructive py-2 text-center text-sm font-bold text-destructive-foreground shadow-xl">
          Warning: Missing VITE_MAPBOX_TOKEN in .env. Map functionality is disabled.
        </div>
      )}
      
      <div className="flex h-[calc(100vh-64px)] w-full overflow-hidden bg-background relative">
        
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
        <div className={`relative h-full w-full flex-col border-r border-border bg-card md:w-[450px] xl:w-[500px] shadow-2xl z-20 ${activeTab === 'list' ? 'flex' : 'hidden md:flex'}`}>
          
          {/* Header */}
          <div className="flex-shrink-0 bg-card p-6 pt-8 border-b border-border">
            <h1 className="text-2xl font-bold tracking-tight text-foreground font-serif">Travel Itinerary</h1>
            
            <div className="mt-4 flex items-center gap-3 rounded-xl border border-border bg-background p-2 pr-4 font-sans">
              <div className="flex items-center justify-center rounded-lg bg-primary/10 p-2">
                <Calendar className="h-5 w-5 text-primary" />
              </div>
              <input 
                type="date"
                value={date}
                onChange={(e) => navigate({ search: { date: e.target.value } })}
                className="bg-transparent text-sm font-medium text-foreground focus:outline-none w-full"
              />
            </div>
          </div>

          {/* Timeline Reorderable List */}
          <div className="flex-1 overflow-y-auto p-4 py-6 font-sans">
            <Reorder.Group axis="y" values={stops} onReorder={handleReorder} className="space-y-4">
              {stops.map((stop, index) => (
                <Reorder.Item key={stop.id} value={stop} className="relative z-10 mx-auto w-full">
                  {/* Drive Time Indicator to Next Stop */}
                  {index > 0 && stop.drive_time_mins !== undefined && (
                     <div className="absolute -top-4 left-[34px] z-20 flex -translate-y-1/2 -translate-x-1/2 items-center justify-center rounded-full bg-primary/10 px-2 py-0.5 text-[10px] font-bold text-primary shadow-sm border border-primary/20">
                       {stop.drive_time_mins} min drive
                     </div>
                  )}
                  {/* Vertical Line Connector */}
                  {index > 0 && (
                    <div className="absolute -top-4 left-[34px] h-4 w-0.5 bg-border" />
                  )}
                  
                  <div className="group flex items-stretch gap-4 rounded-2xl border border-border bg-card p-4 shadow-sm transition-all hover:border-primary/50 hover:shadow-md">
                    <div className="flex cursor-grab items-center justify-center text-muted-foreground hover:text-primary active:cursor-grabbing">
                      <GripVertical className="h-5 w-5" />
                    </div>
                    <div className="flex-1 overflow-hidden">
                      <div className="flex items-start justify-between">
                        <h3 className="truncate font-bold text-foreground font-serif text-[15px] pr-1">{stop.title}</h3>
                        <button onClick={() => removeStop(stop.id)} className="text-muted-foreground hover:text-destructive transition-colors">
                          <X className="h-4 w-4" />
                        </button>
                      </div>
                      <p className="mt-1 truncate text-xs text-muted-foreground">{stop.address}</p>
                      <div className="mt-3 flex items-center justify-between">
                        <div className="flex items-center gap-4">
                          <div className="flex items-center gap-1.5 text-xs font-medium text-foreground bg-background border border-border px-2 py-1 rounded-md focus-within:ring-1 focus-within:ring-primary">
                            <Clock className="h-3.5 w-3.5 opacity-70" />
                            <input 
                              type="time" 
                              title="Set planned time"
                              value={stop.planned_time || ''}
                              onChange={(e) => updateStopTime(stop.id, e.target.value)}
                              className="bg-transparent outline-none w-[72px] cursor-text text-foreground placeholder:text-muted-foreground"
                            />
                          </div>
                        </div>
                        <Link 
                          to="/journal" 
                          search={{ stopId: stop.id }} 
                          className="flex items-center gap-1.5 text-xs font-bold text-primary hover:text-primary/80 bg-primary/10 hover:bg-primary/20 px-2.5 py-1.5 rounded-md transition-colors"
                        >
                          <BookText className="h-3.5 w-3.5" />
                          Journal
                        </Link>
                      </div>
                    </div>
                  </div>
                </Reorder.Item>
              ))}
              {stops.length === 0 && (
                <div className="text-center p-8 text-muted-foreground border-2 border-dashed rounded-2xl border-border">
                  <p className="text-sm font-medium">No stops for this date.</p>
                  <p className="text-xs mt-1">Add a location to begin routing.</p>
                </div>
              )}
            </Reorder.Group>

            {/* Add Stop Button & Auto-complete logic */}
            <div className="mt-6">
              {!isAddStopOpen ? (
                <button 
                  onClick={() => setIsAddStopOpen(true)}
                  className="flex w-full items-center justify-center gap-2 rounded-xl border border-dashed border-primary/40 bg-primary/5 p-4 text-sm font-bold text-primary transition-all hover:bg-primary/10"
                >
                  <Plus className="h-5 w-5" />
                  Add Destination
                </button>
              ) : (
                <div className="rounded-2xl border border-border bg-card p-4 shadow-xl">
                  <div className="flex items-center justify-between mb-3">
                    <h4 className="text-sm font-bold text-foreground font-serif tracking-tight">Search Location</h4>
                    <button onClick={() => setIsAddStopOpen(false)} className="text-muted-foreground hover:text-foreground transition-colors">
                      <X className="h-4 w-4" />
                    </button>
                  </div>
                  <div className="relative">
                    <Search className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
                    <input 
                      autoFocus
                      type="text"
                      className="w-full rounded-lg border border-input bg-background py-2 pl-9 pr-3 text-sm focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary text-foreground placeholder:text-muted-foreground"
                      placeholder="Type an address or place..."
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                    />
                  </div>
                  {searchResults.length > 0 && (
                    <ul className="mt-2 flex max-h-48 flex-col overflow-y-auto rounded-lg border border-border bg-card shadow-inner">
                      {searchResults.map(res => (
                        <li 
                          key={res.id} 
                          onClick={() => handleAddStop(res)}
                          className="cursor-pointer border-b border-border p-3 last:border-0 hover:bg-muted/50 transition-colors"
                        >
                          <div className="font-bold text-sm text-foreground">{res.text}</div>
                          <div className="truncate text-xs text-muted-foreground mt-0.5">{res.place_name}</div>
                        </li>
                      ))}
                    </ul>
                  )}
                </div>
              )}
            </div>

          </div>
        </div>

        {/* Right Pane - Map Viewer */}
        <div className={`relative flex-1 bg-muted z-10 ${activeTab === 'map' ? 'block' : 'hidden md:block'}`}>
          {MAPBOX_TOKEN ? (
            <Map
              ref={mapRef}
              initialViewState={{
                longitude: centerLng,
                latitude: centerLat,
                zoom: stops.length > 0 ? 12 : 3
              }}
              mapStyle={isDarkTheme ? "mapbox://styles/mapbox/dark-v11" : "mapbox://styles/mapbox/light-v11"}
              mapboxAccessToken={MAPBOX_TOKEN}
              style={{ width: '100%', height: '100%' }}
            >
              {stops.map((stop, index) => (
                <Marker key={stop.id} longitude={stop.lng} latitude={stop.lat}>
                  <div className="flex h-8 w-8 items-center justify-center rounded-full border-2 border-background bg-primary font-bold text-primary-foreground shadow-lg font-sans">
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
                      'line-color': isDarkTheme ? '#d97706' : '#d97706', /* Warm map route line (amber-600) */
                      'line-width': 6,
                      'line-opacity': 0.75
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

      </div>
    </ProtectedRoute>
  );
}
