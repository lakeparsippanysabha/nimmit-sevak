import { createFileRoute } from '@tanstack/react-router';
import { ProtectedRoute } from '../components/ProtectedRoute';
import { useState, useMemo, useRef, useEffect } from 'react';
import { useVirtualizer } from '@tanstack/react-virtual';
import { motion, AnimatePresence } from 'framer-motion';
import { Search, UserCircle, Phone, Mail, MapPin, Clock, X } from 'lucide-react';
import type { Contact } from '../data/mockContacts';
import type { ContactRow } from '../lib/database.types';
import { mapContactRows } from '../lib/mappers';
import { handleLoaderError } from '../lib/errors';
import { supabase } from '../lib/supabase';

export const Route = createFileRoute('/contacts')({
  loader: async () => {
    await supabase.auth.getSession();

    const { data, error } = await supabase
      .from('contacts')
      .select('*')
      .order('first_name');

    if (error) return handleLoaderError('contacts', error, [] as Contact[]);

    return mapContactRows((data || []) as ContactRow[]);
  },
  component: ContactsPage,
});

function ContactsPage() {
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedContactId, setSelectedContactId] = useState<string | null>(null);
  const [showYouthOnly, setShowYouthOnly] = useState(false);

  const handleToggleYouth = async (id: string, newValue: boolean) => {
    setFetchedContacts(prev => prev.map(c => c.id === id ? { ...c, youthSabhaMember: newValue } : c));
    
    const { error } = await supabase
      .from('contacts')
      .update({ youth_sabha_member: newValue })
      .eq('id', id);

    if (error) {
      console.error('Failed to update youth sabha status:', error);
      setFetchedContacts(prev => prev.map(c => c.id === id ? { ...c, youthSabhaMember: !newValue } : c));
    }
  };

  const initialContacts = Route.useLoaderData();
  const [fetchedContacts, setFetchedContacts] = useState<Contact[]>(initialContacts);


  // Hydrate strictly client-side allowing Supabase SDK to securely rebuild identity token states before firing row level queries
  useEffect(() => {
    const hydrateContacts = async () => {
      const { data } = await supabase.from('contacts').select('*').order('first_name');
      if (data && data.length > 0) {
        setFetchedContacts(mapContactRows(data as ContactRow[]));
      }
    };
    hydrateContacts();
  }, []);

  // Client-side Sorting and filtering logic
  const processedContacts = useMemo(() => {
    let filtered = fetchedContacts;
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      filtered = filtered.filter(c =>
        c.firstName.toLowerCase().includes(q) ||
        c.lastName.toLowerCase().includes(q) ||
        (c.nickname && c.nickname.toLowerCase().includes(q)) ||
        (c.mandal && c.mandal.toLowerCase().includes(q)) ||
        (c.email && c.email.toLowerCase().includes(q))
      );
    }
    
    if (showYouthOnly) {
      filtered = filtered.filter(c => c.youthSabhaMember);
    }

    // Sort Alphabetically
    filtered.sort((a, b) => {
      const nameA = `${a.firstName} ${a.lastName}`.toLowerCase();
      const nameB = `${b.firstName} ${b.lastName}`.toLowerCase();
      return nameA.localeCompare(nameB);
    });

    return filtered;
  }, [fetchedContacts, searchQuery, showYouthOnly]);

  // A-Z Grouping extraction
  const { groupedItems, letterMap } = useMemo(() => {
    const items: Array<{ type: 'header', letter: string } | { type: 'contact', contact: Contact }> = [];
    const map = new Map<string, number>();

    let currentLetter = '';
    processedContacts.forEach(contact => {
      const firstChar = contact.firstName.charAt(0).toUpperCase();
      if (firstChar !== currentLetter) {
        currentLetter = firstChar;
        // Record the index where this letter starts for the scrubber
        map.set(currentLetter, items.length);
        items.push({ type: 'header', letter: currentLetter });
      }
      items.push({ type: 'contact', contact });
    });

    return { groupedItems: items, letterMap: map };
  }, [processedContacts]);

  const parentRef = useRef<HTMLDivElement>(null);

  // Virtual list to power 60fps scrolling
  const virtualizer = useVirtualizer({
    count: groupedItems.length,
    getScrollElement: () => parentRef.current,
    estimateSize: (index) => groupedItems[index].type === 'header' ? 32 : 72,
    overscan: 15,
  });

  const handleLetterClick = (letter: string) => {
    const index = letterMap.get(letter);
    if (index !== undefined) {
      virtualizer.scrollToIndex(index, { align: 'start' });
    }
  };

  // Helper for proper title casing
  const titleCase = (str: string | undefined | null) => {
    if (!str) return '';
    return str.split(' ').map(w => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase()).join(' ');
  };

  const selectedContact = selectedContactId
    ? processedContacts.find(c => c.id === selectedContactId)
    : null;

  return (
    <ProtectedRoute allowedRoles={['Super Admin', 'Admin', 'User']}>
      <div className="flex h-[calc(100vh-64px)] w-full overflow-hidden bg-background">

        {/* Left Pane - Master List (Responsive hidden on small if detail is open) */}
        <div className={`relative h-full flex-col border-r border-border bg-card transition-all duration-300 min-h-0 min-w-0 w-full md:w-[350px] xl:w-[400px] ${selectedContactId ? 'hidden md:flex' : 'flex'}`}>

          <div className="z-10 flex-shrink-0 bg-card/80 p-4 pt-6 backdrop-blur-xl">
            <h1 className="text-2xl font-bold tracking-tight text-foreground font-serif">Contacts</h1>

            {/* Semantic Search Bar */}
            <motion.div
              className="relative mt-4 font-sans"
              whileHover={{ scale: 1.01 }}
              whileTap={{ scale: 0.99 }}
            >
              <div className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3">
                <Search className="h-4 w-4 text-muted-foreground" />
              </div>
              <input
                type="text"
                placeholder="Search by name, mandal, email..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="block w-full rounded-xl border border-input bg-background py-2.5 pl-10 pr-4 text-sm text-foreground placeholder:text-muted-foreground shadow-sm transition-all focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
              />
              {searchQuery && (
                <button
                  onClick={() => setSearchQuery('')}
                  className="absolute inset-y-0 right-0 flex items-center pr-3 text-muted-foreground hover:text-foreground"
                >
                  <X className="h-4 w-4" />
                </button>
              )}
            </motion.div>
            
            <div className="mt-4 flex items-center justify-between font-sans px-1">
              <label className="text-sm font-medium text-foreground flex items-center gap-3 cursor-pointer group">
                <button
                  type="button"
                  onClick={() => setShowYouthOnly(!showYouthOnly)}
                  className={`relative inline-flex h-5 w-9 items-center rounded-full transition-colors ${showYouthOnly ? 'bg-primary' : 'bg-muted-foreground/30'}`}
                >
                  <span className={`inline-block h-3.5 w-3.5 transform rounded-full bg-white transition-transform ${showYouthOnly ? 'translate-x-4' : 'translate-x-1'}`} />
                </button>
                <span className="group-hover:text-primary transition-colors">Youth Sabha Members Only</span>
              </label>
            </div>
          </div>

          {/* Virtualized Container */}
          <div className="relative flex-1 overflow-y-auto overflow-x-hidden outline-none font-sans min-h-0" ref={parentRef}>
            <div
              style={{
                height: `${virtualizer.getTotalSize()}px`,
                width: '100%',
                position: 'relative',
              }}
            >
              {virtualizer.getVirtualItems().map((virtualItem) => {
                const item = groupedItems[virtualItem.index];

                if (item.type === 'header') {
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
                      className="flex items-center bg-muted/90 px-4 py-1 text-xs font-semibold text-muted-foreground backdrop-blur-md"
                    >
                      {item.letter}
                    </div>
                  );
                }

                const isActive = item.contact.id === selectedContactId;

                return (
                  <div
                    key={virtualItem.key}
                    onClick={() => setSelectedContactId(item.contact.id)}
                    style={{
                      position: 'absolute',
                      top: 0,
                      left: 0,
                      width: '100%',
                      height: `${virtualItem.size}px`,
                      transform: `translateY(${virtualItem.start}px)`,
                    }}
                    className={`flex cursor-pointer items-center gap-3 border-b border-border px-4 py-2 transition-colors hover:bg-muted/50 ${isActive ? 'bg-primary/10 border-l-4 border-l-primary' : 'border-l-4 border-l-transparent'}`}
                  >
                    <img
                      src={item.contact.avatarUrl}
                      alt=""
                      className="h-10 w-10 flex-shrink-0 rounded-full object-cover border border-border"
                      loading="lazy"
                    />
                    <div className="flex flex-col truncate">
                      <span className="truncate text-sm font-medium text-foreground font-serif tracking-tight pr-1">
                        {titleCase(item.contact.firstName)} <span className="font-bold">{titleCase(item.contact.lastName)}</span>
                        {item.contact.nickname && <span className="ml-1 text-muted-foreground italic text-xs">({titleCase(item.contact.nickname)})</span>}
                      </span>
                      {item.contact.cellphone && (
                        <span className="truncate text-xs text-muted-foreground font-sans mt-0.5">
                          {item.contact.cellphone}
                        </span>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>

            {groupedItems.length === 0 && (
               <motion.div
                 initial={{ opacity: 0 }}
                 animate={{ opacity: 1 }}
                 className="flex h-full flex-col items-center justify-center p-8 text-center text-muted-foreground font-sans"
               >
                 No contacts found matching "{searchQuery}"
               </motion.div>
            )}
          </div>

          {/* Alphabet Index Scrubber Premium UI */}
          <div className="absolute right-1 top-[100px] bottom-4 z-10 flex flex-col items-center justify-center text-[10px] font-bold text-primary font-sans">
            {Array.from(letterMap.keys()).map(letter => (
               <button
                 key={letter}
                 onClick={() => handleLetterClick(letter)}
                 className="px-1 py-0.5 transition-transform hover:scale-150 hover:text-primary/70"
               >
                 {letter}
               </button>
            ))}
          </div>

        </div>

        {/* Right Pane - Detail View  */}
        <div className={`flex-1 flex-col overflow-y-auto bg-background ${selectedContactId ? 'flex' : 'hidden md:flex'}`}>
          <AnimatePresence mode="wait">
            {!selectedContact ? (
               <motion.div
                 key="empty"
                 initial={{ opacity: 0, filter: 'blur(10px)' }}
                 animate={{ opacity: 1, filter: 'blur(0px)' }}
                 exit={{ opacity: 0, filter: 'blur(10px)' }}
                 className="flex h-full flex-col items-center justify-center text-muted-foreground font-sans"
               >
                 <UserCircle className="mb-4 h-16 w-16 opacity-20" />
                 <p>Select a contact to view details</p>
               </motion.div>
            ) : (
               <motion.div
                 key="detail"
                 initial={{ opacity: 0, y: 20 }}
                 animate={{ opacity: 1, y: 0 }}
                 exit={{ opacity: 0, y: -20 }}
                 className="mx-auto w-full max-w-2xl p-6 md:p-12 mb-20"
               >
                 {/* Mobile Back Button */}
                 <button
                   className="mb-8 flex items-center text-sm font-bold text-primary md:hidden font-sans"
                   onClick={() => setSelectedContactId(null)}
                 >
                   &larr; Back to Contacts
                 </button>

                 <div className="flex flex-col items-center text-center">
                   <motion.img
                     layoutId={`avatar-${selectedContact.id}`}
                     src={selectedContact.avatarUrl}
                     alt=""
                     className="h-32 w-32 rounded-full border border-border shadow-xl"
                   />
                   <h2 className="mt-6 text-3xl font-bold tracking-tight text-foreground font-serif">
                     {titleCase(selectedContact.firstName)} {titleCase(selectedContact.lastName)}
                   </h2>
                   <div className="mt-2 flex items-center gap-2 flex-wrap justify-center font-sans">
                     {selectedContact.nickname && <span className="text-muted-foreground mr-1 italic">"{titleCase(selectedContact.nickname)}"</span>}
                     {selectedContact.memberType && (
                       <span className="bg-primary/10 text-primary px-3 py-1 rounded-full text-xs font-bold uppercase tracking-wider">
                         {selectedContact.memberType.replace(/_/g, ' ')}
                       </span>
                     )}
                     {selectedContact.mandal && (
                       <span className="bg-muted text-muted-foreground px-3 py-1 rounded-full text-xs font-bold uppercase tracking-wider border border-border">
                         {selectedContact.mandal.replace(/_/g, ' ')}
                       </span>
                     )}
                   </div>
                 </div>

                 <div className="mt-12 space-y-8 font-sans">

                   {/* Personal Info */}
                   <div className="space-y-4">
                     <h3 className="text-xs font-bold uppercase tracking-widest text-muted-foreground mb-4">Personal Info</h3>
                     <div className="grid grid-cols-2 gap-4">
                       <div className="rounded-xl border border-border bg-card p-4">
                         <span className="text-[10px] font-bold uppercase text-muted-foreground block mb-1">Gender</span>
                         <span className="text-sm font-medium">{selectedContact.gender || 'Not specified'}</span>
                       </div>
                       <div className="rounded-xl border border-border bg-card p-4">
                         <span className="text-[10px] font-bold uppercase text-muted-foreground block mb-1">Age</span>
                         <span className="text-sm font-medium">{selectedContact.age || 'Not specified'}</span>
                       </div>
                     </div>
                   </div>

                   {/* Contact Details */}
                   <div className="space-y-4">
                     <h3 className="text-xs font-bold uppercase tracking-widest text-muted-foreground mb-4">Contact Details</h3>
                     <div className="rounded-2xl border border-border bg-card overflow-hidden divide-y divide-border">
                       <div className="flex items-center gap-4 p-4">
                         <div className="bg-primary/10 p-2 rounded-lg text-primary"><Mail className="h-5 w-5" /></div>
                         <div>
                           <span className="text-[10px] font-bold uppercase text-muted-foreground block mb-0.5">Email</span>
                           <span className="text-sm font-medium">{selectedContact.email?.toLowerCase() || 'none'}</span>
                         </div>
                       </div>
                       <div className="flex items-center gap-4 p-4">
                         <div className="bg-primary/10 p-2 rounded-lg text-primary"><Phone className="h-5 w-5" /></div>
                         <div>
                           <span className="text-[10px] font-bold uppercase text-muted-foreground block mb-0.5">Cellphone</span>
                           <span className="text-sm font-medium">{selectedContact.cellphone || 'None'}</span>
                         </div>
                       </div>
                     </div>
                   </div>

                   {/* Location Info */}
                   <div className="space-y-4">
                     <h3 className="text-xs font-bold uppercase tracking-widest text-muted-foreground mb-4">Location</h3>
                     <div className="rounded-2xl border border-border bg-card p-5 relative overflow-hidden shadow-sm">
                       <div className="absolute top-0 right-0 p-4 opacity-5"><MapPin className="h-20 w-20" /></div>
                       <div className="space-y-4 relative z-10">
                         <div>
                           <span className="text-[10px] font-bold uppercase text-muted-foreground block mb-1">Address</span>
                           <p className="text-sm font-medium leading-relaxed">
                             {selectedContact.address1 || 'No address provided'}
                             {selectedContact.address2 && <><br />{selectedContact.address2}</>}
                           </p>
                         </div>
                         <div className="grid grid-cols-2 gap-4">
                           <div>
                             <span className="text-[10px] font-bold uppercase text-muted-foreground block mb-1">City</span>
                             <span className="text-sm font-medium">{selectedContact.city || '—'}</span>
                           </div>
                           <div>
                             <span className="text-[10px] font-bold uppercase text-muted-foreground block mb-1">State & Zip</span>
                             <span className="text-sm font-medium">{selectedContact.state} {selectedContact.zip}</span>
                           </div>
                         </div>
                         <div className="grid grid-cols-2 gap-4 border-t border-border pt-4">
                           <div>
                             <span className="text-[10px] font-bold uppercase text-muted-foreground block mb-1">County</span>
                             <span className="text-sm font-medium">{selectedContact.county || '—'}</span>
                           </div>
                           <div>
                             <span className="text-[10px] font-bold uppercase text-muted-foreground block mb-1">Country</span>
                             <span className="text-sm font-medium">{selectedContact.country || 'USA'}</span>
                           </div>
                         </div>
                       </div>
                     </div>
                   </div>

                   {/* Followup & Notes */}
                   <div className="space-y-4">
                     <h3 className="text-xs font-bold uppercase tracking-widest text-muted-foreground mb-4">Status & Notes</h3>
                     <div className="grid grid-cols-1 gap-4">
                       <div className="rounded-xl border border-border bg-card p-4 flex items-center justify-between">
                         <div>
                           <span className="text-sm font-bold block">Youth Sabha Member</span>
                           <span className="text-xs text-muted-foreground">Active participant in youth sabha</span>
                         </div>
                         <button
                           type="button"
                           onClick={() => handleToggleYouth(selectedContact.id, !selectedContact.youthSabhaMember)}
                           className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${selectedContact.youthSabhaMember ? 'bg-primary' : 'bg-muted-foreground/30'}`}
                         >
                           <span className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${selectedContact.youthSabhaMember ? 'translate-x-6' : 'translate-x-1'}`} />
                         </button>
                       </div>
                       {selectedContact.followup && (
                         <div className="rounded-xl border border-border bg-amber-50 dark:bg-amber-950/20 p-4 flex items-center justify-between">
                           <div className="flex items-center gap-3 text-amber-900 dark:text-amber-400">
                             <Clock className="h-5 w-5" />
                             <div>
                               <span className="text-[10px] font-bold uppercase block mb-0.5 opacity-70">Follow-up</span>
                               <span className="text-sm font-bold">{titleCase(selectedContact.followup)}</span>
                             </div>
                           </div>
                         </div>
                       )}
                       <div className="rounded-2xl border border-border bg-card p-6 shadow-sm">
                         <span className="text-[10px] font-bold uppercase text-muted-foreground block mb-3">Biography / Internal Notes</span>
                         <p className="text-sm leading-relaxed text-foreground whitespace-pre-wrap">
                           {selectedContact.notes || 'No detailed notes provided for this contact.'}
                         </p>
                       </div>
                     </div>
                   </div>

                 </div>
               </motion.div>
            )}
          </AnimatePresence>
        </div>

      </div>
    </ProtectedRoute>
  );
}
