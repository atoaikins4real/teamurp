import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { 
  Search, MapPin, SlidersHorizontal, 
  Car, Bus, Users, Building2, ShieldCheck, Loader2, User as UserIcon,
  UserPlus, UserCheck, X, ArrowRight, MessageSquare, Utensils, Briefcase, ChevronDown
} from 'lucide-react';
import { supabase } from '../lib/supabase';
import { useTenant } from '../contexts/TenantContext';
import { AuthModal } from '../components/AuthModal';

// --- MATH HELPER: HAVERSINE DISTANCE ---
function calculateDistance(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const R = 6371; 
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLon = (lon2 - lon1) * Math.PI / 180;
  const a = Math.sin(dLat/2) * Math.sin(dLat/2) +
            Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
            Math.sin(dLon/2) * Math.sin(dLon/2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
  return R * c;
}

// --- DYNAMIC ICON MAPPER ---
const getCategoryIcon = (type: string) => {
  const t = type.toLowerCase();
  if (t.includes('transport') || t.includes('car') || t.includes('fleet')) return <Car size={24} className="text-[#1da1f2]" />;
  if (t.includes('bus')) return <Bus size={24} className="text-indigo-500" />;
  if (t.includes('guide') || t.includes('tour')) return <Users size={24} className="text-amber-500" />;
  if (t.includes('stay') || t.includes('hotel') || t.includes('accommodation') || t.includes('lodge')) return <Building2 size={24} className="text-teal-500" />;
  if (t.includes('food') || t.includes('restaurant')) return <Utensils size={24} className="text-rose-500" />;
  return <Briefcase size={24} className="text-slate-500" />;
};

export default function Network() {
  const navigate = useNavigate();
  const { user: currentUser } = useTenant();
  
  // CORE STATE
  const [followingIds, setFollowingIds] = useState<string[]>([]);
  const [popularPartners, setPopularPartners] = useState<any[]>([]);
  const [dynamicCategories, setDynamicCategories] = useState<{type: string, count: number}[]>([]);
  
  // PAGINATION STATE
  const [page, setPage] = useState(0);
  const [hasMore, setHasMore] = useState(true);
  const [isLoadingPartners, setIsLoadingPartners] = useState(true);
  const [isLoadingMore, setIsLoadingMore] = useState(false);

  // LOCATION & FILTER STATE
  const [userLocation, setUserLocation] = useState<{lat: number, lon: number} | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<any[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [showFilters, setShowFilters] = useState(false);
  const [verifiedOnly, setVerifiedOnly] = useState(false);
  const [sortByDistance, setSortByDistance] = useState(false);

  // AUTH MODAL STATE
  const [isAuthModalOpen, setIsAuthModalOpen] = useState(false);

  // --- INITIALIZE USER LOCATION ---
  useEffect(() => {
    if (currentUser?.raw?.user_metadata?.latitude) {
      setUserLocation({
        lat: parseFloat(currentUser.raw.user_metadata.latitude),
        lon: parseFloat(currentUser.raw.user_metadata.longitude)
      });
    } else if ('geolocation' in navigator) {
      navigator.geolocation.getCurrentPosition((pos) => {
        setUserLocation({ lat: pos.coords.latitude, lon: pos.coords.longitude });
      }, () => {
        console.warn("Location access denied or unavailable.");
      });
    }
  }, [currentUser]);

  // --- DATABASE FETCHERS ---
  const fetchPartnersPage = async (pageIndex: number) => {
    const limit = 10;
    let query = supabase
      .from('profiles')
      .select('id, company, first_name, last_name, location, latitude, longitude, business_type, primary_service, avatar_url, cover_url, is_verified')
      .order('is_verified', { ascending: false })
      .range(pageIndex * limit, (pageIndex + 1) * limit - 1);

    if (currentUser) query = query.neq('id', currentUser.id);

    const { data, error } = await query;
    if (error) console.error(error);
    return data || [];
  };

  useEffect(() => {
    const fetchInitialData = async () => {
      setIsLoadingPartners(true);

      try {
        if (currentUser) {
          const { data: followsData } = await supabase.from('follows').select('following_id').eq('follower_id', currentUser.id);
          if (followsData) setFollowingIds(followsData.map(f => f.following_id));
        }

        const { data: catData } = await supabase.from('profiles').select('business_type').not('business_type', 'is', null).limit(200);
        if (catData) {
          const counts: Record<string, number> = {};
          catData.forEach(d => {
            const type = d.business_type.toLowerCase();
            counts[type] = (counts[type] || 0) + 1;
          });
          const sortedCats = Object.entries(counts)
            .sort((a, b) => b[1] - a[1])
            .slice(0, 4)
            .map(e => ({ type: e[0], count: e[1] }));
          setDynamicCategories(sortedCats);
        }

        const initialPartners = await fetchPartnersPage(0);
        setPopularPartners(initialPartners);
        if (initialPartners.length < 10) setHasMore(false);

      } catch (error) {
        console.error("Error loading network data:", error);
      } finally {
        setIsLoadingPartners(false);
      }
    };

    fetchInitialData();
  }, [currentUser]);

  // --- LOAD MORE PAGINATION ---
  const handleLoadMore = async () => {
    setIsLoadingMore(true);
    const nextPage = page + 1;
    const newPartners = await fetchPartnersPage(nextPage);
    
    if (newPartners.length < 10) setHasMore(false);
    setPopularPartners(prev => [...prev, ...newPartners]);
    setPage(nextPage);
    setIsLoadingMore(false);
  };

  // --- LIVE SEARCH LOGIC ---
  useEffect(() => {
    const performSearch = async () => {
      if (!searchQuery.trim()) {
        setSearchResults([]);
        setIsSearching(false);
        return;
      }
      setIsSearching(true);
      try {
        let query = supabase
          .from('profiles')
          .select('id, company, first_name, last_name, business_type, location, latitude, longitude, avatar_url, is_verified')
          .or(`company.ilike.%${searchQuery}%,first_name.ilike.%${searchQuery}%,last_name.ilike.%${searchQuery}%,business_type.ilike.%${searchQuery}%`)
          .limit(15);

        if (currentUser) query = query.neq('id', currentUser.id);

        const { data, error } = await query;
        if (error) throw error;
        setSearchResults(data || []);
      } catch (error) {
        console.error('Error searching profiles:', error);
      } finally {
        setIsSearching(false);
      }
    };

    const delayDebounceFn = setTimeout(() => performSearch(), 400);
    return () => clearTimeout(delayDebounceFn);
  }, [searchQuery, currentUser]);

  // --- ACTION HANDLERS ---
  const handleFollow = async (e: React.MouseEvent, targetId: string) => {
    e.stopPropagation(); 
    if (!currentUser) return setIsAuthModalOpen(true);

    const isCurrentlyFollowing = followingIds.includes(targetId);
    setFollowingIds(prev => isCurrentlyFollowing ? prev.filter(id => id !== targetId) : [...prev, targetId]);

    try {
      if (isCurrentlyFollowing) {
        await supabase.from('follows').delete().eq('follower_id', currentUser.id).eq('following_id', targetId);
      } else {
        await supabase.from('follows').insert({ follower_id: currentUser.id, following_id: targetId });
        await supabase.from('notifications').insert({ user_id: targetId, actor_id: currentUser.id, type: 'follow' });
      }
    } catch (error) {
      console.error("Follow action failed:", error);
      setFollowingIds(prev => isCurrentlyFollowing ? [...prev, targetId] : prev.filter(id => id !== targetId));
    }
  };

  const handleMessage = (e: React.MouseEvent, targetId: string) => {
    e.stopPropagation();
    if (!currentUser) return setIsAuthModalOpen(true);
    navigate(`/messages?user=${targetId}`);
  };

  const handleCategoryClick = (term: string) => {
    setSearchQuery(searchQuery === term ? '' : term);
  };

  // --- FILTER & SORT LOGIC ---
  const applyFiltersAndSort = (array: any[]) => {
    let result = [...array];
    if (verifiedOnly) result = result.filter(p => p.is_verified);
    
    if (sortByDistance && userLocation) {
      result.sort((a, b) => {
        const distA = a.latitude && a.longitude ? calculateDistance(userLocation.lat, userLocation.lon, parseFloat(a.latitude), parseFloat(a.longitude)) : Infinity;
        const distB = b.latitude && b.longitude ? calculateDistance(userLocation.lat, userLocation.lon, parseFloat(b.latitude), parseFloat(b.longitude)) : Infinity;
        return distA - distB;
      });
    }
    return result;
  };

  const displayedSearchResults = applyFiltersAndSort(searchResults);
  const displayedPopularPartners = applyFiltersAndSort(popularPartners);

  // --- RENDER HELPERS ---
  const renderDistanceLabel = (lat?: string, lon?: string) => {
    if (!userLocation || !lat || !lon) return null;
    const distance = calculateDistance(userLocation.lat, userLocation.lon, parseFloat(lat), parseFloat(lon));
    return (
      <span className="text-[10px] font-black text-[#1da1f2] bg-blue-50 px-1.5 py-0.5 rounded shrink-0">
        {distance < 1 ? '< 1 km' : `${Math.round(distance)} km`}
      </span>
    );
  };

  return (
    <div className="space-y-8 pb-32 animate-in fade-in duration-500 font-sans select-none bg-[#e0e5ec] min-h-screen overflow-hidden">
      
      {/* HEADER & SEARCH */}
      <div className="pt-6 px-4">
        <h1 className="text-[28px] font-black text-slate-900 leading-tight tracking-tight mb-6">
          Discover <br/> verified partners
        </h1>

        <div className="bg-white/80 backdrop-blur-md rounded-full p-1.5 shadow-[0_4px_15px_rgba(163,177,198,0.2)] border border-white flex items-center relative z-50">
          <div className="pl-4 pr-2 text-slate-400 shrink-0">
            {isSearching ? <Loader2 size={18} className="animate-spin text-[#1da1f2]" /> : <Search size={18} strokeWidth={2.5} />}
          </div>
          <input 
            type="text" 
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search companies, names, or categories..." 
            className="flex-1 bg-transparent text-sm font-semibold text-slate-800 placeholder:text-slate-400 py-2.5 focus:outline-none min-w-0"
          />
          {searchQuery && (
            <button onClick={() => setSearchQuery('')} className="p-2 text-slate-400 hover:text-rose-500 transition-colors shrink-0">
              <X size={16} />
            </button>
          )}
          
          {/* FUNCTIONAL FILTER MENU */}
          <div className="relative shrink-0">
            <button 
              onClick={() => setShowFilters(!showFilters)} 
              className={`p-2.5 rounded-full transition-colors ml-1 mr-0.5 ${
                showFilters || verifiedOnly || sortByDistance
                  ? 'bg-[#1da1f2] text-white shadow-inner' 
                  : 'bg-slate-50 text-slate-600 hover:bg-slate-100'
              }`}
            >
              <SlidersHorizontal size={16} strokeWidth={2.5} />
            </button>
            
            {showFilters && (
              <div className="absolute right-0 top-full mt-3 w-56 bg-white rounded-2xl shadow-xl border border-slate-100 p-2 z-50 animate-in fade-in slide-in-from-top-2">
                <button 
                  onClick={() => { setVerifiedOnly(false); setSortByDistance(false); setShowFilters(false); }}
                  className={`w-full text-left px-4 py-2.5 text-sm font-bold rounded-xl transition-colors ${!verifiedOnly && !sortByDistance ? 'bg-blue-50 text-[#1da1f2]' : 'text-slate-600 hover:bg-slate-50'}`}
                >
                  All Partners
                </button>
                <div className="h-px bg-slate-100 my-1 mx-2" />
                <button 
                  onClick={() => { setVerifiedOnly(!verifiedOnly); setShowFilters(false); }}
                  className={`w-full text-left px-4 py-2.5 text-sm font-bold rounded-xl transition-colors flex items-center justify-between ${verifiedOnly ? 'bg-blue-50 text-[#1da1f2]' : 'text-slate-600 hover:bg-slate-50'}`}
                >
                  Verified Only <ShieldCheck size={14} className={verifiedOnly ? "text-[#1da1f2]" : "text-teal-500"} />
                </button>
                <button 
                  onClick={() => {
                    if (!userLocation) return alert("Location access is required to sort by distance.");
                    setSortByDistance(!sortByDistance); 
                    setShowFilters(false); 
                  }}
                  className={`w-full text-left px-4 py-2.5 text-sm font-bold rounded-xl transition-colors mt-1 flex items-center justify-between ${sortByDistance ? 'bg-blue-50 text-[#1da1f2]' : 'text-slate-600 hover:bg-slate-50'}`}
                >
                  Sort by Distance <MapPin size={14} className={sortByDistance ? "text-[#1da1f2]" : "text-rose-500"} />
                </button>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* DYNAMIC CONTENT AREA */}
      {searchQuery.trim().length > 0 ? (
        
        /* SEARCH RESULTS */
        <div className="px-4 space-y-3">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-sm font-black text-slate-400 uppercase tracking-widest">Search Results</h2>
            <div className="flex gap-2">
              {verifiedOnly && <span className="text-[10px] font-bold text-teal-600 bg-teal-50 px-2 py-1 rounded-md uppercase">Verified Only</span>}
              {sortByDistance && <span className="text-[10px] font-bold text-blue-600 bg-blue-50 px-2 py-1 rounded-md uppercase">Nearest First</span>}
            </div>
          </div>
          
          {displayedSearchResults.length > 0 ? displayedSearchResults.map((profile) => (
            <div 
              key={profile.id}
              onClick={() => navigate(`/profile/${profile.id}`)}
              className="bg-slate-50 border border-slate-200 p-4 rounded-3xl flex items-center gap-4 cursor-pointer hover:bg-white hover:-translate-y-0.5 hover:shadow-md transition-all"
            >
              <div className="w-12 h-12 rounded-full bg-slate-200 overflow-hidden flex items-center justify-center shrink-0">
                {profile.avatar_url ? <img src={profile.avatar_url} className="w-full h-full object-cover" /> : <UserIcon size={20} className="text-slate-400" />}
              </div>
              <div className="flex-1 min-w-0">
                <h3 className="text-[15px] font-black text-slate-800 truncate flex items-center gap-1.5">
                  {profile.company || `${profile.first_name || ''} ${profile.last_name || ''}`.trim() || 'User'}
                  {profile.is_verified && <ShieldCheck size={14} className="text-[#1da1f2]" strokeWidth={3} />}
                </h3>
                <div className="flex items-center gap-2 mt-0.5">
                  <p className="text-[11px] font-bold text-slate-500 truncate capitalize">{profile.business_type?.replace('_', ' ') || 'Partner'}</p>
                  {renderDistanceLabel(profile.latitude, profile.longitude)}
                </div>
              </div>
              
              <div className="flex gap-2 shrink-0">
                <button onClick={(e) => handleMessage(e, profile.id)} className="p-2.5 rounded-2xl bg-white border border-slate-200 text-slate-500 hover:text-indigo-500 hover:border-indigo-200 transition-all">
                  <MessageSquare size={18} />
                </button>
                <button 
                  onClick={(e) => handleFollow(e, profile.id)}
                  className={`p-2.5 rounded-2xl transition-all ${
                    followingIds.includes(profile.id) 
                      ? 'bg-[#1da1f2] text-white border border-[#1da1f2]' 
                      : 'bg-white border border-slate-200 text-slate-500 hover:text-[#1da1f2] hover:border-[#1da1f2]/30'
                  }`}
                >
                  {followingIds.includes(profile.id) ? <UserCheck size={18} /> : <UserPlus size={18} />}
                </button>
              </div>
            </div>
          )) : (
            <div className="text-center py-10 text-slate-400 font-bold text-sm bg-white/40 border border-white rounded-[2rem] mx-4">
              No partners found matching your search.
            </div>
          )}
        </div>

      ) : (
        
        /* DEFAULT DISCOVERY VIEW */
        <>
          <div className="relative z-10 px-4">
            <h2 className="text-lg font-black text-slate-900 mb-5 tracking-tight">Trending categories</h2>
            <div className="flex items-center overflow-x-auto scrollbar-hide gap-5 pb-2 -mx-4 px-4">
              {dynamicCategories.length > 0 ? (
                dynamicCategories.map((cat) => (
                  <ServiceIcon 
                    key={cat.type}
                    isActive={searchQuery === cat.type} 
                    icon={getCategoryIcon(cat.type)} 
                    label={cat.type.replace('_', ' ')} 
                    onClick={() => handleCategoryClick(cat.type)} 
                  />
                ))
              ) : (
                <div className="w-full flex justify-center py-4 text-slate-400"><Loader2 size={24} className="animate-spin"/></div>
              )}
            </div>
          </div>

          <div className="mt-8">
            <div className="flex items-center justify-between px-4 mb-4">
              <h2 className="text-lg font-black text-slate-900 tracking-tight">Popular partners</h2>
              <div className="flex gap-2">
                {verifiedOnly && <span className="text-[10px] font-bold text-teal-600 bg-teal-50 px-2 py-1 rounded-md uppercase">Verified Only</span>}
                {sortByDistance && <span className="text-[10px] font-bold text-blue-600 bg-blue-50 px-2 py-1 rounded-md uppercase">Nearest</span>}
              </div>
            </div>
            
            {isLoadingPartners ? (
              <div className="flex gap-5 overflow-x-auto scrollbar-hide pb-6 px-4">
                {[1, 2, 3].map(i => (
                  <div key={i} className="min-w-[280px] max-w-[280px] h-[320px] bg-white/40 border border-white rounded-[2rem] animate-pulse shrink-0" />
                ))}
              </div>
            ) : displayedPopularPartners.length > 0 ? (
              <div className="flex flex-col gap-6">
                <div className="flex gap-5 overflow-x-auto scrollbar-hide pb-4 px-4 snap-x">
                  {displayedPopularPartners.map((partner) => {
                    const displayName = partner.company || `${partner.first_name || ''} ${partner.last_name || ''}`.trim() || 'TeamUp Partner';
                    
                    return (
                      <div 
                        key={partner.id} 
                        onClick={() => navigate(`/profile/${partner.id}`)}
                        className="bg-slate-50 border border-slate-200 rounded-[2rem] p-3 min-w-[280px] max-w-[280px] shrink-0 snap-start cursor-pointer group hover:-translate-y-1 hover:shadow-md transition-all flex flex-col"
                      >
                        {/* Cover Image */}
                        <div className="relative w-full aspect-[4/3] rounded-[1.5rem] overflow-hidden mb-4 bg-slate-800 shrink-0">
                          {partner.cover_url ? (
                            <img src={partner.cover_url} className="w-full h-full object-cover" />
                          ) : (
                            <div className="w-full h-full bg-gradient-to-br from-slate-700 to-slate-900 flex items-center justify-center">
                              <span className="text-white/20 text-4xl font-black">TEAMUP</span>
                            </div>
                          )}
                          
                          <div className="absolute top-3 right-3 flex gap-2">
                            <button onClick={(e) => handleMessage(e, partner.id)} className="p-2.5 rounded-xl bg-white/80 backdrop-blur-md text-slate-800 hover:bg-white hover:text-indigo-500 transition-all shadow-lg border border-white/20 z-10">
                              <MessageSquare size={16} />
                            </button>
                            <button 
                              onClick={(e) => handleFollow(e, partner.id)}
                              className={`p-2.5 rounded-xl backdrop-blur-md transition-all shadow-lg z-10 ${
                                followingIds.includes(partner.id)
                                  ? 'bg-[#1da1f2] text-white border border-[#1da1f2]'
                                  : 'bg-white/80 text-slate-800 hover:bg-white border border-white/20'
                              }`}
                            >
                              {followingIds.includes(partner.id) ? <UserCheck size={16} /> : <UserPlus size={16} />}
                            </button>
                          </div>
                        </div>

                        {/* Partner Details */}
                        <div className="px-1.5 pb-1 space-y-3 flex-1 flex flex-col">
                          <div className="flex items-center gap-2 mb-1">
                              <div className="w-8 h-8 rounded-full overflow-hidden bg-slate-200 border border-slate-200 shrink-0">
                                {partner.avatar_url ? (
                                  <img src={partner.avatar_url} className="w-full h-full object-cover" />
                                ) : (
                                  <img src={`https://ui-avatars.com/api/?name=${encodeURIComponent(displayName)}&background=1da1f2&color=fff`} className="w-full h-full object-cover" />
                                )}
                              </div>
                              <div className="flex-1 min-w-0">
                                <h3 className="text-[15px] font-black text-slate-900 truncate leading-tight flex items-center gap-1">
                                  {displayName}
                                  {partner.is_verified && <ShieldCheck size={12} className="text-[#1da1f2] shrink-0" />}
                                </h3>
                                <div className="flex items-center gap-1.5 text-xs text-slate-500 font-bold truncate mt-0.5">
                                  <MapPin size={11} strokeWidth={2.5} className="shrink-0" /> 
                                  <span className="truncate">{partner.location || 'Location missing'}</span>
                                  {renderDistanceLabel(partner.latitude, partner.longitude)}
                                </div>
                              </div>
                          </div>
                          
                          <div className="p-3 rounded-xl bg-white border border-slate-100 space-y-0.5 mt-auto">
                             <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Primary service</p>
                             <p className="text-[13px] font-bold text-slate-800 leading-tight truncate capitalize">
                               {partner.primary_service || partner.business_type?.replace('_', ' ') || 'General Partner'}
                             </p>
                          </div>

                          <button className="w-full py-2.5 mt-1 rounded-xl bg-slate-900 hover:bg-slate-800 text-white font-bold text-xs flex items-center justify-center gap-1.5 transition-colors">
                             View Profile <ArrowRight size={14} />
                          </button>
                        </div>
                      </div>
                    );
                  })}
                </div>
                
                {/* INFINITE SCROLL / LOAD MORE BUTTON */}
                {hasMore && (
                  <div className="flex justify-center mt-2 mb-8 px-4">
                    <button 
                      onClick={handleLoadMore}
                      disabled={isLoadingMore}
                      className="px-6 py-3 bg-white border border-slate-200 text-slate-600 font-bold text-sm rounded-full flex items-center gap-2 hover:bg-slate-50 hover:text-[#1da1f2] transition-colors shadow-sm"
                    >
                      {isLoadingMore ? <><Loader2 size={16} className="animate-spin" /> Loading...</> : <><ChevronDown size={16} /> Load More Partners</>}
                    </button>
                  </div>
                )}
              </div>
            ) : (
              <div className="text-center py-10 text-slate-400 font-bold text-sm bg-white/40 border border-white rounded-[2rem] mx-4">
                No {verifiedOnly ? 'verified ' : ''}partners available right now.
              </div>
            )}
          </div>
        </>
      )}

      <AuthModal 
        isOpen={isAuthModalOpen} 
        onClose={() => setIsAuthModalOpen(false)} 
        message="Sign in to follow or message partners" 
      />
    </div>
  );
}

function ServiceIcon({ icon, label, isActive, onClick }: { icon: React.ReactNode, label: string, isActive: boolean, onClick: () => void }) {
  return (
    <div onClick={onClick} className="flex flex-col items-center gap-2 cursor-pointer group shrink-0 min-w-[70px]">
      <div className={`w-16 h-16 rounded-full flex items-center justify-center transition-all border ${
        isActive 
          ? 'bg-blue-50 border-blue-200 shadow-inner' 
          : 'bg-white border-slate-100 shadow-sm group-hover:shadow-md'
      }`}>
        <div className={`transition-transform ${isActive ? 'scale-110' : 'group-hover:scale-110'}`}>
          {icon}
        </div>
      </div>
      <span className={`text-[11px] font-bold capitalize transition-colors truncate w-full text-center ${isActive ? 'text-[#1da1f2]' : 'text-slate-600 group-hover:text-[#1da1f2]'}`}>
        {label}
      </span>
    </div>
  );
}