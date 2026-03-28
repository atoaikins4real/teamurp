import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { 
  Bell, UserPlus, MessageCircle, AtSign, Building2,
  Calendar, ShieldAlert, CheckCheck, Loader2, ArrowLeft,
  Heart, Eye, Trash2
} from 'lucide-react';
import { supabase } from '../lib/supabase';
import { useTenant } from '../contexts/TenantContext';

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

export default function Recap() {
  const { user } = useTenant();
  const navigate = useNavigate();
  const [notifications, setNotifications] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  const fetchNotifications = async () => {
    if (!user) return;
    setIsLoading(true);

    const { data } = await supabase
      .from('notifications')
      .select('*, actor:profiles(id, company, first_name, last_name, avatar_url)')
      .eq('user_id', user.id)
      .order('created_at', { ascending: false });

    if (data) {
      const formattedNotifications = data.map((n: any) => {
        const actorInfo = Array.isArray(n.actor) ? n.actor[0] : n.actor;
        
        let messageText = n.message;
        if (!messageText) {
          switch (n.type) {
            case 'follow': messageText = 'started following you.'; break;
            case 'message': messageText = 'sent you a message.'; break;
            case 'booking': messageText = 'requested a new booking.'; break;
            case 'mention': messageText = 'mentioned you in a post.'; break;
            case 'like': messageText = 'liked your update.'; break;
            case 'view': messageText = 'visited your business profile.'; break;
            default: messageText = 'interacted with your profile.';
          }
        }

        return {
          ...n,
          actorName: actorInfo?.company || `${actorInfo?.first_name || ''} ${actorInfo?.last_name || ''}`.trim() || 'Someone',
          actorAvatar: actorInfo?.avatar_url,
          actorId: actorInfo?.id,
          message: messageText
        };
      });

      setNotifications(formattedNotifications);
    }
    setIsLoading(false);
  };

  useEffect(() => {
    fetchNotifications();

    const channel = supabase
      .channel(`recap_${user?.id}`)
      .on('postgres_changes', { 
        event: 'INSERT', 
        schema: 'public', 
        table: 'notifications',
        filter: `user_id=eq.${user?.id}` 
      }, () => {
        fetchNotifications();
      })
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, [user?.id]);

  const markAllAsRead = async () => {
    if (!user || notifications.length === 0) return;
    setNotifications(notifications.map(n => ({ ...n, read: true })));
    await supabase.from('notifications').update({ read: true }).eq('user_id', user.id).eq('read', false);
  };

  const clearAllNotifications = async () => {
    if (!user || !window.confirm("Are you sure you want to clear your notification history?")) return;
    setNotifications([]);
    await supabase.from('notifications').delete().eq('user_id', user.id);
  };

  const getIconConfig = (type: string) => {
    switch (type) {
      case 'follow': return { icon: UserPlus, color: 'text-teal-500', bg: 'bg-teal-50' };
      case 'message': return { icon: MessageCircle, color: 'text-indigo-500', bg: 'bg-indigo-50' };
      case 'mention': return { icon: AtSign, color: 'text-purple-500', bg: 'bg-purple-50' };
      case 'booking': return { icon: Calendar, color: 'text-amber-500', bg: 'bg-amber-50' };
      case 'like': return { icon: Heart, color: 'text-rose-500', bg: 'bg-rose-50' };
      case 'view': return { icon: Eye, color: 'text-blue-500', bg: 'bg-blue-50' };
      case 'alert': return { icon: ShieldAlert, color: 'text-rose-600', bg: 'bg-rose-100' };
      default: return { icon: Bell, color: 'text-slate-500', bg: 'bg-slate-100' };
    }
  };

  const handleNotificationClick = async (notif: any) => {
    if (!notif.read) {
      setNotifications(prev => prev.map(n => n.id === notif.id ? { ...n, read: true } : n));
      await supabase.from('notifications').update({ read: true }).eq('id', notif.id);
    }
    
    // SMART NAVIGATION
    if (notif.type === 'message') navigate(`/messages`);
    else if (notif.type === 'booking') navigate(`/bookings`);
    else if (notif.type === 'mention' || notif.type === 'like') navigate(`/feeds`);
    else if (notif.actorId) navigate(`/profile/${notif.actorId}`);
  };

  return (
    <div className="max-w-[800px] mx-auto pb-32 animate-in fade-in duration-500 font-sans select-none bg-[#e0e5ec] min-h-screen">
      
      {/* HEADER */}
      <div className="pt-6 px-4 mb-6">
        <div className="flex justify-between items-start">
          <div className="flex items-center gap-3">
            <button onClick={() => navigate(-1)} className="lg:hidden w-10 h-10 rounded-full bg-white/80 backdrop-blur shadow-sm flex items-center justify-center text-slate-600 active:scale-95 transition-all">
              <ArrowLeft size={20} />
            </button>
            <div>
              <h1 className="text-3xl font-black text-slate-900 tracking-tight">Daily Recap</h1>
              <p className="text-xs font-bold text-slate-500 uppercase tracking-widest mt-1">Your Activity Hub</p>
            </div>
          </div>

          <div className="flex gap-2">
            <button 
              onClick={clearAllNotifications}
              className="p-2.5 rounded-xl bg-white/50 text-slate-400 hover:text-rose-500 hover:bg-rose-50 transition-all shadow-sm"
              title="Clear all history"
            >
              <Trash2 size={18} />
            </button>
            <button 
              onClick={markAllAsRead}
              disabled={notifications.every(n => n.read)}
              className={`px-4 py-2.5 rounded-xl font-bold text-xs flex items-center gap-2 transition-all shadow-sm ${
                notifications.every(n => n.read) 
                  ? 'bg-slate-200 text-slate-400 cursor-not-allowed' 
                  : 'bg-white text-[#1da1f2] hover:bg-blue-50 active:scale-95'
              }`}
            >
              <CheckCheck size={16} /> <span className="hidden sm:inline">Mark all read</span>
            </button>
          </div>
        </div>
      </div>

      {/* NOTIFICATIONS LIST */}
      <div className="px-4">
        <div className="bg-white/40 backdrop-blur-md rounded-[2.5rem] p-2 md:p-4 border border-white/60 min-h-[60vh]">
          {isLoading ? (
            <div className="flex flex-col justify-center items-center h-64 gap-3">
              <Loader2 className="animate-spin text-[#1da1f2]" size={40} />
              <p className="text-xs font-black text-slate-400 uppercase tracking-tighter">Syncing your feed...</p>
            </div>
          ) : notifications.length > 0 ? (
            <div className="space-y-2">
              {notifications.map((notif) => {
                const { icon: Icon, color, bg } = getIconConfig(notif.type);
                
                return (
                  <div 
                    key={notif.id}
                    onClick={() => handleNotificationClick(notif)}
                    className={`flex items-start gap-4 p-5 rounded-[1.8rem] cursor-pointer transition-all border ${
                      notif.read 
                        ? 'bg-transparent border-transparent opacity-60 grayscale-[0.5]' 
                        : 'bg-white border-white shadow-sm hover:shadow-md hover:-translate-y-0.5'
                    }`}
                  >
                    <div className="relative shrink-0">
                      <div className="w-14 h-14 rounded-2xl overflow-hidden bg-slate-100 flex items-center justify-center border border-slate-200 shadow-inner">
                        {notif.actorAvatar ? (
                           <img src={notif.actorAvatar} className="w-full h-full object-cover" alt="" />
                        ) : (
                           <Building2 size={24} className="text-slate-300" />
                        )}
                      </div>
                      <div className={`absolute -bottom-1 -right-1 w-6 h-6 rounded-full border-2 border-white flex items-center justify-center shadow-sm ${bg} ${color}`}>
                        <Icon size={12} strokeWidth={3} />
                      </div>
                    </div>
                    
                    <div className="flex-1 min-w-0 pt-1">
                      <p className="text-[14px] text-slate-700 leading-snug">
                        <span className="font-black text-slate-900">{notif.actorName}</span> {notif.message}
                      </p>
                      <div className="flex items-center gap-2 mt-2">
                        <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider bg-slate-50 px-2 py-0.5 rounded-md">
                          {timeAgo(notif.created_at)}
                        </span>
                        {!notif.read && (
                          <span className="text-[9px] font-black text-[#1da1f2] uppercase animate-pulse">New</span>
                        )}
                      </div>
                    </div>

                    {!notif.read && (
                      <div className="w-2.5 h-2.5 rounded-full bg-[#1da1f2] shadow-[0_0_10px_#1da1f2] mt-2 shrink-0"></div>
                    )}
                  </div>
                );
              })}
            </div>
          ) : (
            <div className="flex flex-col items-center justify-center h-80 text-center px-10">
              <div className="w-24 h-24 rounded-full bg-[#e0e5ec] shadow-[inset_4px_4px_8px_#a3b1c6,inset_-4px_-4px_8px_#ffffff] flex items-center justify-center mb-6">
                <Bell size={40} className="text-slate-300" />
              </div>
              <h3 className="text-lg font-black text-slate-800">Peace and quiet</h3>
              <p className="text-sm text-slate-500 mt-1 font-medium">Your notification center is clear. Check back later for activity!</p>
              <button 
                onClick={() => navigate('/explore')}
                className="mt-8 px-8 py-3 bg-slate-900 text-white rounded-full font-bold text-sm hover:bg-black transition-all"
              >
                Go Exploring
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}