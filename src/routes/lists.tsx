import { createFileRoute } from '@tanstack/react-router';
import { ProtectedRoute } from '../components/ProtectedRoute';
import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Plus, Users, Globe, Lock, List, Save, Trash2, UserPlus, X, RefreshCw, Download } from 'lucide-react';
import { supabase } from '../lib/supabase';
import { useAuth } from '../contexts/AuthContext';
import { useToast } from '../contexts/ToastContext';
import { useConfirm } from '../contexts/ConfirmContext';
import { ContactSelectorModal } from '../components/ContactSelectorModal';
import { mapContactRows, mapFollowupListRows, mapContactFollowupRows } from '../lib/mappers';
import type { ContactRow, FollowupListRow, ContactFollowupRow } from '../lib/database.types';
import type { Contact } from '../data/mockContacts';
import type { FollowupList, ContactFollowup } from '../lib/types';
import { handleLoaderError } from '../lib/errors';

export const Route = createFileRoute('/lists')({
  loader: async () => {
    // Load contacts
    const { data: contactsData, error: contactsError } = await supabase
      .from('contacts')
      .select('*')
      .limit(10000)
      .order('first_name');

    if (contactsError) return handleLoaderError('contacts', contactsError, { contacts: [], lists: [], initialListContacts: [], followups: [] });

    // Load visible lists
    const listsQuery = supabase
      .from('followup_lists')
      .select('*')
      .limit(10000)
      .order('created_at', { ascending: false });
    
    // RLS handles visibility but we'll just fetch all viewable ones
    const { data: listsData, error: listsError } = await listsQuery;
    
    if (listsError) return handleLoaderError('lists', listsError, { contacts: [], lists: [], initialListContacts: [], followups: [] });

    // Load list contacts mapping
    const listIds = listsData?.map(l => l.id) || [];
    let listContacts: any[] = [];
    
    if (listIds.length > 0) {
      const { data: lcData } = await supabase
        .from('followup_list_contacts')
        .select('*')
        .limit(50000)
        .in('list_id', listIds);
      listContacts = lcData || [];
    }

    const contactIds = Array.from(new Set(listContacts.map(lc => lc.contact_id)));
    let followups: any[] = [];
    if (contactIds.length > 0) {
      const { data: followupsData } = await supabase
        .from('contact_followups')
        .select('*')
        .in('contact_id', contactIds)
        .order('followup_date', { ascending: false });
      followups = followupsData || [];
    }

    return {
      contacts: mapContactRows((contactsData || []) as ContactRow[]),
      lists: mapFollowupListRows((listsData || []) as FollowupListRow[]),
      initialListContacts: listContacts,
      followups: followups, // Not strictly mapped using mappers since it might not exist yet if they use old schema
    };
  },
  component: ListsPage,
});

function ListsPage() {
  const { session } = useAuth();
  const { toast } = useToast();
  const { confirm } = useConfirm();
  const userId = session?.user.id;
  
  const loaderData = Route.useLoaderData();
  const [contacts, setContacts] = useState<Contact[]>(loaderData.contacts);
  const [dbLists, setDbLists] = useState<FollowupList[]>(loaderData.lists);
  const [followups, setFollowups] = useState<ContactFollowup[]>(
    loaderData.followups ? mapContactFollowupRows(loaderData.followups as ContactFollowupRow[]) : []
  );
  
  // Stored state: mapping list_id -> array of contact_ids
  const [listContactsMap, setListContactsMap] = useState<Record<string, string[]>>(() => {
    const initialMap: Record<string, string[]> = {};
    loaderData.lists.forEach(l => {
      initialMap[l.id] = loaderData.initialListContacts
        .filter((lc: any) => lc.list_id === l.id)
        .map((lc: any) => lc.contact_id);
    });
    return initialMap;
  });

  // Hydrate state from loader when route transitions
  useEffect(() => {
    setContacts(loaderData.contacts);
    setDbLists(loaderData.lists);
    const newMap: Record<string, string[]> = {};
    loaderData.lists.forEach(l => {
      newMap[l.id] = loaderData.initialListContacts
        .filter((lc: any) => lc.list_id === l.id)
        .map((lc: any) => lc.contact_id);
    });
    setListContactsMap(newMap);
  }, [loaderData]);

  // Session storage draft mechanism for just ONE active editing list
  const [editingListId, setEditingListId] = useState<string | null>(null);
  const [draftContactIds, setDraftContactIds] = useState<Set<string>>(new Set());
  const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isSaving, setIsSaving] = useState(false);

  // Follow-up State
  const [isLogFollowupOpen, setIsLogFollowupOpen] = useState(false);
  const [followupContactId, setFollowupContactId] = useState<string | null>(null);
  const [followupReason, setFollowupReason] = useState<ContactFollowup['reason']>('Other');
  const [followupDate, setFollowupDate] = useState(() => new Date().toISOString().substring(0, 10));
  const [isLoggingFollowup, setIsLoggingFollowup] = useState(false);

  // Create List State
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [newListName, setNewListName] = useState('');
  const [newListDesc, setNewListDesc] = useState('');
  const [newListPublic, setNewListPublic] = useState(false);
  const [isCreatingList, setIsCreatingList] = useState(false);

  // Update hasUnsavedChanges automatically
  useEffect(() => {
    if (editingListId) {
      const originalIds = listContactsMap[editingListId] || [];
      const isDifferent = draftContactIds.size !== originalIds.length || Array.from(draftContactIds).some(id => !originalIds.includes(id));
      setHasUnsavedChanges(isDifferent);
    } else {
      setHasUnsavedChanges(false);
    }
  }, [editingListId, draftContactIds, listContactsMap]);

  // Read draft from session storage on mount
  useEffect(() => {
    const draftId = sessionStorage.getItem('editingListId');
    const draftContacts = sessionStorage.getItem('draftContactIds');
    if (draftId && draftContacts) {
      setEditingListId(draftId);
      try {
        setDraftContactIds(new Set(JSON.parse(draftContacts)));
      } catch (e) {}
    }
  }, []);

  // Sync draft to session storage
  useEffect(() => {
    if (editingListId) {
      sessionStorage.setItem('editingListId', editingListId);
      sessionStorage.setItem('draftContactIds', JSON.stringify(Array.from(draftContactIds)));
    } else {
      sessionStorage.removeItem('editingListId');
      sessionStorage.removeItem('draftContactIds');
    }
  }, [editingListId, draftContactIds]);

  const activeList = editingListId ? dbLists.find(l => l.id === editingListId) : null;

  const handleEditList = async (listId: string) => {
    if (hasUnsavedChanges && editingListId && editingListId !== listId) {
      if (!(await confirm({ title: 'Unsaved Changes', description: 'You have unsaved changes. Discard them?', confirmText: 'Discard', danger: true }))) return;
    }
    setEditingListId(listId);
    setDraftContactIds(new Set(listContactsMap[listId] || []));
  };

  const handleRemoveFromDraft = (contactId: string) => {
    const newDraft = new Set(draftContactIds);
    newDraft.delete(contactId);
    setDraftContactIds(newDraft);
  };

  const handleModalSave = (selectedIds: string[]) => {
    setDraftContactIds(new Set(selectedIds));
  };

  const handleBulkSave = async () => {
    if (!editingListId) return;
    setIsSaving(true);
    
    // Original DB ids for this list
    const originalIds = listContactsMap[editingListId] || [];
    const currentDraftArray = Array.from(draftContactIds);

    const toAdd = currentDraftArray.filter(id => !originalIds.includes(id));
    const toRemove = originalIds.filter(id => !currentDraftArray.includes(id));

    try {
      if (toRemove.length > 0) {
        await supabase
          .from('followup_list_contacts')
          .delete()
          .eq('list_id', editingListId)
          .in('contact_id', toRemove);
      }
      
      if (toAdd.length > 0) {
        const insertPayload = toAdd.map(id => ({
          list_id: editingListId,
          contact_id: id,
        }));
        await supabase
          .from('followup_list_contacts')
          .insert(insertPayload);
      }

      setListContactsMap(prev => ({
        ...prev,
        [editingListId]: currentDraftArray
      }));
      toast('List saved successfully!', 'success');
      
    } catch (error) {
      console.error('Error saving list', error);
      toast('Error saving list. Please try again.', 'error');
    } finally {
      setIsSaving(false);
    }
  };

  const handleCreateList = async () => {
    if (!newListName.trim() || !userId) return;
    setIsCreatingList(true);
    try {
      const { data, error } = await supabase
        .from('followup_lists')
        .insert({
          name: newListName.trim(),
          description: newListDesc.trim() || null,
          is_public: newListPublic,
          created_by: userId,
        })
        .select()
        .single();
      
      if (error) throw error;

      const newList = mapFollowupListRows([data as FollowupListRow])[0];
      setDbLists(prev => [newList, ...prev]);
      
      setIsCreateModalOpen(false);
      setNewListName('');
      setNewListDesc('');
      setNewListPublic(false);
      
      setEditingListId(newList.id);
      setDraftContactIds(new Set());
      toast('List created successfully!', 'success');

    } catch (err) {
      console.error('Error creating list', err);
      toast('Error creating list.', 'error');
    } finally {
      setIsCreatingList(false);
    }
  };

  const handleDeleteList = async () => {
    if (!activeList || activeList.createdBy !== userId) return;
    if (!(await confirm({ title: 'Delete List', description: 'Are you sure you want to permanently delete this list? This cannot be undone.', confirmText: 'Delete', danger: true }))) return;
    
    try {
      const { error } = await supabase.from('followup_lists').delete().eq('id', activeList.id);
      if (error) throw error;
      
      setEditingListId(null);
      setDraftContactIds(new Set());
      setDbLists(prev => prev.filter(l => l.id !== activeList.id));
      toast('List deleted permanently.', 'success');
    } catch (err) {
      console.error('Failed to delete list', err);
      toast('Failed to delete list.', 'error');
    }
  };

  const handleToggleVisibility = async () => {
    if (!activeList || activeList.createdBy !== userId) return;
    
    const targetState = !activeList.isPublic;
    setDbLists(prev => prev.map(l => l.id === activeList.id ? { ...l, isPublic: targetState } : l));
    
    try {
      const { error } = await supabase
        .from('followup_lists')
        .update({ is_public: targetState })
        .eq('id', activeList.id);
        
      if (error) throw error;
      toast(`List is now ${targetState ? 'public' : 'private'}.`, 'success');
    } catch (err) {
      console.error('Failed to toggle visibility', err);
      // Revert UI
      setDbLists(prev => prev.map(l => l.id === activeList.id ? { ...l, isPublic: !targetState } : l));
      toast('Failed to change list visibility.', 'error');
    }
  };

  const handleLogFollowup = async () => {
    if (!followupContactId || !userId) return;
    setIsLoggingFollowup(true);
    try {
      const { data, error } = await supabase
        .from('contact_followups')
        .insert({
          contact_id: followupContactId,
          reason: followupReason,
          followup_date: new Date(followupDate).toISOString(),
          created_by: userId,
        })
        .select()
        .single();
      
      if (error) throw error;
      
      const newFollowup = mapContactFollowupRows([data as ContactFollowupRow])[0];
      setFollowups(prev => [newFollowup, ...prev]);
      
      setIsLogFollowupOpen(false);
      setFollowupContactId(null);
      toast('Follow-up logged successfully!', 'success');
    } catch (err) {
      console.error('Failed to log followup', err);
      toast('Failed to log follow-up.', 'error');
    } finally {
      setIsLoggingFollowup(false);
    }
  };

  const handleExportCSV = () => {
    if (!activeList || draftContactIds.size === 0) {
      toast('List is empty, nothing to export.', 'info');
      return;
    }
    
    const listContacts = Array.from(draftContactIds)
      .map(id => contacts.find(c => c.id === id))
      .filter(Boolean) as Contact[];
      
    const headers = ['First Name', 'Last Name', 'Nickname', 'Email', 'Phone', 'Mandal', 'Address', 'City', 'State', 'Zip'];
    
    const escapeCsv = (str: string | null | undefined) => {
      if (!str) return '""';
      const cleanStr = String(str).replace(/"/g, '""');
      return `"${cleanStr}"`;
    };
    
    const rows = listContacts.map(c => [
      escapeCsv(c.firstName),
      escapeCsv(c.lastName),
      escapeCsv(c.nickname),
      escapeCsv(c.email),
      escapeCsv(c.cellphone),
      escapeCsv(c.mandal),
      escapeCsv(c.address1),
      escapeCsv(c.city),
      escapeCsv(c.state),
      escapeCsv(c.zip)
    ].join(','));
    
    const csvContent = [headers.map(escapeCsv).join(','), ...rows].join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    
    const link = document.createElement('a');
    link.href = url;
    link.setAttribute('download', `${activeList.name.replace(/\s+/g, '_')}_contacts.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    toast('Exported list as CSV!', 'success');
  };

  const myLists = dbLists.filter(l => l.createdBy === userId);
  const publicLists = dbLists.filter(l => l.isPublic && l.createdBy !== userId);

  return (
    <ProtectedRoute allowedRoles={['Super Admin', 'Admin', 'User']}>
      <div className="flex h-[calc(100vh-64px)] w-full overflow-hidden bg-background font-sans">
        
        {/* Left Sidebar - Lists Overview */}
        <div className={`relative flex flex-col border-r border-border bg-card transition-all duration-300 w-full md:w-[350px] ${editingListId ? 'hidden md:flex' : 'flex'}`}>
          <div className="p-4 pt-6 border-b border-border bg-card/80 backdrop-blur-xl">
             <div className="flex items-center justify-between">
                <h1 className="text-2xl font-bold tracking-tight text-foreground font-serif">Follow-up Lists</h1>
                <button 
                  onClick={() => setIsCreateModalOpen(true)}
                  className="rounded-full bg-primary/10 text-primary p-2 hover:bg-primary/20 transition-colors" 
                  title="Create New List"
                >
                  <Plus className="h-5 w-5" />
                </button>
             </div>
             <p className="text-sm text-muted-foreground mt-1">Manage grouped contacts</p>
          </div>

          <div className="flex-1 overflow-y-auto p-4 space-y-6">
             {/* My Lists Section */}
             <div>
               <h3 className="text-xs font-bold uppercase tracking-widest text-muted-foreground mb-3 flex items-center gap-2">
                 <UserPlus className="h-4 w-4" /> My Lists
               </h3>
               {myLists.length === 0 ? (
                 <div className="text-sm text-muted-foreground italic bg-muted/50 p-4 rounded-xl border border-dashed border-border text-center">No personal lists yet.</div>
               ) : (
                 <div className="space-y-2">
                   {myLists.map(list => (
                     <div 
                       key={list.id}
                       onClick={() => handleEditList(list.id)}
                       className={`p-3 rounded-xl border cursor-pointer transition-all hover:bg-muted ${editingListId === list.id ? 'border-primary bg-primary/5 shadow-sm' : 'border-border bg-card'}`}
                     >
                       <div className="flex justify-between items-start mb-1">
                          <span className="font-bold text-[14px] text-foreground">{list.name}</span>
                          {!list.isPublic ? <Lock className="h-3.5 w-3.5 text-muted-foreground" title="Private" /> : <Globe className="h-3.5 w-3.5 text-primary" title="Public" />}
                       </div>
                       {list.description && <p className="text-xs text-muted-foreground line-clamp-1 mb-2">{list.description}</p>}
                       <div className="flex items-center text-xs font-semibold text-muted-foreground bg-background rounded-lg px-2 py-1 w-fit border border-border">
                          <Users className="h-3 w-3 mr-1.5" /> {(listContactsMap[list.id] || []).length} contacts
                       </div>
                     </div>
                   ))}
                 </div>
               )}
             </div>

             {/* Public Lists Section */}
             <div>
               <h3 className="text-xs font-bold uppercase tracking-widest text-muted-foreground mb-3 flex items-center gap-2">
                 <Globe className="h-4 w-4" /> Public Lists
               </h3>
               {publicLists.length === 0 ? (
                 <div className="text-sm text-muted-foreground italic p-2 text-center">No public lists available.</div>
               ) : (
                 <div className="space-y-2">
                   {publicLists.map(list => (
                     <div 
                       key={list.id}
                       onClick={() => handleEditList(list.id)}
                       className={`p-3 rounded-xl border cursor-pointer transition-all hover:bg-muted ${editingListId === list.id ? 'border-primary bg-primary/5 shadow-sm' : 'border-border bg-card'}`}
                     >
                       <span className="font-bold text-[14px] text-foreground block mb-1">{list.name}</span>
                       <div className="flex items-center text-xs font-semibold text-muted-foreground mt-2">
                          <Users className="h-3 w-3 mr-1.5" /> {(listContactsMap[list.id] || []).length} contacts
                       </div>
                     </div>
                   ))}
                 </div>
               )}
             </div>
          </div>
        </div>

        {/* Right Area - Detail/Edit View */}
        <div className={`flex-1 flex-col overflow-hidden bg-background ${editingListId ? 'flex' : 'hidden md:flex'}`}>
          <AnimatePresence mode="wait">
            {!activeList ? (
                <motion.div
                  key="empty"
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                  className="flex h-full flex-col items-center justify-center text-muted-foreground p-8 text-center"
                >
                  <List className="h-16 w-16 opacity-20 mb-4" />
                  <p className="text-lg font-serif">Select a list to view or edit</p>
                </motion.div>
            ) : (
                <motion.div
                  key="detail"
                  initial={{ opacity: 0, x: 20 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: -20 }}
                  className="flex flex-col h-full"
                >
                  {/* Detail Header */}
                  <div className="border-b border-border bg-card p-6 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                     <div>
                        <button
                          className="mb-4 flex items-center text-sm font-bold text-primary md:hidden"
                          onClick={() => setEditingListId(null)}
                        >
                          &larr; Back to Lists
                        </button>
                        <div className="flex items-center gap-3">
                           <h2 className="text-3xl font-bold tracking-tight text-foreground font-serif">{activeList.name}</h2>
                           {hasUnsavedChanges && (
                              <span className="bg-amber-100 text-amber-800 text-[10px] font-bold px-2 py-0.5 rounded-full border border-amber-200 uppercase tracking-wider">Unsaved Changes</span>
                           )}
                        </div>
                        {activeList.description && <p className="text-sm text-muted-foreground mt-2">{activeList.description}</p>}
                     </div>
                     
                     <div className="flex items-center gap-2 self-start sm:self-center flex-wrap justify-end">
                        <button 
                          onClick={handleExportCSV}
                          className="flex items-center justify-center p-2 rounded-xl text-muted-foreground hover:bg-muted hover:text-foreground transition-all outline-none"
                          title="Export as CSV"
                        >
                          <Download className="h-4 w-4" />
                        </button>

                        {activeList.createdBy === userId && (
                           <button 
                             onClick={handleDeleteList}
                             className="flex items-center justify-center p-2 rounded-xl text-muted-foreground hover:bg-destructive hover:text-white transition-all outline-none"
                             title="Delete List"
                           >
                             <Trash2 className="h-4 w-4" />
                           </button>
                        )}
                        
                        {activeList.createdBy === userId && (
                           <button 
                             onClick={handleToggleVisibility}
                             className={`flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-bold transition-all outline-none ${activeList.isPublic ? 'bg-primary/10 text-primary hover:bg-primary/20' : 'bg-muted text-muted-foreground hover:bg-muted/80'}`}
                             title={activeList.isPublic ? "Make list private" : "Make list public"}
                           >
                             {activeList.isPublic ? <Globe className="h-3.5 w-3.5" /> : <Lock className="h-3.5 w-3.5" />}
                             <span className="hidden sm:inline">{activeList.isPublic ? 'Public' : 'Private'}</span>
                           </button>
                        )}
                        
                        <button 
                          onClick={() => setIsModalOpen(true)}
                          className="flex items-center gap-1.5 bg-primary/10 text-primary px-3 py-2 rounded-xl text-xs sm:text-sm font-bold hover:bg-primary/20 transition-all outline-none"
                        >
                          <Plus className="h-4 w-4" /> <span className="hidden sm:inline">Add Contacts</span>
                        </button>
                        <button 
                          disabled={!hasUnsavedChanges || isSaving}
                          onClick={handleBulkSave}
                          className={`flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs sm:text-sm font-bold transition-all outline-none ${hasUnsavedChanges ? 'bg-primary text-primary-foreground hover:opacity-90 shadow-md' : 'bg-muted text-muted-foreground cursor-not-allowed'}`}
                        >
                          {isSaving ? <RefreshCw className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />} <span className="hidden sm:inline">Save</span>
                        </button>
                     </div>
                  </div>

                  {/* List Contacts Container */}
                  <div className="flex-1 overflow-y-auto p-4 sm:p-6 bg-background/50">
                     {draftContactIds.size === 0 ? (
                        <div className="text-center p-12 bg-card rounded-2xl border border-dashed border-border shadow-sm">
                           <Users className="h-12 w-12 mx-auto opacity-20 mb-4 text-muted-foreground" />
                           <p className="text-muted-foreground text-sm font-semibold">This list is currently empty.</p>
                           <button onClick={() => setIsModalOpen(true)} className="mt-4 text-primary text-sm font-bold hover:underline outline-none">Add your first contact</button>
                        </div>
                     ) : (
                        <div className="space-y-8">
                           {/* Calculate groupings */}
                           {(() => {
                              const FOUR_WEEKS_MS = 4 * 7 * 24 * 60 * 60 * 1000;
                              const now = Date.now();
                              const recentContacts: Contact[] = [];
                              const waitingContacts: Contact[] = [];

                              Array.from(draftContactIds).forEach(contactId => {
                                 const contact = contacts.find(c => c.id === contactId);
                                 if (!contact) return;
                                 
                                 const contactFollowups = followups.filter(f => f.contactId === contactId);
                                 const latestFollowup = contactFollowups.length > 0 ? 
                                    contactFollowups.reduce((latest, f) => new Date(f.followupDate) > new Date(latest.followupDate) ? f : latest) : null;
                                 
                                 if (!latestFollowup) {
                                    waitingContacts.push(contact);
                                 } else {
                                    const followupDate = new Date(latestFollowup.followupDate).getTime();
                                    if (now - followupDate > FOUR_WEEKS_MS) {
                                       waitingContacts.push(contact);
                                    } else {
                                       recentContacts.push(contact);
                                    }
                                 }
                              });

                              const renderContactCard = (contact: Contact) => {
                                 const contactFollowups = followups.filter(f => f.contactId === contact.id);
                                 const latestFollowup = contactFollowups.length > 0 ? 
                                    contactFollowups.reduce((latest, f) => new Date(f.followupDate) > new Date(latest.followupDate) ? f : latest) : null;

                                 return (
                                    <div key={contact.id} className="group relative flex flex-col sm:flex-row items-start sm:items-center gap-4 p-4 rounded-2xl border border-border bg-card shadow-sm hover:border-primary/30 transition-all">
                                       <div className="flex items-center gap-4 w-full sm:w-auto flex-1 min-w-0">
                                          <img src={contact.avatarUrl} alt="" className="h-12 w-12 rounded-full object-cover border border-border shadow-sm" />
                                          <div className="flex-1 min-w-0">
                                             <h4 className="font-bold text-foreground text-[15px] truncate pr-8">
                                                {contact.firstName} {contact.lastName} 
                                                {contact.nickname && <span className="text-muted-foreground font-normal italic text-xs ml-1">"{contact.nickname}"</span>}
                                             </h4>
                                             <div className="flex items-center gap-2 mt-1 truncate">
                                                {contact.cellphone && <span className="text-xs text-muted-foreground">{contact.cellphone}</span>}
                                                {contact.cellphone && contact.mandal && <span className="text-muted-foreground/30">•</span>}
                                                {contact.mandal && <span className="text-[10px] uppercase font-bold text-primary/70">{contact.mandal.replace(/_/g, ' ')}</span>}
                                             </div>
                                             {latestFollowup && (
                                                <div className="text-[11px] text-muted-foreground mt-1.5 flex items-center gap-1.5">
                                                   <span className="font-semibold text-foreground/70">Last follow-up:</span> 
                                                   {new Date(latestFollowup.followupDate).toLocaleDateString()} - {latestFollowup.reason}
                                                </div>
                                             )}
                                          </div>
                                       </div>
                                       
                                       <div className="flex w-full sm:w-auto items-center justify-end gap-2 mt-2 sm:mt-0 pt-2 sm:pt-0 border-t sm:border-t-0 border-border">
                                          <button 
                                             onClick={() => {
                                                setFollowupContactId(contact.id);
                                                setIsLogFollowupOpen(true);
                                             }}
                                             className="text-xs font-bold text-primary hover:text-primary/80 bg-primary/10 hover:bg-primary/20 px-3 py-1.5 rounded-lg transition-colors outline-none"
                                          >
                                             Log Follow-up
                                          </button>
                                          <button 
                                             onClick={() => handleRemoveFromDraft(contact.id)}
                                             className="p-1.5 text-muted-foreground/40 hover:text-destructive hover:bg-destructive/10 active:bg-destructive/20 rounded-lg transition-all outline-none"
                                             title="Remove from list"
                                          >
                                             <X className="h-4 w-4" />
                                          </button>
                                       </div>
                                    </div>
                                 );
                              };

                              return (
                                 <>
                                    {waitingContacts.length > 0 && (
                                       <div>
                                          <h3 className="text-xs font-bold uppercase tracking-widest text-amber-600 mb-3 flex items-center gap-2 bg-amber-500/10 w-fit px-3 py-1 rounded-full border border-amber-500/20">
                                             Waiting Outreach
                                          </h3>
                                          <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">
                                             {waitingContacts.map(renderContactCard)}
                                          </div>
                                       </div>
                                    )}

                                    {recentContacts.length > 0 && (
                                       <div>
                                          <h3 className="text-xs font-bold uppercase tracking-widest text-emerald-600 mb-3 flex items-center gap-2 bg-emerald-500/10 w-fit px-3 py-1 rounded-full border border-emerald-500/20 mt-8">
                                             Recent
                                          </h3>
                                          <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">
                                             {recentContacts.map(renderContactCard)}
                                          </div>
                                       </div>
                                    )}
                                 </>
                              );
                           })()}
                        </div>
                     )}
                  </div>
                </motion.div>
            )}
          </AnimatePresence>
        </div>

        {/* Modal */}
        <ContactSelectorModal 
          isOpen={isModalOpen}
          onClose={() => setIsModalOpen(false)}
          contacts={contacts}
          alreadySelectedIds={Array.from(draftContactIds)}
          onSelectionComplete={handleModalSave}
        />

        {/* Log Follow-up Modal */}
        <AnimatePresence>
          {isLogFollowupOpen && followupContactId && (
            <div className="fixed inset-0 z-[100] flex items-center justify-center bg-background/80 backdrop-blur-sm">
              <motion.div
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.95 }}
                className="w-full max-w-sm overflow-hidden rounded-2xl border border-border bg-card shadow-2xl flex flex-col"
              >
                <div className="flex items-center justify-between border-b border-border p-4">
                  <h2 className="text-xl font-bold font-serif text-foreground">Log Follow-up</h2>
                  <button onClick={() => { setIsLogFollowupOpen(false); setFollowupContactId(null); }} className="rounded-full p-2 hover:bg-muted text-muted-foreground outline-none">
                    <X className="h-5 w-5" />
                  </button>
                </div>
                
                <div className="p-4 space-y-4 font-sans">
                  <div>
                    <label className="text-xs font-bold uppercase text-muted-foreground block mb-1">Reason *</label>
                    <select 
                      value={followupReason}
                      onChange={e => setFollowupReason(e.target.value as ContactFollowup['reason'])}
                      className="block w-full rounded-xl border border-input bg-background py-2 px-3 text-sm text-foreground focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary transition-all"
                    >
                      <option value="Mandir Event">Mandir Event</option>
                      <option value="Sabha">Sabha</option>
                      <option value="Shibir">Shibir</option>
                      <option value="Seva">Seva</option>
                      <option value="Other">Other</option>
                    </select>
                  </div>
                  <div>
                    <label className="text-xs font-bold uppercase text-muted-foreground block mb-1">Date *</label>
                    <input 
                      type="date" 
                      value={followupDate}
                      onChange={e => setFollowupDate(e.target.value)}
                      className="block w-full rounded-xl border border-input bg-background py-2 px-3 text-sm text-foreground focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary transition-all"
                    />
                  </div>
                </div>

                <div className="border-t border-border p-4 bg-card flex justify-end gap-3 font-sans">
                  <button
                    onClick={() => { setIsLogFollowupOpen(false); setFollowupContactId(null); }}
                    className="rounded-xl border border-input bg-background px-4 py-2 text-sm font-bold text-foreground hover:bg-muted outline-none"
                  >
                    Cancel
                  </button>
                  <button
                    disabled={isLoggingFollowup}
                    onClick={handleLogFollowup}
                    className="rounded-xl bg-primary px-6 py-2 text-sm font-bold text-primary-foreground hover:opacity-90 outline-none disabled:opacity-50 flex items-center gap-2"
                  >
                    {isLoggingFollowup ? <RefreshCw className="h-4 w-4 animate-spin" /> : null}
                    Submit
                  </button>
                </div>
              </motion.div>
            </div>
          )}
        </AnimatePresence>

        {/* Create List Modal */}
        <AnimatePresence>
          {isCreateModalOpen && (
            <div className="fixed inset-0 z-[100] flex items-center justify-center bg-background/80 backdrop-blur-sm">
              <motion.div
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.95 }}
                className="w-full max-w-sm overflow-hidden rounded-2xl border border-border bg-card shadow-2xl flex flex-col"
              >
                <div className="flex items-center justify-between border-b border-border p-4">
                  <h2 className="text-xl font-bold font-serif text-foreground">Create New List</h2>
                  <button onClick={() => setIsCreateModalOpen(false)} className="rounded-full p-2 hover:bg-muted text-muted-foreground outline-none">
                    <X className="h-5 w-5" />
                  </button>
                </div>
                
                <div className="p-4 space-y-4 font-sans">
                  <div>
                    <label className="text-xs font-bold uppercase text-muted-foreground block mb-1">List Name *</label>
                    <input 
                      type="text" 
                      placeholder="e.g. Youth Camp Volunteers"
                      value={newListName}
                      onChange={e => setNewListName(e.target.value)}
                      className="block w-full rounded-xl border border-input bg-background py-2 px-3 text-sm text-foreground focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary transition-all"
                      autoFocus
                    />
                  </div>
                  <div>
                    <label className="text-xs font-bold uppercase text-muted-foreground block mb-1">Description</label>
                    <textarea 
                      placeholder="Optional notes about this list..."
                      value={newListDesc}
                      onChange={e => setNewListDesc(e.target.value)}
                      className="block w-full rounded-xl border border-input bg-background py-2 px-3 text-sm text-foreground focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary transition-all resize-none h-20"
                    />
                  </div>
                  <div className="flex items-center gap-2 pt-1 border-t border-border mt-4">
                    <input 
                      type="checkbox" 
                      id="isPublic"
                      checked={newListPublic}
                      onChange={e => setNewListPublic(e.target.checked)}
                      className="w-4 h-4 rounded border-input text-primary focus:ring-primary"
                    />
                    <label htmlFor="isPublic" className="text-sm font-semibold text-foreground cursor-pointer">Make Public</label>
                  </div>
                  <p className="text-xs text-muted-foreground mt-1 ml-6">Public lists are visible to all users but can only be modified by you.</p>
                </div>

                <div className="border-t border-border p-4 bg-card flex justify-end gap-3 font-sans">
                  <button
                    onClick={() => setIsCreateModalOpen(false)}
                    className="rounded-xl border border-input bg-background px-4 py-2 text-sm font-bold text-foreground hover:bg-muted outline-none"
                  >
                    Cancel
                  </button>
                  <button
                    disabled={!newListName.trim() || isCreatingList}
                    onClick={handleCreateList}
                    className="rounded-xl bg-primary px-6 py-2 text-sm font-bold text-primary-foreground hover:opacity-90 outline-none disabled:opacity-50 flex items-center gap-2"
                  >
                    {isCreatingList ? <RefreshCw className="h-4 w-4 animate-spin" /> : null}
                    Create List
                  </button>
                </div>
              </motion.div>
            </div>
          )}
        </AnimatePresence>

      </div>
    </ProtectedRoute>
  );
}
