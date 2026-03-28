import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { 
  Users, Lock, Unlock, Search, Plus, Loader2, X, 
  Image as ImageIcon, Info, ChevronRight, Globe
} from 'lucide-react';
import { supabase } from '../lib/supabase';
import { useTenant } from '../contexts/TenantContext';

export default function Groups() {
  const { user } = useTenant();
  const navigate = useNavigate();

  // CORE DATA STATE
  const [groups, setGroups] = useState<any[]>([]);
  const [myMemberships, setMyMemberships] = useState<string[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  // UI STATE
  const [searchQuery, setSearchQuery] = useState('');
  const [isSearching, setIsSearching] = useState(false); // NOW USED IN SEARCH BAR
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // NEW GROUP FORM STATE
  const [newGroup, setNewGroup] = useState({ name: '', description: '', privacy: 'public' });

  // 1. INITIAL LOAD
  useEffect(() => {
    fetchGroups();
    if (user) fetchMyMemberships();
  }, [user]);

  const fetchGroups = async (query = '') => {
    setIsSearching(!!query);
    try {
      let request = supabase
        .from('groups')
        .select(`
          *,
          member_count:group_members(count)
        `)
        .order('created_at', { ascending: false });

      if (query) {
        request = request.ilike('name', `%${query}%`);
      }

      const { data, error } = await request;
      if (error) throw error;
      setGroups(data || []);
    } catch (err) {
      console.error(err);
    } finally {
      setIsLoading(false);
      setIsSearching(false);
    }
  };

  const fetchMyMemberships = async () => {
    if (!user) return;
    const { data } = await supabase.from('group_members').select('group_id').eq('user_id', user.id);
    if (data) setMyMemberships(data.map(m => m.group_id));
  };

  // 2. SEARCH HANDLER
  useEffect(() => {
    const delayDebounce = setTimeout(() => {
      fetchGroups(searchQuery);
    }, 400);
    return () => clearTimeout(delayDebounce);
  }, [searchQuery]);

  // 3. JOIN / LEAVE LOGIC
  const handleToggleJoin = async (e: React.MouseEvent, groupId: string) => {
    e.stopPropagation();
    if (!user) return alert("Sign in to join groups.");

    const isMember = myMemberships.includes(groupId);

    try {
      if (isMember) {
        await supabase.from('group_members').delete().eq('group_id', groupId).eq('user_id', user.id);
        setMyMemberships(prev => prev.filter(id => id !== groupId));
      } else {
        await supabase.from('group_members').insert({ group_id: groupId, user_id: user.id });
        setMyMemberships(prev => [...prev, groupId]);
      }
      fetchGroups(searchQuery); 
    } catch (err) {
      console.error(err);
    }
  };

  // 4. CREATE GROUP LOGIC
  const handleCreateGroup = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user || !newGroup.name) return;

    setIsSubmitting(true);
    try {
      const { data, error } = await supabase.from('groups').insert({
        name: newGroup.name,
        description: newGroup.description,
        privacy: newGroup.privacy,
        created_by: user.id,
        image_url: `https://source.unsplash.com/random/400x400?association,${Math.random()}`
      }).select().single();

      if (error) throw error;

      await supabase.from('group_members').insert({
        group_id: data.id,
        user_id: user.id,
        role: 'admin'
      });

      setNewGroup({ name: '', description: '', privacy: 'public' });
      setIsCreateModalOpen(false);
      fetchGroups();
      fetchMyMemberships();
    } catch (err) {
      alert("Failed to create group.");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="space-y-8 pb-32 animate-in fade-in duration-500 font-sans select-none">
      
      {/* HEADER & SEARCH */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-6 mb-8 px-2">
        <div>
          <h1 className="text-3xl font-black text-slate-800 tracking-tight">Industry Hubs</h1>
          <p className="text-xs font-bold text-slate-500 uppercase tracking-widest mt-1 flex items-center gap-2">
            <Globe size={12} className="text-teal-500"/> Connect with regional associations
          </p>
        </div>
        
        <div className="flex gap-3 w-full md:w-auto">
          <div className="relative flex-1 md:w-80">
            {/* isSearching used here to swap the icon during active fetches */}
            <div className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400">
              {isSearching ? <Loader2 size={18} className="animate-spin text-[#1da1f2]" /> : <Search size={18} />}
            </div>
            <input 
              type="text" 
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search associations..." 
              className="w-full bg-[#e0e5ec] text-sm font-semibold text-slate-700 placeholder:text-slate-400 rounded-full py-3.5 pl-12 pr-4 shadow-[inset_4px_4px_8px_#a3b1c6,inset_-4px_-4px_8px_#ffffff] focus:outline-none"
            />
          </div>
          <button 
            onClick={() => setIsCreateModalOpen(true)}
            className="w-12 h-12 shrink-0 rounded-full bg-[#1da1f2] text-white flex items-center justify-center shadow-[5px_5px_10px_#a3b1c6,-5px_-5px_10px_#ffffff] hover:bg-[#1a91da] active:scale-95 transition-all"
          >
            <Plus size={24} strokeWidth={3} />
          </button>
        </div>
      </div>

      {/* GROUP GRID */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-8 px-2">
        {isLoading ? (
          <div className="col-span-full flex justify-center py-20">
            <Loader2 className="animate-spin text-[#1da1f2]" size={40} />
          </div>
        ) : groups.length > 0 ? (
          groups.map((group) => (
            <div 
              key={group.id} 
              onClick={() => navigate(`/groups/${group.id}`)}
              className="bg-[#e0e5ec] rounded-[2.5rem] p-6 shadow-[9px_9px_16px_#a3b1c6,-9px_-9px_16px_#ffffff] hover:shadow-[inset_4px_4px_8px_#a3b1c6,inset_-4px_-4px_8px_#ffffff] transition-all group flex flex-col h-full"
            >
              <div className="flex items-start gap-5 mb-6">
                <div className="w-20 h-20 shrink-0 rounded-3xl shadow-[5px_5px_10px_#a3b1c6,-5px_-5px_10px_#ffffff] overflow-hidden p-1.5 bg-[#e0e5ec]">
                  <img src={group.image_url} alt={group.name} className="w-full h-full object-cover rounded-2xl" />
                </div>
                
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1.5">
                    {group.privacy === 'private' ? <Lock size={12} className="text-rose-500" /> : <Unlock size={12} className="text-teal-500" />}
                    <span className="text-[10px] font-black uppercase tracking-widest text-slate-400">{group.privacy}</span>
                  </div>
                  <h3 className="text-lg font-black text-slate-800 leading-tight truncate group-hover:text-[#1da1f2] transition-colors">{group.name}</h3>
                  <div className="flex items-center gap-3 mt-2 text-[11px] font-bold text-slate-500">
                    <span className="flex items-center gap-1.5 bg-white/50 px-2 py-0.5 rounded-md shadow-sm">
                      <Users size={12} className="text-teal-600"/> {group.member_count?.[0]?.count || 0}
                    </span>
                  </div>
                </div>
              </div>

              <p className="text-xs font-medium text-slate-500 leading-relaxed mb-6 line-clamp-2 italic">
                "{group.description || 'No description provided for this industry hub.'}"
              </p>

              <div className="mt-auto pt-4 flex gap-3">
                <button 
                  onClick={(e) => handleToggleJoin(e, group.id)}
                  className={`flex-1 py-3.5 rounded-2xl font-black text-xs uppercase tracking-widest transition-all ${
                    myMemberships.includes(group.id)
                      ? 'bg-slate-200 text-slate-500 shadow-inner'
                      : 'bg-white text-slate-800 shadow-[4px_4px_8px_#a3b1c6,-4px_-4px_8px_#ffffff] hover:bg-[#1da1f2] hover:text-white'
                  }`}
                >
                  {myMemberships.includes(group.id) ? 'Member' : 'Join Hub'}
                </button>
                <button className="w-12 h-12 rounded-2xl bg-white flex items-center justify-center text-slate-400 shadow-[4px_4px_8px_#a3b1c6,-4px_-4px_8px_#ffffff] hover:text-[#1da1f2]">
                  <ChevronRight size={20} />
                </button>
              </div>
            </div>
          ))
        ) : (
          <div className="col-span-full text-center py-20 bg-white/30 rounded-[3rem] border-2 border-dashed border-white/50">
            <Info size={40} className="mx-auto text-slate-300 mb-4" />
            <h3 className="text-lg font-black text-slate-500">No hubs found</h3>
            <p className="text-sm font-medium text-slate-400">Try a different search or create your own union.</p>
          </div>
        )}
      </div>

      {/* CREATE GROUP MODAL */}
      {isCreateModalOpen && (
        <div className="fixed inset-0 z-[2000] flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-slate-900/60 backdrop-blur-md animate-in fade-in" onClick={() => setIsCreateModalOpen(false)} />
          
          <form onSubmit={handleCreateGroup} className="w-full max-w-md bg-[#e0e5ec] rounded-[3rem] p-8 shadow-2xl relative z-10 animate-in zoom-in-95 duration-300">
            <div className="flex justify-between items-center mb-8">
              <h2 className="text-2xl font-black text-slate-800 tracking-tight">Form a Hub</h2>
              <button type="button" onClick={() => setIsCreateModalOpen(false)} className="w-10 h-10 rounded-full bg-white shadow-md flex items-center justify-center text-slate-400 hover:text-rose-500 transition-colors">
                <X size={20} />
              </button>
            </div>

            <div className="space-y-6">
              <div className="space-y-2">
                <label className="text-[10px] font-black uppercase tracking-widest text-slate-400 ml-4 flex items-center gap-2">
                  <ImageIcon size={12} className="text-teal-500" /> Hub Name {/* ImageIcon used here */}
                </label>
                <input 
                  required
                  type="text" 
                  value={newGroup.name}
                  onChange={e => setNewGroup({...newGroup, name: e.target.value})}
                  placeholder="e.g. Accra Safari Fleet"
                  className="w-full bg-[#e0e5ec] text-sm font-bold text-slate-700 rounded-2xl py-4 px-6 shadow-[inset_4px_4px_8px_#a3b1c6,inset_-4px_-4px_8px_#ffffff] focus:outline-none"
                />
              </div>

              <div className="space-y-2">
                <label className="text-[10px] font-black uppercase tracking-widest text-slate-400 ml-4">Privacy</label>
                <div className="flex gap-4 p-1.5 bg-white/30 rounded-2xl">
                  {['public', 'private'].map(p => (
                    <button
                      key={p}
                      type="button"
                      onClick={() => setNewGroup({...newGroup, privacy: p})}
                      className={`flex-1 py-3 rounded-xl text-xs font-black uppercase tracking-tighter transition-all ${newGroup.privacy === p ? 'bg-[#1da1f2] text-white shadow-lg' : 'text-slate-500 hover:bg-white/50'}`}
                    >
                      {p}
                    </button>
                  ))}
                </div>
              </div>

              <div className="space-y-2">
                <label className="text-[10px] font-black uppercase tracking-widest text-slate-400 ml-4">Purpose / Description</label>
                <textarea 
                  value={newGroup.description}
                  onChange={e => setNewGroup({...newGroup, description: e.target.value})}
                  rows={3}
                  placeholder="What is this hub for?"
                  className="w-full bg-[#e0e5ec] text-sm font-bold text-slate-700 rounded-3xl py-4 px-6 shadow-[inset_4px_4px_8px_#a3b1c6,inset_-4px_-4px_8px_#ffffff] focus:outline-none resize-none"
                />
              </div>

              <button 
                type="submit"
                disabled={isSubmitting}
                className="w-full py-4 mt-4 bg-slate-900 text-white rounded-2xl font-black text-sm uppercase tracking-widest flex items-center justify-center gap-3 shadow-xl hover:bg-black active:scale-95 transition-all"
              >
                {isSubmitting ? <Loader2 className="animate-spin" size={20} /> : 'Establish Union'}
              </button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
}