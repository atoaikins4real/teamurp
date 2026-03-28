import { useState, useRef, useEffect } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { 
  MapPin, Edit3, Briefcase, Star, Building2, LogOut, Mail, Sparkles, 
  Heart, MessageCircle, Repeat, Bookmark, LayoutList, Edit2, Trash2,
  UserPlus, UserCheck, ChevronLeft, ChevronRight, X, Send, Loader2, Settings,
  Globe, Phone, Calendar, Users as UsersIcon
} from 'lucide-react';
import { useTenant } from '../contexts/TenantContext';
import { supabase } from '../lib/supabase';
import { UpgradeModal } from '../components/UpgradeModal';

// --- HELPERS ---
const timeAgo = (dateString: string) => {
  const now = new Date();
  const past = new Date(dateString);
  const diffInMinutes = Math.floor((now.getTime() - past.getTime()) / 60000);
  if (diffInMinutes < 1) return 'Just now';
  if (diffInMinutes < 60) return `${diffInMinutes} mins ago`;
  if (diffInMinutes < 1440) return `${Math.floor(diffInMinutes / 60)} hrs ago`;
  if (diffInMinutes < 43200) return `${Math.floor(diffInMinutes / 1440)} days ago`;
  return past.toLocaleDateString();
};

const isVideoUrl = (url: string) => url?.match(/\.(mp4|webm|ogg|mov)(\?.*)?$/i) !== null;

// --- PROFILE COMPLETION ALGORITHM ---
const calculateProfileCompletion = (profile: any) => {
  if (!profile) return 0;
  const fields = ['first_name', 'last_name', 'company', 'business_type', 'avatar_url', 'cover_url', 'location', 'bio', 'phone', 'website', 'primary_service', 'team_size'];
  let filledCount = 0;
  fields.forEach(field => {
    if (profile[field] && String(profile[field]).trim() !== '') {
      filledCount++;
    }
  });
  return Math.round((filledCount / fields.length) * 100);
};

// --- DYNAMIC CATEGORIES & SERVICES MASTER LIST ---
const BUSINESS_CATEGORIES: Record<string, string[]> = {
  'Accommodation': ['Luxury Hotel', 'Boutique Hotel', 'Guest House', 'Resort', 'Hostel', 'Short Let Apartment'],
  'Tour Operator': ['Guided City Tours', 'Wildlife Safari', 'Cultural & Heritage', 'Hiking & Adventure', 'Boat & Water Tours'],
  'Transport & Logistics': ['Airport Transfers', 'SUV & 4x4 Rentals', 'Bus Fleets', 'Chauffeur Services', 'Ride Hailing'],
  'Travel Agency': ['Ticketing & Visas', 'Itinerary Planning', 'Corporate Travel', 'Group Packages'],
  'Restaurant & Dining': ['Local Ghanaian Cuisine', 'Fine Dining', 'Casual Cafe', 'Bar & Lounge', 'Catering'],
  'Activity Provider': ['Water Sports', 'Spa & Wellness', 'Nightlife & Events', 'Workshops & Classes'],
  'Health & Safety': ['Pharmacy', 'Clinic', 'Emergency Services', 'Travel Insurance'],
  'Retail & Shopping': ['Supermarket', 'Souvenirs & Crafts', 'Travel Essentials', 'Fashion']
};

// --- SUB-COMPONENTS ---
const Lightbox = ({ mediaUrls, initialIndex, onClose }: { mediaUrls: string[], initialIndex: number, onClose: () => void }) => {
  const [currentIndex, setCurrentIndex] = useState(initialIndex);

  const handleNext = (e: React.MouseEvent) => {
    e.stopPropagation();
    setCurrentIndex((prev) => (prev + 1) % mediaUrls.length);
  };

  const handlePrev = (e: React.MouseEvent) => {
    e.stopPropagation();
    setCurrentIndex((prev) => (prev === 0 ? mediaUrls.length - 1 : prev - 1));
  };

  const currentUrl = mediaUrls[currentIndex];

  return (
    <div className="fixed inset-0 z-[200] bg-black/95 backdrop-blur-md flex items-center justify-center animate-in fade-in duration-300" onClick={onClose}>
      <button onClick={onClose} className="absolute top-6 right-6 text-white/70 hover:text-white z-50"><X size={32} /></button>
      
      {mediaUrls.length > 1 && (
        <>
          <button onClick={handlePrev} className="absolute left-4 md:left-10 text-white/50 hover:text-white p-2 rounded-full bg-white/10 hover:bg-white/20 transition-all z-50">
            <ChevronLeft size={32} />
          </button>
          <button onClick={handleNext} className="absolute right-4 md:right-10 text-white/50 hover:text-white p-2 rounded-full bg-white/10 hover:bg-white/20 transition-all z-50">
            <ChevronRight size={32} />
          </button>
        </>
      )}

      <div className="max-w-5xl max-h-[90vh] w-full p-4 flex items-center justify-center" onClick={(e) => e.stopPropagation()}>
        {isVideoUrl(currentUrl) ? (
          <video src={currentUrl} controls autoPlay className="max-w-full max-h-[85vh] rounded-xl shadow-2xl" />
        ) : (
          <img src={currentUrl} alt="Enlarged" className="max-w-full max-h-[85vh] object-contain rounded-xl shadow-2xl" />
        )}
      </div>
      
      {mediaUrls.length > 1 && (
        <div className="absolute bottom-6 left-1/2 -translate-x-1/2 flex gap-2 z-50 bg-black/50 px-4 py-2 rounded-full">
          {mediaUrls.map((_, idx) => (
            <div key={idx} className={`w-2 h-2 rounded-full transition-all ${idx === currentIndex ? 'bg-white scale-125' : 'bg-white/30'}`} />
          ))}
        </div>
      )}
    </div>
  );
};

// --- EDIT PROFILE MODAL ---
const EditProfileModal = ({ isOpen, onClose, profileData, onSave }: any) => {
  const [loading, setLoading] = useState(false);
  const [formData, setFormData] = useState({
    first_name: '', last_name: '', company: '', business_type: '', location: '', bio: '',
    phone: '', website: '', primary_service: '', team_size: '', year_established: ''
  });

  useEffect(() => {
    if (profileData) {
      setFormData({
        first_name: profileData.first_name || '',
        last_name: profileData.last_name || '',
        company: profileData.company || '',
        business_type: profileData.business_type || '',
        location: profileData.location || '',
        bio: profileData.bio || '',
        phone: profileData.phone || '',
        website: profileData.website || '',
        primary_service: profileData.primary_service || '',
        team_size: profileData.team_size || '',
        year_established: profileData.year_established || ''
      });
    }
  }, [profileData, isOpen]);

  if (!isOpen) return null;

  const handleCategoryChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    setFormData({
      ...formData,
      business_type: e.target.value,
      primary_service: 'Hotel' 
    });
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      const { error } = await supabase.from('profiles').update(formData).eq('id', profileData.id);
      if (error) throw error;
      onSave(formData); 
      onClose();
    } catch (error) {
      console.error('Error updating profile:', error);
      alert('Failed to update profile. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const availableServices = formData.business_type ? BUSINESS_CATEGORIES[formData.business_type] : [];

  return (
    <div className="fixed inset-0 z-[5000] flex items-center justify-center p-4 sm:p-6">
      <div className="absolute inset-0 bg-slate-900/60 backdrop-blur-sm animate-in fade-in duration-200" onClick={onClose} />
      <div className="bg-white w-full max-w-2xl rounded-3xl p-6 md:p-8 relative z-10 shadow-2xl animate-in zoom-in-95 max-h-[95vh] overflow-hidden flex flex-col">
        
        <div className="flex justify-between items-center mb-6 shrink-0">
          <div>
            <h2 className="text-2xl font-black text-slate-800">Edit Profile</h2>
            <p className="text-xs font-bold text-slate-400 mt-1">Make your business stand out to partners.</p>
          </div>
          <button onClick={onClose} className="p-2 bg-slate-100 rounded-full text-slate-400 hover:text-slate-600 hover:bg-slate-200 transition-colors"><X size={18} /></button>
        </div>
        
        <form onSubmit={handleSubmit} className="space-y-5 overflow-y-auto custom-scrollbar pr-2 flex-1 pb-4">
          
          <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
            <div>
              <label className="block text-xs font-bold text-slate-500 mb-1.5">First Name</label>
              <input type="text" value={formData.first_name} onChange={e => setFormData({...formData, first_name: e.target.value})} className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 text-sm font-medium focus:outline-none focus:ring-2 focus:ring-[#1da1f2]/20 focus:border-[#1da1f2]" />
            </div>
            <div>
              <label className="block text-xs font-bold text-slate-500 mb-1.5">Last Name</label>
              <input type="text" value={formData.last_name} onChange={e => setFormData({...formData, last_name: e.target.value})} className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 text-sm font-medium focus:outline-none focus:ring-2 focus:ring-[#1da1f2]/20 focus:border-[#1da1f2]" />
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
            <div>
              <label className="block text-xs font-bold text-slate-500 mb-1.5">Company / Brand Name</label>
              <input type="text" value={formData.company} onChange={e => setFormData({...formData, company: e.target.value})} className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 text-sm font-medium focus:outline-none focus:ring-2 focus:ring-[#1da1f2]/20 focus:border-[#1da1f2]" />
            </div>
            <div>
              <label className="block text-xs font-bold text-slate-500 mb-1.5">Phone Number</label>
              <input type="tel" value={formData.phone} onChange={e => setFormData({...formData, phone: e.target.value})} placeholder="+233..." className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 text-sm font-medium focus:outline-none focus:ring-2 focus:ring-[#1da1f2]/20 focus:border-[#1da1f2]" />
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-5 pt-2 border-t border-slate-100">
            <div>
              <label className="block text-xs font-bold text-slate-500 mb-1.5">Business Category</label>
              <select value={formData.business_type} onChange={handleCategoryChange} className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 text-sm font-bold text-slate-700 focus:outline-none focus:ring-2 focus:ring-[#1da1f2]/20 focus:border-[#1da1f2] cursor-pointer">
                <option value="" disabled>Select a category...</option>
                {Object.keys(BUSINESS_CATEGORIES).map(cat => (
                  <option key={cat} value={cat}>{cat}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-xs font-bold text-slate-500 mb-1.5">Primary Service</label>
              <select 
                value={formData.primary_service} 
                onChange={e => setFormData({...formData, primary_service: e.target.value})} 
                disabled={!formData.business_type}
                className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 text-sm font-bold text-slate-700 focus:outline-none focus:ring-2 focus:ring-[#1da1f2]/20 focus:border-[#1da1f2] cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <option value="" disabled>{formData.business_type ? 'Select primary service...' : 'Select a category first'}</option>
                {availableServices?.map((service: string) => (
                  <option key={service} value={service}>{service}</option>
                ))}
              </select>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
            <div>
              <label className="block text-xs font-bold text-slate-500 mb-1.5">Team Size</label>
              <select value={formData.team_size} onChange={e => setFormData({...formData, team_size: e.target.value})} className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 text-sm font-medium focus:outline-none focus:ring-2 focus:ring-[#1da1f2]/20 focus:border-[#1da1f2] cursor-pointer">
                <option value="" disabled>Select team size...</option>
                <option value="1-10 Employees">1-10 Employees</option>
                <option value="11-50 Employees">11-50 Employees</option>
                <option value="51-200 Employees">51-200 Employees</option>
                <option value="200+ Employees">200+ Employees</option>
              </select>
            </div>
            <div>
              <label className="block text-xs font-bold text-slate-500 mb-1.5">Year Established</label>
              <input type="number" value={formData.year_established} onChange={e => setFormData({...formData, year_established: e.target.value})} placeholder="e.g. 2015" className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 text-sm font-medium focus:outline-none focus:ring-2 focus:ring-[#1da1f2]/20 focus:border-[#1da1f2]" />
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-5 pt-2 border-t border-slate-100">
            <div>
              <label className="block text-xs font-bold text-slate-500 mb-1.5">City, Location</label>
              <input type="text" value={formData.location} onChange={e => setFormData({...formData, location: e.target.value})} placeholder="e.g. Accra, Ghana" className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 text-sm font-medium focus:outline-none focus:ring-2 focus:ring-[#1da1f2]/20 focus:border-[#1da1f2]" />
            </div>
            <div>
              <label className="block text-xs font-bold text-slate-500 mb-1.5">Website</label>
              <input type="url" value={formData.website} onChange={e => setFormData({...formData, website: e.target.value})} placeholder="https://..." className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 text-sm font-medium focus:outline-none focus:ring-2 focus:ring-[#1da1f2]/20 focus:border-[#1da1f2]" />
            </div>
          </div>

          <div>
            <label className="block text-xs font-bold text-slate-500 mb-1.5">Bio / About</label>
            <textarea value={formData.bio} onChange={e => setFormData({...formData, bio: e.target.value})} rows={3} placeholder="Tell partners what makes your business unique..." className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 text-sm font-medium focus:outline-none focus:ring-2 focus:ring-[#1da1f2]/20 focus:border-[#1da1f2] resize-none" />
          </div>
          
          <div className="sticky bottom-0 bg-white pt-2 pb-1 z-20">
            <button type="submit" disabled={loading} className="w-full py-4 bg-[#1da1f2] text-white font-black rounded-xl hover:bg-[#1a91da] transition-all flex items-center justify-center shadow-lg active:scale-[0.98]">
              {loading ? <Loader2 size={20} className="animate-spin" /> : "Save Profile Details"}
            </button>
          </div>
        </form>

      </div>
    </div>
  );
}

const PostCard = ({ post, currentUser }: { post: any, currentUser: any }) => {
  const navigate = useNavigate();
  const [isLiked, setIsLiked] = useState(post.likes?.some((l: any) => l.user_id === currentUser?.id) || false);
  const [likeCount, setLikeCount] = useState(post.likes?.length || 0);
  
  const [isReposted, setIsReposted] = useState(post.reposts?.some((r: any) => r.user_id === currentUser?.id) || false);
  const [repostCount, setRepostCount] = useState(post.reposts?.length || 0);
  
  const [carouselIndex, setCarouselIndex] = useState(0);
  const [lightboxData, setLightboxData] = useState<{ urls: string[], index: number } | null>(null);

  const [showComments, setShowComments] = useState(false);
  const [commentText, setCommentText] = useState('');
  const [comments, setComments] = useState<any[]>([]);
  const [loadingComments, setLoadingComments] = useState(false);
  const [commentCount, setCommentCount] = useState(post.comments?.length || 0);
  const [editingCommentId, setEditingCommentId] = useState<string | null>(null);
  const [editCommentText, setEditCommentText] = useState('');

  const handleLike = async () => {
    if (!currentUser) return;
    try {
      if (isLiked) {
        setIsLiked(false);
        setLikeCount((prev: number) => prev - 1);
        await supabase.from('likes').delete().eq('post_id', post.id).eq('user_id', currentUser.id);
      } else {
        setIsLiked(true);
        setLikeCount((prev: number) => prev + 1);
        await supabase.from('likes').insert({ post_id: post.id, user_id: currentUser.id });
      }
    } catch (err) { console.error(err); }
  };

  const handleRepost = async () => {
    if (!currentUser) return;
    try {
      if (isReposted) {
        setIsReposted(false);
        setRepostCount((prev: number) => prev - 1);
        await supabase.from('reposts').delete().eq('post_id', post.id).eq('user_id', currentUser.id);
      } else {
        setIsReposted(true);
        setRepostCount((prev: number) => prev + 1);
        await supabase.from('reposts').insert({ post_id: post.id, user_id: currentUser.id });
      }
    } catch (err) { console.error(err); }
  };

  const toggleComments = async () => {
    setShowComments(!showComments);
    if (!showComments && comments.length === 0) {
      setLoadingComments(true);
      const { data } = await supabase
        .from('comments')
        .select('*, user:profiles(company, first_name, last_name, avatar_url, is_verified)')
        .eq('post_id', post.id)
        .order('created_at', { ascending: true });
      
      if (data) setComments(data);
      setLoadingComments(false);
    }
  };

  const submitComment = async () => {
    if (!commentText.trim() || !currentUser) return;
    try {
      const { data, error } = await supabase
        .from('comments')
        .insert({ post_id: post.id, user_id: currentUser.id, content: commentText.trim() })
        .select('*, user:profiles(company, first_name, last_name, avatar_url, is_verified)')
        .single();
      
      if (error) throw error;
      if (data) {
        setComments([...comments, data]);
        setCommentCount((prev: number) => prev + 1);
        setCommentText('');
      }
    } catch (err) {
      console.error("Failed to post comment", err);
    }
  };

  const handleUpdateComment = async (commentId: string) => {
    if (!editCommentText.trim()) return;
    try {
      await supabase.from('comments').update({ content: editCommentText.trim() }).eq('id', commentId);
      setComments(comments.map(c => c.id === commentId ? { ...c, content: editCommentText.trim() } : c));
      setEditingCommentId(null); setEditCommentText('');
    } catch (error) { alert("Failed to update comment."); }
  };

  const handleDeleteComment = async (commentId: string) => {
    if (!window.confirm("Delete this comment?")) return;
    try { 
      await supabase.from('comments').delete().eq('id', commentId);
      setComments(comments.filter(c => c.id !== commentId));
      setCommentCount((prev: number) => prev - 1);
    } 
    catch (error) { alert("Failed to delete comment."); }
  };

  const hasMedia = post.media_urls && post.media_urls.length > 0;

  return (
    <>
      <div className="bg-[#e0e5ec] rounded-3xl p-5 shadow-[9px_9px_16px_#a3b1c6,-9px_-9px_16px_#ffffff] border border-white/40 relative">
        <div className="flex items-center gap-3 mb-3">
          <div className="w-10 h-10 rounded-full bg-[#d1d8e0] flex items-center justify-center shadow-inner overflow-hidden shrink-0 cursor-pointer" onClick={() => navigate(`/profile/${post.author?.id}`)}>
            {post.author?.avatar_url ? (
              <img src={post.author.avatar_url} className="w-full h-full object-cover" alt="Avatar" />
            ) : (
              <Building2 size={16} className="text-slate-400" />
            )}
          </div>
          <div className="flex-1 min-w-0">
            <h4 className="text-sm font-black text-slate-800 flex items-center gap-1 truncate cursor-pointer hover:underline" onClick={() => navigate(`/profile/${post.author?.id}`)}>
              {post.author?.company || `${post.author?.first_name} ${post.author?.last_name}`}
              {post.author?.is_verified && <Sparkles size={12} className="text-[#1da1f2] shrink-0" />}
            </h4>
            <div className="text-[10px] font-bold text-slate-500 uppercase">{timeAgo(post.created_at)}</div>
          </div>
        </div>

        {post.location && (
          <div className="flex items-center gap-1 text-[11px] font-black text-[#1da1f2] uppercase tracking-wider mb-2">
            <MapPin size={12} /> {post.location}
          </div>
        )}

        <p className="text-[15px] text-slate-700 leading-relaxed mb-4 whitespace-pre-wrap">{post.content}</p>

        {hasMedia && (
          <div className="relative mb-4 rounded-2xl overflow-hidden bg-slate-900 shadow-inner group">
            <div className="relative aspect-video flex items-center justify-center cursor-pointer" onClick={() => setLightboxData({ urls: post.media_urls, index: carouselIndex })}>
               {isVideoUrl(post.media_urls[carouselIndex]) ? (
                 <video src={post.media_urls[carouselIndex]} controls className="w-full h-full object-cover" onClick={(e) => e.stopPropagation()} />
               ) : (
                 <img src={post.media_urls[carouselIndex]} className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-105" alt="Post media" />
               )}
            </div>

            {post.media_urls.length > 1 && (
              <>
                <button onClick={(e) => { e.stopPropagation(); setCarouselIndex((prev: number) => prev === 0 ? post.media_urls.length - 1 : prev - 1); }} className="absolute left-2 top-1/2 -translate-y-1/2 w-8 h-8 rounded-full bg-black/50 text-white flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity hover:bg-black/70">
                  <ChevronLeft size={16} />
                </button>
                <button onClick={(e) => { e.stopPropagation(); setCarouselIndex((prev: number) => (prev + 1) % post.media_urls.length); }} className="absolute right-2 top-1/2 -translate-y-1/2 w-8 h-8 rounded-full bg-black/50 text-white flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity hover:bg-black/70">
                  <ChevronRight size={16} />
                </button>
                <div className="absolute bottom-3 left-1/2 -translate-x-1/2 flex gap-1.5 bg-black/40 px-2 py-1 rounded-full backdrop-blur-sm">
                  {post.media_urls.map((_: any, idx: number) => (
                    <div key={idx} className={`w-1.5 h-1.5 rounded-full transition-all ${idx === carouselIndex ? 'bg-white w-3' : 'bg-white/50'}`} />
                  ))}
                </div>
              </>
            )}
          </div>
        )}

        {post.tags && post.tags.length > 0 && (
          <div className="flex flex-wrap gap-2 mb-4">
            {post.tags.map((tag: string, idx: number) => (
              <span key={idx} className="px-3 py-1 bg-indigo-50 border border-indigo-100 text-indigo-600 text-[11px] font-black rounded-full cursor-pointer hover:bg-indigo-100 transition-colors">
                {tag}
              </span>
            ))}
          </div>
        )}

        <div className="flex items-center justify-between pt-4 border-t border-slate-300/50">
          <div className="flex items-center gap-6 text-slate-500">
            <button onClick={handleLike} className={`flex items-center gap-1.5 text-xs font-bold transition-colors ${isLiked ? 'text-rose-500' : 'hover:text-rose-500'}`}>
              <Heart size={16} className={isLiked ? "fill-rose-500" : ""} /> {likeCount}
            </button>
            <button onClick={toggleComments} className={`flex items-center gap-1.5 text-xs font-bold transition-colors ${showComments ? 'text-blue-500' : 'hover:text-blue-500'}`}>
              <MessageCircle size={16} className={showComments ? "fill-blue-500 text-blue-500" : ""} /> {commentCount}
            </button>
            <button onClick={handleRepost} className={`flex items-center gap-1.5 text-xs font-bold transition-colors ${isReposted ? 'text-green-500' : 'hover:text-green-500'}`}>
              <Repeat size={16} className={isReposted ? "stroke-2" : ""} /> {repostCount}
            </button>
          </div>
          <button className="text-slate-500 hover:text-indigo-500 transition-colors"><Bookmark size={16} /></button>
        </div>

        {showComments && (
          <div className="mt-4 pt-4 border-t border-slate-300/50 animate-in fade-in slide-in-from-top-2">
            {loadingComments ? (
              <div className="flex justify-center py-4"><Loader2 size={18} className="animate-spin text-[#1da1f2]" /></div>
            ) : (
              <div className="space-y-4 mb-4 max-h-[300px] overflow-y-auto custom-scrollbar pr-2">
                {comments.map((comment) => (
                  <div key={comment.id} className="flex gap-3">
                    <div className="w-8 h-8 rounded-full bg-[#d1d8e0] overflow-hidden shrink-0 cursor-pointer" onClick={() => navigate(`/profile/${comment.user_id}`)}>
                      {comment.user?.avatar_url ? (
                        <img src={comment.user.avatar_url} className="w-full h-full object-cover" />
                      ) : (
                        <Building2 size={14} className="text-slate-400 m-auto h-full" />
                      )}
                    </div>
                    <div className="flex-1 bg-white/50 p-3 rounded-2xl rounded-tl-none border border-white/60 group">
                      <div className="flex items-baseline justify-between mb-1">
                        <span className="text-xs font-black text-slate-800 cursor-pointer hover:underline" onClick={() => navigate(`/profile/${comment.user_id}`)}>{comment.user?.company || comment.user?.first_name}</span>
                        <div className="flex items-center gap-2">
                          <span className="text-[9px] font-bold text-slate-400">{timeAgo(comment.created_at)}</span>
                          {currentUser && comment.user_id === currentUser.id && (
                            <div className="opacity-0 group-hover:opacity-100 transition-opacity flex gap-2">
                              <button onClick={() => { setEditingCommentId(comment.id); setEditCommentText(comment.content); }} className="text-slate-400 hover:text-[#1da1f2]"><Edit2 size={10} /></button>
                              <button onClick={() => handleDeleteComment(comment.id)} className="text-slate-400 hover:text-rose-500"><Trash2 size={10} /></button>
                            </div>
                          )}
                        </div>
                      </div>
                      {editingCommentId === comment.id ? (
                        <div className="flex gap-2 mt-1">
                          <input 
                            value={editCommentText} onChange={(e) => setEditCommentText(e.target.value)}
                            className="flex-1 bg-white px-2 py-1 rounded border border-slate-200 text-xs focus:outline-none focus:border-[#1da1f2]" autoFocus
                          />
                          <button onClick={() => handleUpdateComment(comment.id)} className="text-white bg-[#1da1f2] rounded px-2"><Send size={10} /></button>
                        </div>
                      ) : (
                        <p className="text-sm text-slate-700">{comment.content}</p>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
            
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 rounded-full bg-[#d1d8e0] overflow-hidden shrink-0 border border-white/50">
                {currentUser?.avatarUrl ? (
                  <img src={currentUser.avatarUrl} className="w-full h-full object-cover" />
                ) : (
                  <Building2 size={14} className="text-slate-400 m-auto h-full" />
                )}
              </div>
              <input 
                type="text" value={commentText} onChange={(e) => setCommentText(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && submitComment()}
                placeholder="Write a comment..." className="flex-1 bg-white/60 px-4 py-2 rounded-full text-sm outline-none focus:ring-2 focus:ring-[#1da1f2]/30 border border-white/50 transition-all"
              />
              <button onClick={submitComment} disabled={!commentText.trim()} className="w-8 h-8 flex items-center justify-center bg-[#1da1f2] text-white rounded-full disabled:opacity-50 transition-all hover:bg-[#1a91da]">
                <Send size={14} className="-ml-0.5" />
              </button>
            </div>
          </div>
        )}
      </div>

      {lightboxData && (
        <Lightbox mediaUrls={lightboxData.urls} initialIndex={lightboxData.index} onClose={() => setLightboxData(null)} />
      )}
    </>
  );
};

// --- MAIN PROFILE COMPONENT ---
export default function Profile() {
  const navigate = useNavigate();
  const { id } = useParams(); 
  const { user: currentUser } = useTenant(); 
  
  const [isUpgradeModalOpen, setIsUpgradeModalOpen] = useState(false);
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);

  const coverInputRef = useRef<HTMLInputElement>(null);
  const avatarInputRef = useRef<HTMLInputElement>(null);

  const [profileData, setProfileData] = useState<any>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isFollowing, setIsFollowing] = useState(false);
  
  const [followersCount, setFollowersCount] = useState(0);
  const [followingCount, setFollowingCount] = useState(0);
  
  const [avatarPreview, setAvatarPreview] = useState<string | null>(null);
  const [coverPreview, setCoverPreview] = useState<string | null>(null);
  const [completionRate, setCompletionRate] = useState(0);
  
  // STORY STATE
  const [activeStories, setActiveStories] = useState<string[]>([]);
  
  const [profileLightbox, setProfileLightbox] = useState<{urls: string[], index: number} | null>(null);
  const [activeTab, setActiveTab] = useState<'posts' | 'likes' | 'saved' | 'reposts' | 'activity'>('posts');
  
  // TAB CACHING SYSTEM
  const [tabCache, setTabCache] = useState<Record<string, any[]>>({});
  const [loadingActivity, setLoadingActivity] = useState(false);
  
  useEffect(() => {
    const fetchProfile = async () => {
      setIsLoading(true);
      try {
        const targetId = id || currentUser?.id;
        if (!targetId) return;

        const { data: dbProfile, error } = await supabase.from('profiles').select('*').eq('id', targetId).maybeSingle();
        if (error) throw error;
        
        if (dbProfile) {
          const isOwnProfile = !id || id === currentUser?.id;
          
          setProfileData({
            ...dbProfile,
            fullName: `${dbProfile.first_name} ${dbProfile.last_name}`.trim(),
            businessType: dbProfile.business_type,
            email: isOwnProfile && currentUser ? currentUser.email : dbProfile.email,
            isPartner: !isOwnProfile,
          });

          // Set the Completion Rate
          if (isOwnProfile) {
            setCompletionRate(calculateProfileCompletion(dbProfile));
          }
          
          if (dbProfile.avatar_url) setAvatarPreview(dbProfile.avatar_url);
          if (dbProfile.cover_url) setCoverPreview(dbProfile.cover_url);
        }

        // Fetch Follow Counts
        if (currentUser && targetId !== currentUser.id) {
          const { data } = await supabase.from('follows').select('id').eq('follower_id', currentUser.id).eq('following_id', targetId).maybeSingle();
          if (data) setIsFollowing(true);
        }
        const { count: fCount } = await supabase.from('follows').select('*', { count: 'exact', head: true }).eq('following_id', targetId);
        const { count: fwingCount } = await supabase.from('follows').select('*', { count: 'exact', head: true }).eq('follower_id', targetId);
        setFollowersCount(fCount || 0);
        setFollowingCount(fwingCount || 0);

        // Fetch Stories
        const { data: storyData } = await supabase
          .from('stories')
          .select('media_url')
          .eq('user_id', targetId)
          .gt('expires_at', new Date().toISOString())
          .order('created_at', { ascending: true });
        
        if (storyData && storyData.length > 0) {
          setActiveStories(storyData.map(s => s.media_url));
        } else {
          setActiveStories([]);
        }

      } catch (err) {
        console.error("Error loading profile data:", err);
      } finally {
        setIsLoading(false);
      }
    };
    fetchProfile();
  }, [id, currentUser]);

  const handleProfileSave = (updatedData: any) => {
    const newData = {
      ...profileData,
      ...updatedData,
      fullName: `${updatedData.first_name} ${updatedData.last_name}`.trim(),
      businessType: updatedData.business_type,
    };
    setProfileData(newData);
    setCompletionRate(calculateProfileCompletion(newData));
  };

  const handleFollow = async () => {
    if (!currentUser || !profileData) return;
    try {
      if (isFollowing) {
        await supabase.from('follows').delete().eq('follower_id', currentUser.id).eq('following_id', profileData.id);
        setIsFollowing(false);
        setFollowersCount((prev: number) => Math.max(0, prev - 1)); 
      } else {
        await supabase.from('follows').insert({ follower_id: currentUser.id, following_id: profileData.id });
        await supabase.from('notifications').insert({ user_id: profileData.id, actor_id: currentUser.id, type: 'follow' });
        setIsFollowing(true);
        setFollowersCount((prev: number) => prev + 1); 
      }
    } catch (err) { console.error("Follow action failed:", err); }
  };

  const handleMessageClick = async () => {
    if (!currentUser || !profileData) return;
    try {
      const { data: existingConvos, error: fetchError } = await supabase
        .from('conversations')
        .select('id')
        .or(`and(participant_1.eq.${currentUser.id},participant_2.eq.${profileData.id}),and(participant_1.eq.${profileData.id},participant_2.eq.${currentUser.id})`);

      if (fetchError) throw fetchError;
      if (!existingConvos || existingConvos.length === 0) {
        await supabase.from('conversations').insert({ participant_1: currentUser.id, participant_2: profileData.id });
      }
      navigate('/messages');
    } catch (err) { console.error("Error starting conversation:", err); }
  };

  const handleLogout = async () => { await supabase.auth.signOut(); navigate('/explore'); };

  const handleImageChange = async (e: React.ChangeEvent<HTMLInputElement>, type: 'avatar' | 'cover') => {
    const file = e.target.files?.[0];
    if (!file || !currentUser) return;

    try {
      const objectUrl = URL.createObjectURL(file);
      if (type === 'avatar') setAvatarPreview(objectUrl);
      else setCoverPreview(objectUrl);

      const fileExt = file.name.split('.').pop();
      const fileName = `${currentUser.id}-${Math.random()}.${fileExt}`;
      const bucketName = type === 'avatar' ? 'avatars' : 'cover';
      const dbColumnName = type === 'avatar' ? 'avatar_url' : 'cover_url';

      const { error: uploadError } = await supabase.storage.from(bucketName).upload(fileName, file, { upsert: true });
      if (uploadError) throw uploadError;

      const { data: { publicUrl } } = supabase.storage.from(bucketName).getPublicUrl(fileName);

      const { error: updateError } = await supabase.from('profiles').update({ [dbColumnName]: publicUrl }).eq('id', currentUser.id);
      if (updateError) throw updateError;

      const newData = { ...profileData, [dbColumnName]: publicUrl };
      setProfileData(newData);
      setCompletionRate(calculateProfileCompletion(newData));

    } catch (error: any) {
      console.error(`Error uploading ${type}:`, error);
      alert(`Failed to upload image.`);
      if (type === 'avatar') setAvatarPreview(profileData?.avatar_url || null);
      else setCoverPreview(profileData?.cover_url || null);
    }
  };

  const handleAvatarClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (activeStories.length > 0) {
      setProfileLightbox({ urls: activeStories, index: 0 });
    } else if (avatarPreview) {
      setProfileLightbox({ urls: [avatarPreview], index: 0 });
    }
  };

  const displayBusinessType = profileData?.businessType 
    ? profileData.businessType.includes('_') 
      ? profileData.businessType.split('_').map((word: string) => word.charAt(0).toUpperCase() + word.slice(1)).join(' ')
      : profileData.businessType
    : 'Verified Partner';

  useEffect(() => {
    const fetchActivity = async () => {
      if (!profileData || activeTab === 'activity') return; 
      
      if (!tabCache[activeTab]) {
        setLoadingActivity(true);
      }
      
      try {
        let query;
        const selectString = '*, author:profiles(id, company, first_name, last_name, avatar_url, is_verified), likes(user_id), comments(id), reposts(user_id)';

        if (activeTab === 'posts') {
          query = supabase.from('posts').select(selectString).eq('author_id', profileData.id);
        } else if (activeTab === 'likes') {
          query = supabase.from('likes').select(`post:posts(${selectString})`).eq('user_id', profileData.id);
        } else if (activeTab === 'saved') {
          query = supabase.from('saved_posts').select(`post:posts(${selectString})`).eq('user_id', profileData.id);
        } else if (activeTab === 'reposts') {
          query = supabase.from('reposts').select(`post:posts(${selectString})`).eq('user_id', profileData.id);
        }

        if (query) {
          const { data, error } = await query.order('created_at', { ascending: false });
          if (error) throw error;
          if (data) {
            const formatted = data.map((d: any) => d.post || d).filter(p => p !== null);
            setTabCache(prev => ({ ...prev, [activeTab]: formatted }));
          }
        }
      } catch (error) {
        console.error("Error fetching activity:", error);
      } finally {
        setLoadingActivity(false);
      }
    };
    fetchActivity();
  }, [activeTab, profileData]);

  if (isLoading) return <div className="max-w-[800px] mx-auto pb-24 flex items-center justify-center h-64"><Loader2 className="w-8 h-8 animate-spin text-[#1da1f2]" /></div>;
  if (!profileData) return null;

  const hasStory = activeStories.length > 0;
  const currentActivities = tabCache[activeTab] || [];

  return (
    <div className="max-w-[800px] mx-auto pb-24 animate-in fade-in duration-500 relative select-none">
      
      <input type="file" accept="image/*" ref={coverInputRef} onChange={(e) => handleImageChange(e, 'cover')} className="hidden" />
      <input type="file" accept="image/*" ref={avatarInputRef} onChange={(e) => handleImageChange(e, 'avatar')} className="hidden" />

      {/* HEADER */}
      <div className="flex justify-between items-center mb-4 px-1 pt-2">
        <h1 className="text-2xl font-black text-slate-800">
          {profileData.isPartner ? 'Partner Profile' : 'Company Profile'}
        </h1>
        {!profileData.isPartner && (
          <button onClick={handleLogout} className="lg:hidden p-2.5 bg-[#e0e5ec] text-rose-500 rounded-full shadow-[3px_3px_6px_#a3b1c6,-3px_-3px_6px_#ffffff] hover:shadow-[inset_2px_2px_4px_#a3b1c6,inset_-2px_-2px_4px_#ffffff] transition-all">
            <LogOut size={18} />
          </button>
        )}
      </div>

      {/* PROFILE CARD */}
      <div className="bg-[#e0e5ec] border border-white/50 rounded-3xl overflow-hidden shadow-[9px_9px_16px_#a3b1c6,-9px_-9px_16px_#ffffff] mb-6">
        
        {/* COVER SECTION */}
        <div 
          className={`h-40 md:h-48 w-full bg-[#1e222b] relative overflow-hidden flex items-center justify-center ${coverPreview ? 'cursor-pointer' : ''}`}
          onClick={() => coverPreview && setProfileLightbox({ urls: [coverPreview], index: 0 })}
        >
          {coverPreview ? (
             <img src={coverPreview} alt="Cover" className="w-full h-full object-cover opacity-80 transition-transform duration-500 hover:scale-105" />
          ) : (
             <div className="absolute inset-0 bg-gradient-to-r from-slate-800 to-slate-900" />
          )}
          
          {!profileData.isPartner && (
            <button 
              onClick={(e) => { e.stopPropagation(); coverInputRef.current?.click(); }} 
              className="absolute top-4 right-4 p-2 bg-white/10 backdrop-blur-md rounded-full flex items-center justify-center text-white border border-white/20 hover:bg-white/20 transition-all z-10"
            >
              <Edit3 size={16} />
            </button>
          )}
        </div>

        <div className="px-6 pb-8 relative">
          
          {/* AVATAR SECTION WITH STORY GRADIENT */}
          <div className="relative w-28 h-28 md:w-32 md:h-32 -mt-14 md:-mt-16 z-10 inline-block">
            <div 
              onClick={handleAvatarClick}
              className={`w-full h-full rounded-full p-1 cursor-pointer transition-transform hover:scale-105 ${
                hasStory ? 'bg-gradient-to-tr from-blue-400 via-[#1da1f2] to-indigo-500 shadow-lg' : 'bg-transparent'
              }`}
            >
              <div className="w-full h-full rounded-full border-4 border-[#e0e5ec] bg-[#d1d8e0] overflow-hidden flex items-center justify-center shadow-inner">
                 {avatarPreview ? (
                   <img src={avatarPreview} alt="Avatar" className="w-full h-full object-cover" />
                 ) : (
                   <Building2 size={48} className="text-slate-400" />
                 )}
              </div>
            </div>
            
            {!profileData.isPartner && (
              <button 
                onClick={(e) => { e.stopPropagation(); avatarInputRef.current?.click(); }}
                className="absolute bottom-1 right-1 p-2 bg-[#e0e5ec] text-[#1da1f2] rounded-full shadow-[3px_3px_6px_#a3b1c6,-3px_-3px_6px_#ffffff] hover:shadow-[inset_2px_2px_4px_#a3b1c6,inset_-2px_-2px_4px_#ffffff] transition-all border border-white/50 z-20"
              >
                <Edit3 size={14} />
              </button>
            )}
          </div>

          <div className="mt-4 grid grid-cols-1 md:grid-cols-12 gap-6 md:gap-8">
            <div className="md:col-span-7">
              <div className="flex items-center gap-2">
                <h2 className="text-2xl font-bold text-slate-900">{profileData.company || profileData.fullName}</h2>
                <span title="Premium Partner" className="flex items-center justify-center w-6 h-6 rounded-full bg-amber-100 text-amber-500 shadow-sm">
                  <Sparkles size={12} />
                </span>
              </div>
              
              <div className="flex items-center gap-3 mt-1 mb-3">
                <p className="text-[15px] text-slate-800 font-medium">{displayBusinessType}</p>
                <div className="flex items-center gap-1 text-[11px] font-black text-slate-600 bg-[#d1d8e0] px-2 py-0.5 rounded-full shadow-inner">
                  <Star size={10} className="fill-amber-400 text-amber-400" /> 4.9
                </div>
              </div>

              {/* RICH PROFILE DETAILS */}
              <div className="flex flex-wrap gap-x-4 gap-y-2 mb-4">
                {profileData.location && (
                  <p className="text-sm font-semibold text-slate-500 flex items-center gap-1.5">
                    <MapPin size={14} className="text-[#1da1f2]"/> {profileData.location}
                  </p>
                )}
                {profileData.website && (
                  <a href={profileData.website.startsWith('http') ? profileData.website : `https://${profileData.website}`} target="_blank" rel="noopener noreferrer" className="text-sm font-semibold text-slate-500 hover:text-[#1da1f2] flex items-center gap-1.5 transition-colors">
                    <Globe size={14} className="text-[#1da1f2]"/> {profileData.website.replace(/^https?:\/\//, '')}
                  </a>
                )}
                {profileData.phone && (
                  <p className="text-sm font-semibold text-slate-500 flex items-center gap-1.5">
                    <Phone size={14} className="text-[#1da1f2]"/> {profileData.phone}
                  </p>
                )}
                {profileData.year_established && (
                  <p className="text-sm font-semibold text-slate-500 flex items-center gap-1.5">
                    <Calendar size={14} className="text-[#1da1f2]"/> Est. {profileData.year_established}
                  </p>
                )}
                {profileData.team_size && (
                  <p className="text-sm font-semibold text-slate-500 flex items-center gap-1.5">
                    <UsersIcon size={14} className="text-[#1da1f2]"/> {profileData.team_size}
                  </p>
                )}
              </div>
              
              {profileData.primary_service && (
                <div className="mb-4">
                  <span className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-blue-50 border border-blue-100 text-[#1da1f2] text-[11px] font-black rounded-full uppercase tracking-widest shadow-sm">
                    <Briefcase size={12} /> {profileData.primary_service}
                  </span>
                </div>
              )}

              {profileData.bio && (
                <p className="text-sm text-slate-600 mb-5 font-medium leading-relaxed bg-white/40 p-4 rounded-2xl border border-white/60">
                  {profileData.bio}
                </p>
              )}

              <div className="flex items-center gap-4 text-[13px] font-medium text-slate-500 mb-5">
                <div className="cursor-pointer hover:text-[#1da1f2] transition-colors">
                  <span className="text-slate-900 font-black text-[15px]">{followersCount}</span> Followers
                </div>
                <div className="cursor-pointer hover:text-[#1da1f2] transition-colors">
                  <span className="text-slate-900 font-black text-[15px]">{followingCount}</span> Following
                </div>
              </div>
              
              <div className="flex items-center gap-3 mt-2">
                {profileData.isPartner ? (
                  <>
                    <button 
                      onClick={handleFollow}
                      className={`px-6 py-2 rounded-full font-bold text-sm shadow-[3px_3px_6px_#a3b1c6,-3px_-3px_6px_#ffffff] transition-all flex items-center gap-2 ${
                        isFollowing ? 'bg-[#d1d8e0] text-[#1da1f2] shadow-[inset_2px_2px_4px_#a3b1c6,inset_-2px_-2px_4px_#ffffff]' : 'bg-[#1da1f2] text-white hover:bg-[#1a91da]'
                      }`}
                    >
                      {isFollowing ? <UserCheck size={16} /> : <UserPlus size={16} />}
                      {isFollowing ? 'Following' : 'Follow'}
                    </button>
                    <button 
                      onClick={handleMessageClick}
                      className="px-6 py-2 bg-[#e0e5ec] text-slate-700 rounded-full font-bold text-sm shadow-[3px_3px_6px_#a3b1c6,-3px_-3px_6px_#ffffff] hover:shadow-[inset_2px_2px_4px_#a3b1c6,inset_-2px_-2px_4px_#ffffff] transition-all flex items-center gap-2"
                    >
                      <MessageCircle size={16} /> Message
                    </button>
                  </>
                ) : (
                  <>
                    <button 
                      onClick={() => setIsEditModalOpen(true)} 
                      className="p-3 bg-[#1da1f2] text-white rounded-full shadow-[3px_3px_6px_#a3b1c6,-3px_-3px_6px_#ffffff] active:scale-95 transition-all"
                      title="Edit Profile"
                    >
                      <Edit3 size={18} />
                    </button>
                    <button 
                      onClick={() => navigate('/settings')} 
                      className="p-3 bg-[#e0e5ec] text-slate-500 hover:text-[#1da1f2] rounded-full shadow-[3px_3px_6px_#a3b1c6,-3px_-3px_6px_#ffffff] hover:shadow-[inset_2px_2px_4px_#a3b1c6,inset_-2px_-2px_4px_#ffffff] active:scale-95 transition-all"
                      title="Settings"
                    >
                      <Settings size={18} />
                    </button>

                    {/* Circular Progress Indicator */}
                    {completionRate < 100 && (
                      <div className="relative flex items-center justify-center w-11 h-11 bg-[#e0e5ec] rounded-full shadow-[inset_2px_2px_4px_#a3b1c6,inset_-2px_-2px_4px_#ffffff] shrink-0 ml-2" title={`Profile ${completionRate}% complete`}>
                        <svg className="w-11 h-11 transform -rotate-90">
                          <circle cx="22" cy="22" r="18" fill="none" stroke="#d1d8e0" strokeWidth="4" />
                          <circle cx="22" cy="22" r="18" fill="none" stroke="#1da1f2" strokeWidth="4" strokeDasharray={113} strokeDashoffset={113 - (completionRate / 100) * 113} className="transition-all duration-1000 ease-out" strokeLinecap="round" />
                        </svg>
                        <span className="absolute text-[10px] font-black text-[#1da1f2]">{completionRate}%</span>
                      </div>
                    )}
                  </>
                )}
              </div>
            </div>

            {/* CONTACT INFO */}
            <div className="md:col-span-5 space-y-4 pt-4 md:pt-0 md:border-l border-slate-300/50 md:pl-8">
              <div>
                <h3 className="text-[11px] font-black text-slate-400 uppercase tracking-widest mb-2 flex items-center gap-1.5">
                  <Briefcase size={12} /> Primary Contact
                </h3>
                <p className="text-sm font-bold text-slate-800">{profileData.fullName}</p>
              </div>
              <div>
                <p className="text-sm text-[#1da1f2] truncate flex items-center gap-1.5">
                  <Mail size={12} className="text-slate-400" /> {profileData.email}
                </p>
              </div>
            </div>
            
          </div>
        </div>
      </div>

      {/* PREMIUM UPGRADE BANNER */}
      {!profileData.isPartner && (
        <div className="mb-6 bg-gradient-to-r from-slate-900 to-slate-800 rounded-3xl p-6 flex flex-col sm:flex-row items-center justify-between shadow-xl overflow-hidden relative">
          <div className="absolute -right-10 -top-10 w-32 h-32 bg-[#1da1f2]/20 rounded-full blur-3xl"></div>
          <div className="relative z-10 text-center sm:text-left mb-4 sm:mb-0">
            <h3 className="text-lg font-black text-white flex items-center justify-center sm:justify-start gap-2">
              <Star size={18} className="text-amber-400" fill="currentColor" /> TeamUp Pro
            </h3>
            <p className="text-sm font-medium text-slate-400 mt-1">Unlock premium leads, verified badge, and map boosts.</p>
          </div>
          <button 
            onClick={() => setIsUpgradeModalOpen(true)}
            className="relative z-10 px-6 py-3 bg-[#1da1f2] hover:bg-[#1a91da] text-white font-black text-sm rounded-xl shadow-[0_0_20px_rgba(29,161,242,0.3)] transition-all active:scale-95 whitespace-nowrap"
          >
            Upgrade Now
          </button>
        </div>
      )}

      {/* TABS WITH SAVED ITEM */}
      <div className="sticky top-6 z-30 bg-[#e0e5ec] rounded-2xl p-1 shadow-[9px_9px_16px_#a3b1c6,-9px_-9px_16px_#ffffff] mb-6 flex justify-between border border-white/50">
        <TabButton active={activeTab === 'posts'} onClick={() => setActiveTab('posts')} icon={<LayoutList size={22} />} />
        <TabButton active={activeTab === 'likes'} onClick={() => setActiveTab('likes')} icon={<Heart size={22} />} />
        <TabButton active={activeTab === 'reposts'} onClick={() => setActiveTab('reposts')} icon={<Repeat size={22} />} />
        <TabButton active={activeTab === 'saved'} onClick={() => setActiveTab('saved')} icon={<Bookmark size={22} />} />
      </div>

      {/* FEED CONTENT */}
      <div className="space-y-6">
        {loadingActivity ? (
           <div className="flex justify-center p-10"><Loader2 className="w-8 h-8 animate-spin text-[#1da1f2]" /></div>
        ) : currentActivities.length > 0 ? (
          currentActivities.map((post: any) => (
            <PostCard key={post.id} post={post} currentUser={currentUser} />
          ))
        ) : (
          <div className="bg-[#e0e5ec] rounded-3xl p-8 text-center shadow-[inset_5px_5px_10px_#a3b1c6,inset_-5px_-5px_10px_#ffffff]">
            <h3 className="text-lg font-bold text-slate-800">Nothing to show yet</h3>
          </div>
        )}
      </div>

      {/* Main Profile Lightbox */}
      {profileLightbox && (
        <Lightbox mediaUrls={profileLightbox.urls} initialIndex={profileLightbox.index} onClose={() => setProfileLightbox(null)} />
      )}

      {/* MODALS */}
      <UpgradeModal isOpen={isUpgradeModalOpen} onClose={() => setIsUpgradeModalOpen(false)} />
      
      <EditProfileModal 
        isOpen={isEditModalOpen} 
        onClose={() => setIsEditModalOpen(false)} 
        profileData={profileData} 
        onSave={handleProfileSave} 
      />
    </div>
  );
}

const TabButton = ({ active, onClick, icon }: any) => (
  <button 
    onClick={onClick}
    className={`flex-1 flex flex-col items-center justify-center py-3.5 rounded-xl transition-all ${
      active 
        ? 'text-[#1da1f2] shadow-[inset_3px_3px_6px_#a3b1c6,inset_-2px_-2px_4px_#ffffff] border border-transparent' 
        : 'text-slate-400 hover:text-slate-600 border border-transparent'
    }`}
  >
    {icon}
  </button>
);