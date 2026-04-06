import { createFileRoute } from '@tanstack/react-router';
import { ProtectedRoute } from '../components/ProtectedRoute';
import { useState, useMemo, useRef, useEffect } from 'react';
import { useVirtualizer } from '@tanstack/react-virtual';
import { motion, AnimatePresence } from 'framer-motion';
import { Search, UserCircle, Phone, Mail, MapPin, Briefcase, X } from 'lucide-react';
import type { Contact } from '../data/mockContacts';
import { supabase } from '../lib/supabase';

export const Route = createFileRoute('/contacts')({
  loader: async () => {
    const { data, error } = await supabase
      .from('contacts')
      .select('*')
      .order('first_name');
    
    if (error) {
      console.error('Failed to fetch contacts:', error);
      return [];
    }
    
    // Map snake_case to camelCase to match the existing UI logic
    return (data || []).map((row: any) => ({
      id: row.id,
      firstName: row.first_name,
      lastName: row.last_name,
      avatarUrl: row.avatar_url,
      company: row.company,
      jobTitle: row.job_title,
      notes: row.notes,
      fields: row.fields || [],
    })) as Contact[];
  },
  component: ContactsPage,
});

function ContactsPage() {
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedContactId, setSelectedContactId] = useState<string | null>(null);
  
  const initialContacts = Route.useLoaderData();
  const [fetchedContacts, setFetchedContacts] = useState<Contact[]>(initialContacts);


  // Hydrate strictly client-side allowing Supabase SDK to securely rebuild identity token states before firing row level queries
  useEffect(() => {
    const hydrateContacts = async () => {
      const { data } = await supabase.from('contacts').select('*').order('first_name');
      if (data && data.length > 0) {
        setFetchedContacts(data.map((row: any) => ({
          id: row.id,
          firstName: row.first_name,
          lastName: row.last_name,
          avatarUrl: row.avatar_url,
          company: row.company,
          jobTitle: row.job_title,
          notes: row.notes,
          fields: row.fields || [],
        })) as Contact[]);
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
        (c.company && c.company.toLowerCase().includes(q))
      );
    }
    
    // Sort Alphabetically
    filtered.sort((a, b) => {
      const nameA = `${a.firstName} ${a.lastName}`.toLowerCase();
      const nameB = `${b.firstName} ${b.lastName}`.toLowerCase();
      return nameA.localeCompare(nameB);
    });

    return filtered;
  }, [searchQuery]);

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
    estimateSize: (index) => groupedItems[index].type === 'header' ? 32 : 64,
    overscan: 15,
  });

  const handleLetterClick = (letter: string) => {
    const index = letterMap.get(letter);
    if (index !== undefined) {
      virtualizer.scrollToIndex(index, { align: 'start' });
    }
  };

  const selectedContact = selectedContactId 
    ? processedContacts.find(c => c.id === selectedContactId) 
    : null;

  return (
    <ProtectedRoute allowedRoles={['Super Admin', 'Admin', 'User']}>
      <div className="flex h-[calc(100vh-64px)] w-full overflow-hidden bg-background">
        
        {/* Left Pane - Master List (Responsive hidden on small if detail is open) */}
        <div className={`relative flex h-full flex-col border-r border-border bg-card transition-all duration-300 ${selectedContactId ? 'hidden w-full md:block md:w-[350px] xl:w-[400px]' : 'w-full md:w-[350px] xl:w-[400px]'}`}>
          
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
                placeholder="Search contacts..."
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
          </div>

          {/* Virtualized Container */}
          <div className="relative flex-1 overflow-y-auto overflow-x-hidden outline-none font-sans" ref={parentRef}>
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
                        {item.contact.firstName} <span className="font-bold">{item.contact.lastName}</span>
                      </span>
                      {item.contact.company && (
                        <span className="truncate text-xs text-muted-foreground font-sans">
                          {item.contact.company}
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
        <div className={`flex flex-1 flex-col overflow-y-auto bg-background ${!selectedContactId ? 'hidden md:flex' : 'flex'}`}>
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
                className="mx-auto w-full max-w-2xl p-6 md:p-12"
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
                    {selectedContact.firstName} {selectedContact.lastName}
                  </h2>
                  {(selectedContact.jobTitle || selectedContact.company) && (
                    <p className="mt-2 text-lg text-muted-foreground font-sans">
                      {selectedContact.jobTitle} {selectedContact.company && `at ${selectedContact.company}`}
                    </p>
                  )}
                </div>

                <div className="mt-12 space-y-6 font-sans">
                  <div className="overflow-hidden rounded-2xl border border-border bg-card shadow-sm">
                    {selectedContact.fields.map((field, idx) => (
                      <div 
                        key={field.id}
                        className={`flex items-start gap-4 p-4 ${idx !== selectedContact.fields.length - 1 ? 'border-b border-border' : ''}`}
                      >
                        <div className="mt-0.5 rounded-lg bg-primary/10 p-2 text-primary">
                          {field.type === 'email' && <Mail className="h-5 w-5" />}
                          {field.type === 'phone' && <Phone className="h-5 w-5" />}
                          {field.type === 'address' && <MapPin className="h-5 w-5" />}
                          {(field.type === 'text' || field.type === 'date' || field.type === 'url') && <Briefcase className="h-5 w-5" />}
                        </div>
                        <div className="flex flex-col">
                          <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                            {field.label}
                          </span>
                          <span className="mt-1 text-base font-medium text-foreground">
                            {field.value}
                          </span>
                        </div>
                      </div>
                    ))}
                  </div>

                  {selectedContact.notes && (
                    <div className="rounded-2xl border border-border bg-card p-6 shadow-sm">
                      <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Notes</h3>
                      <p className="mt-3 text-sm leading-relaxed text-foreground">
                        {selectedContact.notes}
                      </p>
                    </div>
                  )}
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>

      </div>
    </ProtectedRoute>
  );
}
