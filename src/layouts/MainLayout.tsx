import React, { useState, useEffect, useRef } from 'react';
import { Outlet, useLocation, useNavigate } from 'react-router-dom';
import { 
  Users, Calendar, MessageCircle, User as UserIcon, 
  Bookmark, Briefcase, Bell, Plus, LogOut, LayoutList, LogIn,
  TrendingUp, MessageSquare, ShieldCheck, Loader2, WifiOff, Wifi, Compass, Home as HomeIcon,
  Heart, Eye, UserPlus, Info
} from 'lucide-react';
import { useTenant } from '../contexts/TenantContext';
import { BottomNav } from '../components/BottomNav';
import { CreatePostModal } from '../components/CreatePostModal';
import { AuthModal } from '../components/AuthModal';
import { supabase } from '../lib/supabase';

// --- HELPERS ---
const timeAgo = (dateString: string) => {
  const now = new Date();
  const past = new Date(dateString);
  const diffInMinutes = Math.floor((now.getTime() - past.getTime()) / 60000);
  if (diffInMinutes < 1) return 'Just now';
  if (diffInMinutes < 60) return `${diffInMinutes} mins ago`;
  if (diffInMinutes < 1440) return `${Math.floor(diffInMinutes / 60)} hrs ago`;
  if (diffInMinutes < 2880) return 'Yesterday';
  return past.toLocaleDateString();
};

// Notification Icon & Text Mapper
const getNotificationConfig = (type: string) => {
  switch (type?.toLowerCase()) {
    case 'like': return { icon: Heart, color: 'text-rose-500', bg: 'bg-rose-50', text: 'liked your post.' };
    case 'view': return { icon: Eye, color: 'text-blue-500', bg: 'bg-blue-50', text: 'viewed your profile.' };
    case 'follow': return { icon: UserPlus, color: 'text-teal-500', bg: 'bg-teal-50', text: 'started following you.' };
    case 'message': return { icon: MessageSquare, color: 'text-indigo-500', bg: 'bg-indigo-50', text: 'sent you a new message.' };
    case 'booking': return { icon: Calendar, color: 'text-amber-500', bg: 'bg-amber-50', text: 'requested a new booking.' };
    default: return { icon: Info, color: 'text-slate-500', bg: 'bg-slate-100', text: 'interacted with your profile.' };
  }
};

interface SuggestedTeam { id: string; name: string; type: string; avatarUrl: string; isVerified: boolean; }
interface TrendingPost { id: string; title: string; authorName: string; engagement: string; isEvent: boolean; }

const MainLayout: React.FC = () => {
  const { user, initializing: contextInitializing } = useTenant();
  const location = useLocation();
  const navigate = useNavigate();
  
  const [isPostModalOpen, setIsPostModalOpen] = useState(false);
  const [authModalConfig, setAuthModalConfig] = useState({ isOpen: false, message: '' });
  const [hideBottomNav, setHideBottomNav] = useState(false);
  
  const userRole = user?.role || 'tourist';
  
  const [unreadCount, setUnreadCount] = useState(0);
  const [isRecapOpen, setIsRecapOpen] = useState(false);
  const [popoverNotifs, setPopoverNotifs] = useState<any[]>([]); 
  const recapRef = useRef<HTMLDivElement>(null);

  const [isOffline, setIsOffline] = useState(!navigator.onLine);
  const [isRestored, setIsRestored] = useState(false);

  const [isDashboardLoaded, setIsDashboardLoaded] = useState(false);
  const isAppLoading = contextInitializing || (!!user && !isDashboardLoaded);

  const [suggestedTeams, setSuggestedTeams] = useState<SuggestedTeam[]>([]);
  const [trendingPosts, setTrendingPosts] = useState<TrendingPost[]>([]);

  const isHomePage = location.pathname === '/explore' || location.pathname === '/';
  const showMobileContextNav = ['/network', '/messages', '/bookings', '/groups'].includes(location.pathname);
  const isMessagesActive = location.pathname.startsWith('/messages');
  const hideRightSidebar = isHomePage || showMobileContextNav;

  useEffect(() => {
    const handleOffline = () => { setIsOffline(true); setIsRestored(false); };
    const handleOnline = () => {
      setIsOffline(false); setIsRestored(true);
      setTimeout(() => setIsRestored(false), 4000);
    };
    window.addEventListener('offline', handleOffline);
    window.addEventListener('online', handleOnline);
    return () => {
      window.removeEventListener('offline', handleOffline);
      window.removeEventListener('online', handleOnline);
    };
  }, []);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (recapRef.current && !recapRef.current.contains(event.target as Node)) setIsRecapOpen(false);
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const handleProtectedNavigation = (path: string, featureName: string) => {
    if (!user) {
      setAuthModalConfig({ isOpen: true, message: `Sign in to access ${featureName}` });
      return;
    }
    navigate(path);
  };

  const handleLogout = async () => {
    await supabase.auth.signOut();
    navigate('/explore');
  };

  const handleMarkAllRead = async () => {
    if (!user || !user.id) return;
    setUnreadCount(0); 
    setPopoverNotifs(prev => prev.map(n => ({ ...n, read: true }))); 
    await supabase.from('notifications').update({ read: true }).eq('user_id', user.id).eq('read', false);
  };

  // ==========================================
  // LIVE DASHBOARD DATA FETCHER
  // ==========================================
  useEffect(() => {
    if (!user || !user.id) {
      setIsDashboardLoaded(true);
      return;
    }

    const fetchLatestNotifs = async () => {
      const { data } = await supabase
        .from('notifications')
        .select('*, actor:profiles(id, company, first_name, last_name, avatar_url)')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false })
        .limit(6);

      if (data) {
        setPopoverNotifs(data.map((n: any) => {
          const actorInfo = Array.isArray(n.actor) ? n.actor[0] : n.actor;
          const config = getNotificationConfig(n.type);
          
          return {
            ...n,
            actorName: actorInfo?.company || `${actorInfo?.first_name || ''} ${actorInfo?.last_name || ''}`.trim() || 'Someone',
            actorAvatar: actorInfo?.avatar_url,
            message: n.message || config.text,
            config: config
          };
        }));
      }
    };

    const initializeDashboardData = async () => {
      try {
        if (userRole !== 'tourist' && !user.company && location.pathname !== '/onboarding') {
          setIsDashboardLoaded(true);
          navigate('/onboarding', { replace: true });
          return; 
        }

        let userLat = (user as any).raw?.user_metadata?.latitude || 5.6037;
        let userLon = (user as any).raw?.user_metadata?.longitude || -0.1870;

        const { count } = await supabase.from('notifications').select('*', { count: 'exact', head: true }).eq('user_id', user.id).eq('read', false);
        setUnreadCount(count || 0);
        await fetchLatestNotifs();

        // 1. Fetch Suggested Teams
        const { data: suggestedData } = await supabase.rpc('discover_partners', {
          user_lat: userLat, user_lon: userLon, max_distance_km: 100
        });
        
        let filteredTeams = suggestedData ? suggestedData.filter((t: any) => t.id !== user.id).slice(0, 4) : [];
        
        // Fallback: If no nearby partners, fetch global verified partners
        if (filteredTeams.length === 0) {
          const { data: fallbackData } = await supabase.from('profiles').select('id, company, business_type, avatar_url, is_verified').neq('id', user.id).order('is_verified', { ascending: false }).limit(4);
          if (fallbackData) filteredTeams = fallbackData;
        }

        setSuggestedTeams(filteredTeams.map((t: any) => ({
          id: t.id,
          name: t.company || 'Network Partner',
          type: t.business_type?.replace('_', ' ') || 'General Partner',
          avatarUrl: t.avatar_url || `https://ui-avatars.com/api/?name=${encodeURIComponent(t.company || 'Partner')}&background=1da1f2&color=fff`,
          isVerified: t.is_verified || false
        })));

        // 2. Fetch Real Trending Posts
        const { data: postsData } = await supabase
          .from('posts')
          .select('id, content, is_event, title, created_at, author:profiles(company, first_name, last_name, is_verified)')
          .order('created_at', { ascending: false })
          .limit(4);

        if (postsData) {
          setTrendingPosts(postsData.map((p: any) => {
            const authorInfo = Array.isArray(p.author) ? p.author[0] : p.author;
            const authorName = authorInfo?.company || `${authorInfo?.first_name || ''} ${authorInfo?.last_name || ''}`.trim() || 'Partner';
            
            // Format Title smartly
            let displayTitle = p.content || 'Media Update';
            if (p.is_event && p.title) displayTitle = p.title;
            if (displayTitle.length > 45) displayTitle = displayTitle.substring(0, 45) + '...';

            return {
              id: p.id,
              title: displayTitle,
              authorName: authorName,
              engagement: p.is_event ? 'Upcoming Event' : 'Trending',
              isEvent: p.is_event
            };
          }));
        }

      } catch (err) {
        console.error("Error initializing dashboard:", err);
      } finally {
        setIsDashboardLoaded(true);
      }
    };

    initializeDashboardData();

    // LIVE SUBSCRIPTION TO NOTIFICATIONS
    const notificationSubscription = supabase
      .channel('realtime_notifications')
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'notifications', filter: `user_id=eq.${user.id}` }, () => {
        setUnreadCount((prev) => prev + 1);
        fetchLatestNotifs(); 
      }).subscribe();

    return () => { supabase.removeChannel(notificationSubscription); };
  }, [user?.id]); 

  // ==========================================
  // THE ROUTE GUARD
  // ==========================================
  useEffect(() => {
    if (isAppLoading) return; 

    const path = location.pathname;
    const publicPaths = ['/explore', '/auth', '/']; 
    const isViewingSomeoneElsesProfile = path.startsWith('/profile/') && path !== '/profile' && path !== '/profile/';

    if (!user && !publicPaths.includes(path) && !isViewingSomeoneElsesProfile) {
      navigate('/explore', { replace: true });
      setAuthModalConfig({ isOpen: true, message: 'Sign in to access this page' });
      return;
    }

    if (user && userRole === 'tourist') {
      const vendorTools = ['/feeds', '/network', '/groups'];
      const isTryingToAccessVendorTools = vendorTools.some(r => path.startsWith(r));
      const isTryingToEditProfileDash = path === '/profile' || path === '/profile/';

      if (isTryingToAccessVendorTools || isTryingToEditProfileDash) {
        navigate('/explore', { replace: true }); 
      }
    }
  }, [location.pathname, user, userRole, isAppLoading, navigate]);

  if (isAppLoading) {
    return (
      <div className="fixed inset-0 z-[99999] bg-slate-50 flex flex-col items-center justify-center">
        <div className="flex items-center gap-3 animate-pulse mb-6">
          <div className="w-8 h-8 rounded-full bg-[#1da1f2]"></div>
          <span className="text-3xl font-black text-slate-800 tracking-tight">TeamUp<span className="text-[#1da1f2]">.</span></span>
        </div>
        <Loader2 size={32} className="animate-spin text-[#1da1f2]" />
      </div>
    );
  }

  return (
    <div className="w-full h-screen bg-slate-50 relative overflow-hidden font-sans flex flex-col">
      
      {/* --- NETWORK ALERT --- */}
      <div className={`fixed top-4 left-1/2 -translate-x-1/2 z-[99999] transition-all duration-500 pointer-events-none ${isOffline || isRestored ? 'translate-y-0 opacity-100' : '-translate-y-24 opacity-0'}`}>
        <div className={`flex items-center gap-2 px-5 py-2.5 rounded-full shadow-2xl backdrop-blur-md border ${isOffline ? 'bg-rose-500/90 border-rose-500 text-white' : 'bg-emerald-500/90 border-emerald-500 text-white'}`}>
          {isOffline ? <WifiOff size={16} className="animate-pulse" /> : <Wifi size={16} />}
          <span className="text-sm font-bold tracking-wide">
            {isOffline ? 'You are offline' : 'Back online'}
          </span>
        </div>
      </div>

      {/* --- HEADER --- */}
      <header className="w-full h-16 bg-white border-b border-slate-200 flex items-center justify-between px-4 lg:px-8 shrink-0 z-50">
        <div className="flex items-center gap-2.5 cursor-pointer" onClick={() => navigate('/explore')}>
          <div className="w-5 h-5 rounded-full bg-[#1da1f2]"></div>
          <span className="text-xl font-black text-slate-800 tracking-tight">
            TeamUp<span className="text-[#1da1f2]">.</span>
          </span>
        </div>
        
        <div className="flex items-center gap-3">
          {user && showMobileContextNav && (
            <div className="flex items-center gap-2 lg:hidden">
              {userRole !== 'tourist' && (
                <button onClick={() => handleProtectedNavigation('/network', 'Network')} className={`p-2 rounded-xl transition-all border ${location.pathname === '/network' ? 'bg-blue-50 border-blue-100 text-[#1da1f2]' : 'bg-white border-slate-200 text-slate-500 hover:text-[#1da1f2] hover:bg-slate-50'}`}><Users size={18} /></button>
              )}
              <button onClick={() => handleProtectedNavigation('/messages', 'Messages')} className={`p-2 rounded-xl transition-all border ${isMessagesActive ? 'bg-blue-50 border-blue-100 text-[#1da1f2]' : 'bg-white border-slate-200 text-slate-500 hover:text-[#1da1f2] hover:bg-slate-50'}`}><MessageCircle size={18} /></button>
              <button onClick={() => handleProtectedNavigation('/bookings', 'Bookings')} className={`p-2 rounded-xl transition-all border ${location.pathname === '/bookings' ? 'bg-blue-50 border-blue-100 text-[#1da1f2]' : 'bg-white border-slate-200 text-slate-500 hover:text-[#1da1f2] hover:bg-slate-50'}`}><Calendar size={18} /></button>
              {userRole !== 'tourist' && (
                <button onClick={() => handleProtectedNavigation('/groups', 'Groups')} className={`p-2 rounded-xl transition-all border ${location.pathname === '/groups' ? 'bg-blue-50 border-blue-100 text-[#1da1f2]' : 'bg-white border-slate-200 text-slate-500 hover:text-[#1da1f2] hover:bg-slate-50'}`}><Briefcase size={18} /></button>
              )}
            </div>
          )}

          {user && (
            <button onClick={handleLogout} title="Log Out" className="lg:hidden flex items-center justify-center p-2 rounded-xl bg-white border border-slate-200 text-slate-400 hover:text-rose-500 hover:bg-rose-50 hover:border-rose-100 transition-all">
              <LogOut size={18} />
            </button>
          )}

          {user && (
            <div className="relative hidden lg:block" ref={recapRef}>
              <button 
                onClick={() => setIsRecapOpen(!isRecapOpen)} 
                className={`relative flex items-center justify-center w-10 h-10 rounded-full border transition-all cursor-pointer ${isRecapOpen ? 'bg-blue-50 border-blue-100 text-[#1da1f2]' : 'bg-white border-slate-200 text-slate-500 hover:text-[#1da1f2] hover:bg-slate-50'}`}
              >
                <Bell size={18} />
                {unreadCount > 0 && (
                  <div className="absolute -top-1 -right-1 min-w-[18px] h-[18px] px-1 bg-rose-500 rounded-full border-2 border-white flex items-center justify-center text-[9px] font-black text-white animate-in zoom-in duration-300">
                    {unreadCount > 99 ? '99+' : unreadCount}
                  </div>
                )}
              </button>

              {isRecapOpen && (
                <div className="absolute top-full right-0 mt-3 w-80 bg-white border border-slate-200 rounded-2xl shadow-[0_10px_40px_rgba(0,0,0,0.1)] overflow-hidden z-[100] animate-in fade-in slide-in-from-top-2 duration-200">
                  <div className="p-4 border-b border-slate-100 flex justify-between items-center bg-slate-50/50">
                    <h3 className="font-black text-slate-800">Notifications</h3>
                    {unreadCount > 0 && (
                      <button onClick={handleMarkAllRead} className="text-[10px] font-bold text-[#1da1f2] hover:text-[#1a91da]">Mark all read</button>
                    )}
                  </div>
                  
                  <div className="max-h-[350px] overflow-y-auto custom-scrollbar p-2 space-y-1">
                    {popoverNotifs.length > 0 ? (
                      popoverNotifs.map((notif) => {
                        const Icon = notif.config.icon;
                        return (
                          <div 
                            key={notif.id} 
                            onClick={() => { 
                              setIsRecapOpen(false); 
                              if (notif.type === 'message') navigate('/messages');
                              else if (notif.type === 'booking') navigate('/bookings');
                              else if (notif.actor_id) navigate(`/profile/${notif.actor_id}`);
                              else navigate('/recap');
                            }} 
                            className={`p-3 rounded-xl cursor-pointer transition-colors flex gap-3 ${notif.read ? 'hover:bg-slate-50' : 'bg-blue-50/50 hover:bg-blue-50'}`}
                          >
                            <div className="relative shrink-0">
                              <div className="w-10 h-10 rounded-full overflow-hidden bg-slate-200 flex items-center justify-center">
                                {notif.actorAvatar ? (
                                  <img src={notif.actorAvatar} className="w-full h-full object-cover"/>
                                ) : (
                                  <UserIcon size={16} className="text-slate-400" />
                                )}
                              </div>
                              <div className={`absolute -bottom-1 -right-1 w-5 h-5 rounded-full border-2 border-white flex items-center justify-center ${notif.config.bg} ${notif.config.color}`}>
                                <Icon size={10} strokeWidth={3} />
                              </div>
                            </div>
                            <div className="flex-1 min-w-0">
                              <p className="text-xs text-slate-700 leading-snug truncate pr-2">
                                <span className="font-bold text-slate-900">{notif.actorName}</span> {notif.message}
                              </p>
                              <p className="text-[9px] text-slate-400 font-semibold mt-1 uppercase tracking-wider">{timeAgo(notif.created_at)}</p>
                            </div>
                            {!notif.read && <div className="w-2 h-2 rounded-full bg-[#1da1f2] shrink-0 mt-1.5 animate-pulse" />}
                          </div>
                        )
                      })
                    ) : (
                      <div className="p-8 text-center flex flex-col items-center">
                        <div className="w-12 h-12 rounded-full bg-slate-100 flex items-center justify-center text-slate-300 mb-3">
                          <Bell size={20} />
                        </div>
                        <p className="text-sm font-bold text-slate-800">You're all caught up!</p>
                        <p className="text-xs text-slate-500 mt-1">Check back later for new alerts.</p>
                      </div>
                    )}
                    <button 
                      onClick={() => { setIsRecapOpen(false); navigate('/recap'); }} 
                      className="w-full py-2.5 text-center text-xs font-bold text-slate-500 hover:text-[#1da1f2] hover:bg-blue-50 rounded-lg transition-colors mt-2"
                    >
                      View all history
                    </button>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      </header>

      {/* --- MAIN LAYOUT GRID --- */}
      <div className="flex-1 w-full max-w-[1400px] mx-auto px-4 overflow-hidden relative">
        <div className="grid grid-cols-1 md:grid-cols-12 gap-6 lg:gap-8 h-full relative">
          
          {/* LEFT SIDEBAR */}
          <div className="hidden lg:flex lg:flex-col lg:col-span-3 h-full overflow-y-auto scrollbar-hide py-6 pr-2">
            <div className="flex-1 space-y-6">
              
              {user ? (
                <div onClick={() => userRole !== 'tourist' && navigate('/profile')} className={`flex items-center gap-4 p-4 rounded-3xl bg-white border border-slate-200 ${userRole !== 'tourist' ? 'cursor-pointer hover:bg-slate-50' : ''} transition-all group shadow-sm`}>
                  <div className="w-12 h-12 shrink-0 rounded-full overflow-hidden bg-slate-100 flex items-center justify-center border-2 border-white shadow-sm">
                    {user.avatarUrl ? <img src={user.avatarUrl} className="w-full h-full object-cover" alt="Profile" /> : <UserIcon size={24} className="text-slate-400" />}
                  </div>
                  <div className="overflow-hidden flex-1">
                    <h3 className="text-sm font-black text-slate-800 truncate">{user.fullName || 'User'}</h3>
                    {userRole === 'tourist' ? (
                      <p className="text-[9px] font-bold text-blue-500 uppercase tracking-widest flex items-center gap-1 mt-0.5">
                        <Compass size={10} /> Explorer
                      </p>
                    ) : (
                      <p className="text-[9px] font-bold text-teal-600 uppercase tracking-widest flex items-center gap-1 mt-0.5">
                        <span className="w-1.5 h-1.5 rounded-full bg-green-500 animate-pulse"></span> Verified Partner
                      </p>
                    )}
                  </div>
                </div>
              ) : !contextInitializing ? (
                <div className="p-5 rounded-3xl bg-white border border-slate-200 text-center shadow-sm">
                  <h3 className="text-sm font-black text-slate-800 mb-1">Welcome to TeamUp</h3>
                  <p className="text-xs text-slate-500 mb-4">Discover global tourism partners.</p>
                  <button onClick={() => setAuthModalConfig({ isOpen: true, message: 'Sign in to your account' })} className="w-full flex items-center justify-center gap-2 py-3 bg-[#1da1f2] text-white rounded-xl font-bold text-xs hover:bg-[#1a91da] shadow-md transition-all active:scale-95">
                    <LogIn size={14} /> Log In / Sign Up
                  </button>
                </div>
              ) : null}

              <div>
                <ul className="space-y-1">
                  <SidebarItem icon={<HomeIcon size={18} />} label="Explore" active={location.pathname === '/explore'} onClick={() => navigate('/explore')} />
                  
                  {userRole !== 'tourist' && (
                    <>
                      <SidebarItem icon={<LayoutList size={18} />} label="Live Feeds" active={location.pathname === '/feeds'} onClick={() => navigate('/feeds')} />
                      <SidebarItem icon={<Users size={18} />} label="Partner Network" active={location.pathname === '/network'} onClick={() => navigate('/network')} />
                    </>
                  )}
                  
                  <SidebarItem icon={<MessageCircle size={18} />} label="Messages" active={location.pathname.startsWith('/messages')} onClick={() => handleProtectedNavigation('/messages', 'Messages')} />
                  <SidebarItem icon={<Calendar size={18} />} label="Bookings" active={location.pathname === '/bookings'} onClick={() => handleProtectedNavigation('/bookings', 'Bookings')} />
                  
                  {userRole !== 'tourist' && (
                    <SidebarItem icon={<UserIcon size={18} />} label="My Business Profile" active={location.pathname === '/profile'} onClick={() => navigate('/profile')} />
                  )}
                </ul>
              </div>

              <div className="pt-6 border-t border-slate-200">
                <ul className="space-y-1">
                  <SidebarItem icon={<Bookmark size={18} />} label="Saved Places" active={location.pathname === '/saved'} onClick={() => handleProtectedNavigation('/saved', 'Saved Places')} />
                  {userRole !== 'tourist' && (
                    <SidebarItem icon={<Briefcase size={18} />} label="B2B Groups" active={location.pathname === '/groups'} onClick={() => navigate('/groups')} />
                  )}
                </ul>
              </div>
            </div>

            {user && (
              <div className="pt-4 mt-auto border-t border-slate-200 pb-4">
                <button onClick={handleLogout} className="w-full flex items-center gap-4 p-3 rounded-xl transition-all font-semibold cursor-pointer group text-slate-500 hover:text-rose-500 hover:bg-rose-50">
                  <span className="text-slate-400 group-hover:text-rose-500 transition-colors"><LogOut size={18} /></span>
                  <span className="text-[13px]">Log Out</span>
                </button>
              </div>
            )}
          </div>

          {/* MIDDLE CONTENT (OUTLET) */}
          <div className={`col-span-1 md:col-span-12 ${hideRightSidebar ? 'lg:col-span-9' : 'lg:col-span-6 xl:col-span-6'} h-full overflow-y-auto scrollbar-hide py-6 pb-32 lg:pb-6 transition-all duration-300`}>
            <Outlet context={{ setHideBottomNav }} />
          </div>

          {/* RIGHT SIDEBAR */}
          {!hideRightSidebar && user && (
            <div className="hidden lg:flex flex-col lg:col-span-3 xl:col-span-3 h-full overflow-y-auto scrollbar-hide py-6 space-y-6 pl-2 pr-1 animate-in fade-in duration-300 relative z-10">
              
              {userRole !== 'tourist' && (
                <>
                  <button onClick={() => setIsPostModalOpen(true)} className="w-full py-4 bg-[#1da1f2] text-white rounded-2xl font-black text-sm flex items-center justify-center gap-2 shadow-md hover:bg-[#1a91da] transition-all active:scale-95 shrink-0">
                    <Plus size={18} strokeWidth={3} /> Post an Update
                  </button>

                  <div className="bg-white border border-slate-200 rounded-3xl p-5 shadow-sm shrink-0">
                    <h3 className="text-xs font-black text-slate-400 uppercase tracking-widest flex items-center gap-2 mb-4">
                      <Users size={14} className="text-teal-500" /> Teams you may know
                    </h3>
                    <div className="space-y-4">
                      {suggestedTeams.map((team) => (
                        <div key={team.id} className="flex items-center justify-between group">
                          <div className="flex items-center gap-3 min-w-0 cursor-pointer flex-1 pr-2" onClick={() => navigate(`/profile/${team.id}`)}>
                            <div className="w-10 h-10 rounded-full bg-slate-100 border border-slate-200 overflow-hidden shrink-0">
                              <img src={team.avatarUrl} alt={team.name} className="w-full h-full object-cover" />
                            </div>
                            <div className="min-w-0">
                              <h4 className="text-xs font-bold text-slate-900 truncate group-hover:text-[#1da1f2] transition-colors flex items-center gap-1">
                                {team.name} {team.isVerified && <ShieldCheck size={10} className="text-[#1da1f2] shrink-0" />}
                              </h4>
                              <p className="text-[10px] font-semibold text-slate-400 truncate capitalize">{team.type}</p>
                            </div>
                          </div>
                          <div className="flex gap-1 shrink-0">
                            <button onClick={() => navigate(`/messages?user=${team.id}`)} className="p-1.5 text-slate-400 hover:text-[#1da1f2] hover:bg-blue-50 rounded-full transition-colors bg-slate-50 border border-slate-100 shadow-sm" title="Message">
                              <MessageSquare size={14} />
                            </button>
                          </div>
                        </div>
                      ))}
                      {suggestedTeams.length === 0 && <p className="text-xs font-semibold text-slate-400">Discovering partners...</p>}
                    </div>
                  </div>
                </>
              )}

              <div className="bg-white border border-slate-200 rounded-3xl p-5 shadow-sm shrink-0">
                <h3 className="text-xs font-black text-slate-400 uppercase tracking-widest flex items-center gap-2 mb-4">
                  <TrendingUp size={14} className="text-rose-500" /> Trending Now
                </h3>
                <div className="space-y-4">
                  {trendingPosts.map((post, idx) => (
                    <div 
                      key={post.id} 
                      onClick={() => navigate(post.isEvent ? `/asset/${post.id}` : '/feeds')} 
                      className="cursor-pointer group flex gap-3"
                    >
                      <span className="text-xs font-black text-slate-300 w-4 text-right pt-0.5">{idx + 1}</span>
                      <div className="min-w-0">
                        <h4 className="text-xs font-bold text-slate-800 leading-tight group-hover:text-[#1da1f2] transition-colors break-words">
                          "{post.title}"
                        </h4>
                        <div className="flex items-center gap-2 mt-1">
                          <span className="text-[10px] font-semibold text-slate-500 truncate max-w-[100px]">{post.authorName}</span>
                          <span className="w-1 h-1 rounded-full bg-slate-300 shrink-0"></span>
                          <span className={`text-[10px] font-bold shrink-0 ${post.isEvent ? 'text-amber-500' : 'text-slate-400'}`}>{post.engagement}</span>
                        </div>
                      </div>
                    </div>
                  ))}
                  {trendingPosts.length === 0 && <p className="text-xs font-semibold text-slate-400">Loading trends...</p>}
                </div>
              </div>

            </div>
          )}
        </div>
      </div>

      {/* MOBILE BOTTOM NAV */}
      <div className={`md:hidden fixed bottom-0 left-0 right-0 z-[90] transition-transform duration-300 ease-in-out ${hideBottomNav ? 'translate-y-full' : 'translate-y-0'}`}>
        <BottomNav userRole={userRole} onOpenPostModal={() => user ? setIsPostModalOpen(true) : setAuthModalConfig({ isOpen: true, message: 'Sign in to post updates' })} />
      </div>
      
      <CreatePostModal isOpen={isPostModalOpen} onClose={() => setIsPostModalOpen(false)} />
      <AuthModal isOpen={authModalConfig.isOpen} onClose={() => setAuthModalConfig({ isOpen: false, message: '' })} message={authModalConfig.message} />
      
      </div>
  );
};

const SidebarItem = ({ icon, label, active, badge, onClick }: any) => (
  <li 
    onClick={onClick}
    className={`flex items-center gap-4 p-3 rounded-xl transition-all font-semibold cursor-pointer group ${
      active ? 'bg-blue-50 text-[#1da1f2] border-l-4 border-[#1da1f2]' : 'text-slate-500 hover:text-slate-800 hover:bg-slate-100'
    }`}
  >
    <span className={active ? 'text-[#1da1f2]' : 'text-slate-400 group-hover:text-[#1da1f2] transition-colors'}>{icon}</span>
    <span className="text-[13px]">{label}</span>
    {badge && <span className="ml-auto bg-rose-500 text-white text-[9px] font-black px-1.5 py-0.5 rounded-md">{badge}</span>}
  </li>
);

export default MainLayout;