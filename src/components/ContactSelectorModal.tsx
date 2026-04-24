import React, { useState, useMemo, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Search, X, Check } from 'lucide-react';
import type { Contact } from '../data/mockContacts';

interface ContactSelectorModalProps {
  isOpen: boolean;
  onClose: () => void;
  contacts: Contact[];
  alreadySelectedIds: string[];
  onSelectionComplete: (selectedIds: string[]) => void;
}

export function ContactSelectorModal({
  isOpen,
  onClose,
  contacts,
  alreadySelectedIds,
  onSelectionComplete,
}: ContactSelectorModalProps) {
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set(alreadySelectedIds));

  // Reset local state when modal opens
  useEffect(() => {
    if (isOpen) {
      setSelectedIds(new Set(alreadySelectedIds));
      setSearchQuery('');
    }
  }, [isOpen, alreadySelectedIds]);

  const filteredContacts = useMemo(() => {
    if (!searchQuery.trim()) {
      return contacts.sort((a, b) => a.firstName.localeCompare(b.firstName));
    }
    const q = searchQuery.toLowerCase();
    return contacts.filter(c =>
      c.firstName.toLowerCase().includes(q) ||
      c.lastName.toLowerCase().includes(q) ||
      (c.mandal && c.mandal.toLowerCase().includes(q))
    ).sort((a, b) => a.firstName.localeCompare(b.firstName));
  }, [contacts, searchQuery]);

  const handleToggle = (id: string) => {
    const newSet = new Set(selectedIds);
    if (newSet.has(id)) {
      newSet.delete(id);
    } else {
      newSet.add(id);
    }
    setSelectedIds(newSet);
  };

  const titleCase = (str: string | undefined | null) => {
    if (!str) return '';
    return str.split(' ').map(w => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase()).join(' ');
  };

  if (!isOpen) return null;

  return (
    <AnimatePresence>
      <div className="fixed inset-0 z-[100] flex items-center justify-center bg-background/80 backdrop-blur-sm">
        <motion.div
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          exit={{ opacity: 0, scale: 0.95 }}
          className="w-full max-w-lg overflow-hidden rounded-2xl border border-border bg-card shadow-2xl flex flex-col max-h-[80vh]"
        >
          {/* Header */}
          <div className="flex items-center justify-between border-b border-border p-4">
            <h2 className="text-xl font-bold font-serif text-foreground">Select Contacts</h2>
            <button onClick={onClose} className="rounded-full p-2 hover:bg-muted text-muted-foreground outline-none">
              <X className="h-5 w-5" />
            </button>
          </div>

          <div className="p-4 border-b border-border bg-card/50">
            <div className="relative font-sans">
              <div className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3">
                <Search className="h-4 w-4 text-muted-foreground" />
              </div>
              <input
                type="text"
                placeholder="Search..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="block w-full rounded-xl border border-input bg-background py-2 pl-10 pr-4 text-sm text-foreground placeholder:text-muted-foreground transition-all focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
              />
            </div>
            <div className="mt-3 flex justify-between text-xs font-semibold text-muted-foreground uppercase tracking-wider">
              <span>{selectedIds.size} Selected</span>
              <button 
                onClick={() => setSelectedIds(new Set())}
                className="hover:text-foreground hover:underline"
              >
                Clear all
              </button>
            </div>
          </div>

          <div className="flex-1 overflow-y-auto p-4 space-y-2 font-sans bg-background/50">
            {filteredContacts.map(contact => {
              const isSelected = selectedIds.has(contact.id);
              return (
                <div
                  key={contact.id}
                  onClick={() => handleToggle(contact.id)}
                  className={`flex cursor-pointer items-center justify-between rounded-xl border p-3 transition-colors ${
                    isSelected 
                      ? 'border-primary bg-primary/10' 
                      : 'border-border bg-card hover:border-primary/50'
                  }`}
                >
                  <div className="flex items-center gap-3">
                    <img 
                      src={contact.avatarUrl} 
                      alt="" 
                      className="h-10 w-10 flex-shrink-0 rounded-full object-cover border border-border"
                    />
                    <div className="flex flex-col">
                      <span className="text-sm font-bold text-foreground">
                        {titleCase(contact.firstName)} {titleCase(contact.lastName)}
                      </span>
                      {contact.mandal && (
                        <span className="text-xs text-muted-foreground">{contact.mandal}</span>
                      )}
                    </div>
                  </div>
                  <div className={`flex h-6 w-6 items-center justify-center rounded-full border ${
                    isSelected ? 'bg-primary border-primary text-primary-foreground' : 'border-input bg-background'
                  }`}>
                    {isSelected && <Check className="h-3.5 w-3.5" />}
                  </div>
                </div>
              );
            })}
            
            {filteredContacts.length === 0 && (
              <div className="py-8 text-center text-sm text-muted-foreground">
                No contacts found.
              </div>
            )}
          </div>

          <div className="border-t border-border p-4 bg-card flex justify-end gap-3 font-sans">
            <button
              onClick={onClose}
              className="rounded-xl border border-input bg-background px-4 py-2 text-sm font-bold text-foreground hover:bg-muted outline-none"
            >
              Cancel
            </button>
            <button
              onClick={() => {
                onSelectionComplete(Array.from(selectedIds));
                onClose();
              }}
              className="rounded-xl bg-primary px-6 py-2 text-sm font-bold text-primary-foreground hover:opacity-90 outline-none"
            >
              Confirm Selection
            </button>
          </div>
        </motion.div>
      </div>
    </AnimatePresence>
  );
}
