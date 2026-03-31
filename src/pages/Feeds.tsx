import React, { useState, useRef, useEffect } from 'react';
import { useOutletContext, useNavigate } from 'react-router-dom';
import { 
  Heart, MessageCircle, Share2, Bookmark, 
  MoreHorizontal, Image as ImageIcon, Send, Building2, Loader2,
  X, Edit2, Trash2, Link as LinkIcon, AlertTriangle, RefreshCw, 
  Plus, ChevronLeft, ChevronRight, Repeat, MapPin, Sparkles, Tag
} from 'lucide-react';
import { useTenant } from '../contexts/TenantContext';
import { supabase } from '../lib/supabase';
import { AuthModal } from '../components/AuthModal'; // <-- IMPORT ADDED

// --- HELPERS ---
const timeAgo = (dateString: string) => {
  const now = new Date();
  const past = new Date(dateString);
  const diffInMinutes = Math.floor((now.getTime() - past.getTime()) / 60000);
  if (diffInMinutes < 1) return 'Just now';
  if (diffInMinutes < 60) return `${diffInMinutes} minutes ago`;
  if (diffInMinutes < 1440) return `${Math.floor(diffInMinutes / 60)} hours ago`;
  return past.toLocaleDateString();
};

const isVideoUrl = (url: string) => url?.match(/\.(mp4|webm|ogg|mov)(\?.*)?$/i) !== null;

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

export default function Feeds() {
  const { user } = useTenant();
  const navigate = useNavigate();
  const { setHideBottomNav } = useOutletContext<any>() || {};
  
  // Get the user's role to determine if they can post
  const userRole = user?.role || 'tourist';
  
  const [postText, setPostText] = useState('');
  const [isPosting, setIsPosting] = useState(false);
  const [posts, setPosts] = useState<any[]>([]);
  const [isRefreshing, setIsRefreshing] = useState(false);

  // Live Stories State
  const [stories, setStories] = useState<any[]>([]);
  const [isUploadingStory, setIsUploadingStory] = useState(false);
  const storyInputRef = useRef<HTMLInputElement>(null);

  const [editingPostId, setEditingPostId] = useState<string | null>(null);
  const [editContent, setEditContent] = useState('');
  const [activeMenuId, setActiveMenuId] = useState<string | null>(null);
  
  const [expandedComments, setExpandedComments] = useState<Record<string, boolean>>({});
  const [commentInputs, setCommentInputs] = useState<Record<string, string>>({});
  const [editingCommentId, setEditingCommentId] = useState<string | null>(null);
  const [editCommentText, setEditCommentText] = useState('');

  const [mentionState, setMentionState] = useState<{ active: boolean, query: string, targetId: string }>({ active: false, query: '', targetId: '' });
  const [mentionResults, setMentionResults] = useState<any[]>([]);
  const [isSearchingMentions, setIsSearchingMentions] = useState(false);

  const [activeStoryIndex, setActiveStoryIndex] = useState<number | null>(null);
  const [storyCommentInput, setStoryCommentInput] = useState('');
  const [storyInteractions, setStoryInteractions] = useState<Record<string, { liked: boolean, reposted: boolean }>>({});

  const fileInputRef = useRef<HTMLInputElement>(null);
  const [selectedImage, setSelectedImage] = useState<File | null>(null);
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const editFileInputRef = useRef<HTMLInputElement>(null);
  const [editImagePreview, setEditImagePreview] = useState<string | null>(null);

  const [carouselIndexes, setCarouselIndexes] = useState<Record<string, number>>({});
  const [lightboxData, setLightboxData] = useState<{ urls: string[], index: number } | null>(null);

  const [pullStartY, setPullStartY] = useState(0);
  const [pullDistance, setPullDistance] = useState(0);
  const [isPulling, setIsPulling] = useState(false);

  // --- NEW: Auth Modal State ---
  const [isAuthModalOpen, setIsAuthModalOpen] = useState(false);
  const [authMessage, setAuthMessage] = useState('Join TeamUp');

  // --- SMART FETCH LOGIC ---
  const fetchFeedsAndStories = async (isManualRefresh = false) => {
    if (isManualRefresh) setIsRefreshing(true);
    try {
      // 1. Fetch Posts
      const { data: postData } = await supabase
        .from('posts')
        .select(`
          *, author:profiles(id, first_name, last_name, company, business_type, avatar_url, is_verified),
          likes(user_id), saved_posts(user_id), reposts(user_id),
          comments(id, content, created_at, user_id, user:profiles(company, first_name, last_name, avatar_url))
        `)
        .order('created_at', { ascending: false });

      if (postData) {
        const formattedPosts = postData.map(post => ({
          id: post.id,
          authorId: post.author_id,
          author: {
            id: post.author?.id,
            name: post.author?.company || `${post.author?.first_name} ${post.author?.last_name}`,
            type: post.author?.business_type?.split('_').map((w: string) => w.charAt(0).toUpperCase() + w.slice(1)).join(' ') || 'Partner',
            avatar: post.author?.avatar_url,
            verified: post.author?.is_verified || false
          },
          content: post.content,
          location: post.location,
          tags: post.tags,
          media_urls: post.media_urls || (post.image_urls ? post.image_urls : []), 
          timestamp: timeAgo(post.created_at),
          likes: post.likes ? post.likes.length : 0,
          isLiked: post.likes ? post.likes.some((like: any) => like.user_id === user?.id) : false,
          isSaved: post.saved_posts ? post.saved_posts.some((save: any) => save.user_id === user?.id) : false,
          reposts: post.reposts ? post.reposts.length : 0,
          isReposted: post.reposts ? post.reposts.some((repost: any) => repost.user_id === user?.id) : false,
          comments: post.comments ? post.comments.length : 0,
          commentsList: post.comments ? post.comments.sort((a: any, b: any) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime()) : []
        }));
        setPosts(formattedPosts); 
      }

      // 2. Fetch Active Stories (Expires > NOW)
      const { data: storyData } = await supabase
        .from('stories')
        .select('*, author:profiles(id, company, first_name, last_name, avatar_url)')
        .gt('expires_at', new Date().toISOString())
        .order('created_at', { ascending: true });
        
      if (storyData) {
        // Group stories by user so each bubble has an array of media
        const grouped = storyData.reduce((acc: any, curr: any) => {
          const authorId = curr.user_id;
          if (!acc[authorId]) {
            acc[authorId] = {
              id: authorId,
              author: curr.author?.company || `${curr.author?.first_name} ${curr.author?.last_name}`,
              avatar: curr.author?.avatar_url,
              items: [],
              hasUnread: true // Can be sophisticated later
            };
          }
          acc[authorId].items.push(curr.media_url);
          return acc;
        }, {});
        
        setStories(Object.values(grouped));
      }

    } catch (error) { console.error("Error fetching feeds:", error); } finally { if (isManualRefresh) setIsRefreshing(false); }
  };

  useEffect(() => {
    fetchFeedsAndStories();
  }, []);

  // --- STORY UPLOAD LOGIC ---
  const handleStoryUploadSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !user) return;

    setIsUploadingStory(true);
    try {
      const fileExt = file.name.split('.').pop();
      const fileName = `${user.id}-${Math.random().toString(36).substring(2, 15)}.${fileExt}`;
      
      const { error: uploadError } = await supabase.storage.from('stories').upload(fileName, file);
      if (uploadError) throw uploadError;

      const { data: { publicUrl } } = supabase.storage.from('stories').getPublicUrl(fileName);

      const { error: dbError } = await supabase.from('stories').insert([{ user_id: user.id, media_url: publicUrl }]);
      if (dbError) throw dbError;

      fetchFeedsAndStories(true); // Refresh feed
    } catch (err) {
      alert("Failed to upload story.");
      console.error(err);
    } finally {
      setIsUploadingStory(false);
      if (storyInputRef.current) storyInputRef.current.value = '';
    }
  };

  // --- LIVE DB MENTION SEARCH ---
  useEffect(() => {
    const searchUsers = async () => {
      if (!mentionState.active || mentionState.query.length < 1) {
        setMentionResults([]);
        return;
      }
      setIsSearchingMentions(true);
      try {
        const { data, error } = await supabase
          .from('profiles')
          .select('id, company, first_name, last_name, avatar_url')
          .or(`company.ilike.%${mentionState.query}%,first_name.ilike.%${mentionState.query}%`)
          .limit(5);
        if (!error && data) setMentionResults(data);
      } catch (err) {
        console.error(err);
      } finally {
        setIsSearchingMentions(false);
      }
    };
    const timer = setTimeout(searchUsers, 300);
    return () => clearTimeout(timer);
  }, [mentionState.query, mentionState.active]);

  // --- PULL TO REFRESH ---
  const handleTouchStart = (e: React.TouchEvent) => {
    if (window.scrollY === 0) {
      setPullStartY(e.touches[0].clientY);
      setIsPulling(true);
    }
  };

  const handleTouchMove = (e: React.TouchEvent) => {
    if (!isPulling) return;
    const y = e.touches[0].clientY;
    const distance = y - pullStartY;
    if (distance > 0) setPullDistance(Math.min(distance * 0.4, 80)); 
  };

  const handleTouchEnd = () => {
    if (!isPulling) return;
    if (pullDistance > 50 && !isRefreshing) fetchFeedsAndStories(true);
    setIsPulling(false);
    setPullDistance(0);
  };

  // --- INTERACTION LOGIC ---
  const toggleRepost = async (postId: string) => {
    if (!user) {
      setAuthMessage("Sign in to repost!");
      setIsAuthModalOpen(true);
      return;
    }

    const post = posts.find(p => p.id === postId); 
    if (!post) return;

    const isCurrentlyReposted = post.isReposted;
    
    // Optimistic UI update for the original post's repost counter
    setPosts(posts.map(p => p.id === postId ? { 
      ...p, 
      isReposted: !isCurrentlyReposted, 
      reposts: isCurrentlyReposted ? Math.max(0, p.reposts - 1) : p.reposts + 1 
    } : p));

    try {
      if (isCurrentlyReposted) {
        // Undo the repost engagement
        await supabase.from('reposts').delete().match({ post_id: postId, user_id: user.id });
      } else {
        // 1. Record the repost engagement on the original post
        await supabase.from('reposts').insert({ post_id: postId, user_id: user.id });
        
        // 2. Format the author's tag (stripping spaces so it formats properly as a single @mention)
        const authorTag = `@${post.author.name.replace(/\s+/g, '')}`;
        
        // 3. Construct the new content
        const repostContent = `♻️ Reposted from ${authorTag}\n\n${post.content || ''}`;
        
        // 4. Merge existing tags with the new author tag
        const existingTags = post.tags || [];
        const newTags = existingTags.includes(authorTag) ? existingTags : [...existingTags, authorTag];

        // 5. Create the new post in the feed, carrying over their media
        await supabase.from('posts').insert([{ 
          author_id: user.id, 
          content: repostContent.trim(), 
          media_urls: post.media_urls,
          tags: newTags
        }]);
        
        // 6. Refresh the feed so the new post appears immediately at the top
        fetchFeedsAndStories(true);
      }
    } catch (error) { 
      console.error("Failed to repost:", error);
      // Revert UI if the database transaction fails
      fetchFeedsAndStories(); 
    }
  };

  const handleCommentChange = (e: React.ChangeEvent<HTMLInputElement>, targetId: string) => {
    const text = e.target.value;
    if (targetId === 'story') setStoryCommentInput(text);
    else setCommentInputs(prev => ({ ...prev, [targetId]: text }));

    const words = text.split(' ');
    const lastWord = words[words.length - 1];
    if (lastWord.startsWith('@')) setMentionState({ active: true, query: lastWord.slice(1).toLowerCase(), targetId });
    else setMentionState({ active: false, query: '', targetId: '' });
  };

  const insertMention = (userName: string) => {
    const targetId = mentionState.targetId;
    const isStory = targetId === 'story';
    const currentText = isStory ? storyCommentInput : commentInputs[targetId] || '';
    const words = currentText.split(' ');
    words.pop(); 
    const newText = [...words, `@${userName.replace(/\s+/g, '')} `].join(' ').trimStart();
    if (isStory) setStoryCommentInput(newText);
    else setCommentInputs(prev => ({ ...prev, [targetId]: newText }));
    setMentionState({ active: false, query: '', targetId: '' });
  };

  const handleCreateComment = async (postId: string) => {
    if (!user) {
      setAuthMessage("Sign in to comment!");
      setIsAuthModalOpen(true);
      return;
    }
    const content = commentInputs[postId];
    if (!content?.trim()) return;
    
    try {
      await supabase.from('comments').insert([{ post_id: postId, user_id: user.id, content: content.trim() }]);
      setCommentInputs(prev => ({ ...prev, [postId]: '' })); 
      fetchFeedsAndStories(true);
    } catch (error) { alert("Failed to post comment."); }
  };

  const handleUpdateComment = async (commentId: string) => {
    if (!editCommentText.trim()) return;
    try {
      await supabase.from('comments').update({ content: editCommentText.trim() }).eq('id', commentId);
      setEditingCommentId(null); setEditCommentText(''); fetchFeedsAndStories(true);
    } catch (error) { alert("Failed to update comment."); }
  };

  const handleDeleteComment = async (commentId: string) => {
    if (!window.confirm("Delete this comment?")) return;
    try { await supabase.from('comments').delete().eq('id', commentId); fetchFeedsAndStories(true); } 
    catch (error) { alert("Failed to delete comment."); }
  };

  const handleCreatePost = async () => {
    if ((!postText.trim() && !selectedImage) || !user) return;
    setIsPosting(true);
    try {
      let uploadedUrls: string[] = [];
      if (selectedImage) {
        const fileExt = selectedImage.name.split('.').pop();
        const fileName = `${user.id}-${Math.random().toString(36).substring(2, 15)}.${fileExt}`;
        const { error: uploadError } = await supabase.storage.from('posts').upload(fileName, selectedImage);
        if (uploadError) throw uploadError;
        const { data: { publicUrl } } = supabase.storage.from('posts').getPublicUrl(fileName);
        uploadedUrls.push(publicUrl);
      }
      await supabase.from('posts').insert([{ author_id: user.id, content: postText.trim(), media_urls: uploadedUrls.length > 0 ? uploadedUrls : null }]);
      setPostText(''); setSelectedImage(null); setImagePreview(null); 
      if (fileInputRef.current) fileInputRef.current.value = '';
      fetchFeedsAndStories(true); 
    } catch (error) { console.error(error); alert("Failed to publish post."); } 
    finally { setIsPosting(false); }
  };

  const handleDeletePost = async (postId: string) => {
    if (!window.confirm("Are you sure you want to delete this post?")) return;
    setPosts(posts.filter(p => p.id !== postId));
    try { await supabase.from('posts').delete().eq('id', postId); } catch (error) { fetchFeedsAndStories(); }
  };

  const startEditing = (post: any) => {
    setEditingPostId(post.id); setEditContent(post.content);
    setEditImagePreview(post.media_urls?.[0] || null);
    setActiveMenuId(null);
  };

  const handleUpdatePost = async (postId: string) => {
    if (!editContent.trim() && !editImagePreview) return;
    try {
      await supabase.from('posts').update({ content: editContent.trim() }).eq('id', postId);
      setPosts(posts.map(p => p.id === postId ? { ...p, content: editContent.trim() } : p));
      setEditingPostId(null); setEditContent(''); setEditImagePreview(null);
    } catch (error) { alert("Failed to update post."); }
  };

  const handleImageSelect = (e: React.ChangeEvent<HTMLInputElement>, isEdit = false) => {
    const file = e.target.files?.[0];
    if (file) {
      const url = URL.createObjectURL(file);
      if (isEdit) setEditImagePreview(url);
      else { setSelectedImage(file); setImagePreview(url); }
    }
  };

  const removeImage = (isEdit = false) => {
    if (isEdit) { 
      setEditImagePreview(null); 
      if (editFileInputRef.current) editFileInputRef.current.value = ''; 
    } else { 
      if (imagePreview) URL.revokeObjectURL(imagePreview);
      setSelectedImage(null); setImagePreview(null); 
      if (fileInputRef.current) fileInputRef.current.value = ''; 
    }
  };

  const handleShare = async (urlSuffix: string = '') => {
    const shareUrl = `${window.location.origin}/feeds${urlSuffix}`; 
    if (navigator.share) { try { await navigator.share({ title: 'TeamUp Network', url: shareUrl }); } catch (error) {} } 
    else { navigator.clipboard.writeText(shareUrl); alert('Link copied to clipboard!'); }
  };

  const toggleLike = async (postId: string) => {
    if (!user) {
      setAuthMessage("Sign in to like posts!");
      setIsAuthModalOpen(true);
      return;
    }
    const post = posts.find(p => p.id === postId); if (!post) return;
    const isCurrentlyLiked = post.isLiked;
    setPosts(posts.map(p => p.id === postId ? { ...p, isLiked: !isCurrentlyLiked, likes: isCurrentlyLiked ? p.likes - 1 : p.likes + 1 } : p));
    try {
      if (isCurrentlyLiked) await supabase.from('likes').delete().match({ post_id: postId, user_id: user.id });
      else await supabase.from('likes').insert({ post_id: postId, user_id: user.id });
    } catch (error) { fetchFeedsAndStories(); } 
  };

  const toggleSave = async (postId: string) => {
    if (!user) {
      setAuthMessage("Sign in to save posts!");
      setIsAuthModalOpen(true);
      return;
    }
    const post = posts.find(p => p.id === postId); if (!post) return;
    const isCurrentlySaved = post.isSaved;
    setPosts(posts.map(p => p.id === postId ? { ...p, isSaved: !isCurrentlySaved } : p));
    try {
      if (isCurrentlySaved) await supabase.from('saved_posts').delete().match({ post_id: postId, user_id: user.id });
      else await supabase.from('saved_posts').insert({ post_id: postId, user_id: user.id });
    } catch (error) { fetchFeedsAndStories(); } 
  };

  const toggleStoryInteraction = (storyId: string, type: 'liked' | 'reposted') => {
    if (!user) {
      setAuthMessage("Sign in to interact with stories!");
      setIsAuthModalOpen(true);
      return;
    }
    setStoryInteractions(prev => {
      const current = prev[storyId] || { liked: false, reposted: false };
      return { ...prev, [storyId]: { ...current, [type]: !current[type] } };
    });
  };

  const handleStoryTap = (e: React.MouseEvent, direction: 'prev' | 'next') => {
    e.stopPropagation();
    if (activeStoryIndex === null) return;
    if (direction === 'prev') {
      setActiveStoryIndex(Math.max(0, activeStoryIndex - 1));
    } else {
      if (activeStoryIndex === stories.length - 1) setActiveStoryIndex(null); 
      else setActiveStoryIndex(activeStoryIndex + 1);
    }
  };

  useEffect(() => {
    const handleClickOutside = () => setActiveMenuId(null);
    document.addEventListener('click', handleClickOutside);
    return () => document.removeEventListener('click', handleClickOutside);
  }, []);

  useEffect(() => {
    if (activeStoryIndex !== null) {
      if (setHideBottomNav) setHideBottomNav(true);
      document.body.style.overflow = 'hidden';
    } else {
      if (setHideBottomNav) setHideBottomNav(false);
      document.body.style.overflow = '';
      setStoryCommentInput('');
    }
    return () => {
      if (setHideBottomNav) setHideBottomNav(false);
      document.body.style.overflow = '';
    };
  }, [activeStoryIndex, setHideBottomNav]);

  return (
    <div 
      className="space-y-6 pb-24 animate-in fade-in duration-500 relative"
      onTouchStart={handleTouchStart}
      onTouchMove={handleTouchMove}
      onTouchEnd={handleTouchEnd}
    >
      {/* PULL TO REFRESH INDICATOR */}
      <div 
        className="w-full flex justify-center items-center overflow-hidden transition-all duration-300 ease-out"
        style={{ height: isRefreshing ? '60px' : `${isPulling ? pullDistance : 0}px`, opacity: (pullDistance > 10 || isRefreshing) ? 1 : 0 }}
      >
        <div className="bg-[#e0e5ec] p-2.5 rounded-full shadow-[3px_3px_6px_#a3b1c6,-3px_-3px_6px_#ffffff] flex items-center justify-center">
          <RefreshCw size={20} className={`text-[#1da1f2] ${isRefreshing ? 'animate-spin' : ''}`} style={{ transform: isRefreshing ? 'none' : `rotate(${pullDistance * 5}deg)` }} />
        </div>
      </div>
      
      {/* 0. LIVE STORIES SECTION */}
      <div className="flex items-center gap-4 overflow-x-auto scrollbar-hide pb-4 pt-2 -mx-2 px-2">
        {/* ADD STORY BUTTON - HIDDEN FOR TOURISTS */}
        {userRole !== 'tourist' && (
          <div className="flex flex-col items-center gap-2 shrink-0 cursor-pointer group" onClick={() => storyInputRef.current?.click()}>
            <input type="file" accept="image/*,video/*" ref={storyInputRef} onChange={handleStoryUploadSelect} className="hidden" />
            <div className="w-16 h-16 rounded-full border-4 border-[#e0e5ec] shadow-[5px_5px_10px_#a3b1c6,-5px_-5px_10px_#ffffff] bg-[#d1d8e0] flex items-center justify-center relative transition-transform group-hover:scale-105">
              {isUploadingStory ? <Loader2 size={24} className="text-[#1da1f2] animate-spin" /> : <Building2 size={24} className="text-slate-400" />}
              {!isUploadingStory && (
                <div className="absolute bottom-0 right-0 w-5 h-5 bg-[#1da1f2] rounded-full border-2 border-[#e0e5ec] flex items-center justify-center text-white shadow-sm">
                  <Plus size={12} strokeWidth={4} />
                </div>
              )}
            </div>
            <span className="text-[10px] font-bold text-slate-600">Your Story</span>
          </div>
        )}

        {/* MAPPED DB STORIES */}
        {stories.map((story, index) => (
          <div key={story.id} onClick={() => setActiveStoryIndex(index)} className="flex flex-col items-center gap-2 shrink-0 cursor-pointer group">
            {/* BLUE GRADIENT RING */}
            <div className={`w-16 h-16 rounded-full p-[3px] transition-transform group-hover:scale-105 ${story.hasUnread ? 'bg-gradient-to-tr from-blue-400 via-[#1da1f2] to-indigo-500' : 'bg-slate-300'}`}>
              <div className="w-full h-full rounded-full border-2 border-[#e0e5ec] bg-[#e0e5ec] overflow-hidden">
                <img src={story.avatar || `https://ui-avatars.com/api/?name=${story.author}`} alt={story.author} className="w-full h-full object-cover" />
              </div>
            </div>
            <span className="text-[10px] font-bold text-slate-600 truncate w-16 text-center">{story.author.split(' ')[0]}</span>
          </div>
        ))}
      </div>

      {/* 1. CREATE POST INPUT - HIDDEN FOR TOURISTS */}
      {userRole !== 'tourist' && (
        <div className="relative z-10 mb-2">
          <div className="bg-[#e0e5ec] rounded-3xl p-5 md:p-6 shadow-[9px_9px_16px_rgba(163,177,198,0.5),-9px_-9px_16px_rgba(0,0,0,0.1)]">
            <div className="flex gap-4">
              <div className="w-12 h-12 shrink-0 rounded-full border-4 border-[#e0e5ec] shadow-[3px_3px_6px_#a3b1c6,-3px_-3px_6px_#ffffff] overflow-hidden bg-[#d1d8e0] flex items-center justify-center cursor-pointer" onClick={() => navigate(`/profile/${user?.id}`)}>
                {user?.avatarUrl ? <img src={user.avatarUrl} className="w-full h-full object-cover" /> : <Building2 size={20} className="text-slate-400" />}
              </div>
              <div className="flex-1 space-y-4">
                <div className="relative">
                  <textarea 
                    value={postText} onChange={(e) => setPostText(e.target.value)} disabled={isPosting}
                    placeholder="Broadcast an RFP or share an update with the network..." 
                    className="w-full bg-[#e0e5ec] text-sm font-medium text-slate-700 placeholder:text-slate-400 rounded-2xl py-4 px-5 shadow-[inset_3px_3px_6px_#a3b1c6,inset_-3px_-3px_6px_#ffffff] focus:outline-none resize-none min-h-[80px]"
                  />
                </div>
                {imagePreview && (
                  <div className="relative w-32 h-32 rounded-2xl overflow-hidden shadow-[inset_3px_3px_6px_#a3b1c6,inset_-3px_-3px_6px_#ffffff] border-4 border-[#e0e5ec]">
                    {isVideoUrl(selectedImage?.name || '') ? (
                      <video src={imagePreview} className="w-full h-full object-cover opacity-80" />
                    ) : (
                      <img src={imagePreview} alt="Preview" className="w-full h-full object-cover" />
                    )}
                    <button onClick={() => removeImage(false)} className="absolute top-2 right-2 p-1 bg-slate-900/50 backdrop-blur text-white rounded-full hover:bg-rose-500 transition-colors"><X size={14} /></button>
                  </div>
                )}
                <div className="flex items-center justify-between pt-1">
                  <input type="file" ref={fileInputRef} onChange={(e) => handleImageSelect(e, false)} accept="image/*,video/*" className="hidden" />
                  <button onClick={() => fileInputRef.current?.click()} className="flex items-center gap-2 px-4 py-2 rounded-xl text-slate-500 font-bold text-xs hover:text-[#1da1f2] hover:shadow-[inset_2px_2px_4px_#a3b1c6,inset_-2px_-2px_4px_#ffffff] transition-all"><ImageIcon size={16} /> <span className="hidden sm:inline">Attach Media</span></button>
                  <button disabled={(!postText.trim() && !selectedImage) || isPosting} onClick={handleCreatePost} className="flex items-center gap-2 px-6 py-2.5 bg-[#1da1f2] text-white rounded-xl font-bold text-sm shadow-[3px_3px_6px_#a3b1c6,-3px_-3px_6px_#ffffff] hover:bg-[#1a91da] active:shadow-[inset_3px_3px_6px_rgba(0,0,0,0.2)] transition-all disabled:opacity-50">
                    {isPosting ? <Loader2 size={14} className="animate-spin" /> : <>Post <Send size={14} /></>}
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* 2. THE FEED */}
      <div className={`space-y-6 ${userRole === 'tourist' ? 'mt-2' : 'mt-4'}`}>
        {posts.map((post) => {
          const carouselIndex = carouselIndexes[post.id] || 0;
          const hasMedia = post.media_urls && post.media_urls.length > 0;
          const hasTags = post.tags && post.tags.length > 0;

          // Check if author has an active story
          const authorHasStory = stories.some(s => s.id === post.authorId);

          return (
            <div key={post.id} className="bg-[#e0e5ec] rounded-3xl p-5 md:p-6 shadow-[9px_9px_16px_#a3b1c6,-9px_-9px_16px_#ffffff]">
              
              {/* Post Header */}
              <div className="flex justify-between items-start mb-4">
                <div className="flex items-center gap-3 cursor-pointer group" onClick={() => navigate(`/profile/${post.authorId}`)}>
                  {/* STORY GRADIENT RING IN FEED */}
                  <div className={`rounded-full p-[2.5px] ${authorHasStory ? 'bg-gradient-to-tr from-blue-400 via-[#1da1f2] to-indigo-500' : 'bg-transparent'}`}>
                    <div className="w-11 h-11 rounded-full shadow-[inset_2px_2px_4px_#a3b1c6,inset_-2px_-2px_4px_#ffffff] border-2 border-[#e0e5ec] bg-[#d1d8e0] flex items-center justify-center overflow-hidden">
                      {post.author.avatar ? <img src={post.author.avatar} alt="Avatar" className="w-full h-full object-cover" /> : <Building2 size={18} className="text-slate-400" />}
                    </div>
                  </div>
                  <div>
                    <h4 className="text-sm font-black text-slate-800 flex items-center gap-1 group-hover:text-[#1da1f2] transition-colors">
                      {post.author.name} {post.author.verified && <Sparkles size={12} className="text-[#1da1f2]" />}
                    </h4>
                    <p className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">{post.author.type} • {post.timestamp}</p>
                  </div>
                </div>
                
                <div className="relative">
                  <button onClick={(e) => { e.stopPropagation(); setActiveMenuId(activeMenuId === post.id ? null : post.id); }} className="p-2 text-slate-400 hover:text-slate-700 rounded-full hover:shadow-[inset_2px_2px_4px_#a3b1c6,inset_-2px_-2px_4px_#ffffff] transition-all"><MoreHorizontal size={18} /></button>
                  {activeMenuId === post.id && (
                    <div className="absolute right-0 mt-2 w-48 bg-[#e0e5ec] rounded-2xl shadow-[9px_9px_16px_#a3b1c6,-9px_-9px_16px_#ffffff] border border-white/50 overflow-hidden z-50 animate-in fade-in slide-in-from-top-2 duration-200">
                      <ul className="py-2 text-sm text-slate-600 font-bold">
                        {user && (post.authorId === user.id || post.author.name === user.company) ? (
                          <>
                            <li onClick={() => startEditing(post)} className="px-4 py-2.5 hover:bg-[#d1d8e0] cursor-pointer flex items-center gap-3"><Edit2 size={16} /> Edit Post</li>
                            <li onClick={() => handleDeletePost(post.id)} className="px-4 py-2.5 hover:bg-[#d1d8e0] text-rose-500 cursor-pointer flex items-center gap-3"><Trash2 size={16} /> Delete Post</li>
                          </>
                        ) : (
                          <li className="px-4 py-2.5 hover:bg-[#d1d8e0] text-rose-500 cursor-pointer flex items-center gap-3"><AlertTriangle size={16} /> Report Post</li>
                        )}
                        <div className="h-px bg-slate-300/50 my-1"></div>
                        <li onClick={() => handleShare(`/post/${post.id}`)} className="px-4 py-2.5 hover:bg-[#d1d8e0] cursor-pointer flex items-center gap-3"><LinkIcon size={16} /> Copy Link</li>
                      </ul>
                    </div>
                  )}
                </div>
              </div>

              {post.location && (
                <div className="flex items-center gap-1 text-[11px] font-black text-[#1da1f2] uppercase tracking-wider mb-2">
                  <MapPin size={12} /> {post.location}
                </div>
              )}

              {/* Post Content */}
              {editingPostId === post.id ? (
                <div className="mb-4 space-y-3 animate-in fade-in">
                  <textarea value={editContent} onChange={(e) => setEditContent(e.target.value)} className="w-full bg-[#e0e5ec] text-sm font-medium text-slate-700 rounded-2xl py-3 px-4 shadow-[inset_3px_3px_6px_#a3b1c6,inset_-3px_-3px_6px_#ffffff] focus:outline-none resize-none min-h-[80px]" />
                  {editImagePreview && (
                    <div className="relative w-32 h-32 rounded-2xl overflow-hidden shadow-[inset_3px_3px_6px_#a3b1c6,inset_-3px_-3px_6px_#ffffff] border-4 border-[#e0e5ec]">
                      <img src={editImagePreview} alt="Preview" className="w-full h-full object-cover" />
                      <button onClick={() => removeImage(true)} className="absolute top-2 right-2 p-1 bg-slate-900/50 backdrop-blur text-white rounded-full hover:bg-rose-500 transition-colors"><X size={14} /></button>
                    </div>
                  )}
                  <div className="flex justify-between items-center">
                    <input type="file" ref={editFileInputRef} onChange={(e) => handleImageSelect(e, true)} accept="image/*,video/*" className="hidden" />
                    <button onClick={() => editFileInputRef.current?.click()} className="flex items-center gap-2 px-4 py-2 rounded-xl text-slate-500 font-bold text-xs hover:text-[#1da1f2] hover:shadow-[inset_2px_2px_4px_#a3b1c6,inset_-2px_-2px_4px_#ffffff] transition-all"><ImageIcon size={16} /> Update Media</button>
                    <div className="flex gap-3">
                      <button onClick={() => setEditingPostId(null)} className="px-5 py-2 rounded-xl text-xs font-bold text-slate-500 hover:text-slate-700 shadow-[3px_3px_6px_#a3b1c6,-3px_-3px_6px_#ffffff] active:shadow-[inset_2px_2px_4px_#a3b1c6,inset_-2px_-2px_4px_#ffffff] transition-all">Cancel</button>
                      <button onClick={() => handleUpdatePost(post.id)} className="px-5 py-2 rounded-xl text-xs font-bold bg-[#1da1f2] text-white shadow-[3px_3px_6px_#a3b1c6,-3px_-3px_6px_#ffffff] hover:bg-[#1a91da] transition-all">Save Changes</button>
                    </div>
                  </div>
                </div>
              ) : (
                <div className="mb-4"><p className="text-sm text-slate-700 leading-relaxed whitespace-pre-wrap">{post.content}</p></div>
              )}

              {/* --- MEDIA CAROUSEL --- */}
              {hasMedia && !editingPostId && (
                <div className="relative mb-4 rounded-2xl overflow-hidden bg-slate-900 shadow-[inset_3px_3px_6px_#a3b1c6,inset_-3px_-3px_6px_#ffffff] border-4 border-[#e0e5ec] group">
                  <div className="relative aspect-video flex items-center justify-center cursor-pointer" onClick={() => setLightboxData({ urls: post.media_urls, index: carouselIndex })}>
                    {isVideoUrl(post.media_urls[carouselIndex]) ? (
                      <video src={post.media_urls[carouselIndex]} controls className="w-full h-full object-cover" onClick={(e) => e.stopPropagation()} />
                    ) : (
                      <img src={post.media_urls[carouselIndex]} className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-105" alt="Post media" />
                    )}
                  </div>
                  
                  {hasTags && (
                    <div className="absolute bottom-3 left-3 bg-black/50 backdrop-blur-md px-2 py-1.5 rounded-lg flex items-center justify-center text-white/90 shadow-md">
                      <Tag size={14} className="fill-white/20" />
                    </div>
                  )}

                  {post.media_urls.length > 1 && (
                    <>
                      <button onClick={(e) => { e.stopPropagation(); setCarouselIndexes(prev => ({ ...prev, [post.id]: prev[post.id] ? prev[post.id] - 1 : post.media_urls.length - 1 })); }} className="absolute left-2 top-1/2 -translate-y-1/2 w-8 h-8 rounded-full bg-black/50 text-white flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity hover:bg-black/70">
                        <ChevronLeft size={16} />
                      </button>
                      <button onClick={(e) => { e.stopPropagation(); setCarouselIndexes(prev => ({ ...prev, [post.id]: ((prev[post.id] || 0) + 1) % post.media_urls.length })); }} className="absolute right-2 top-1/2 -translate-y-1/2 w-8 h-8 rounded-full bg-black/50 text-white flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity hover:bg-black/70">
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

              {/* Tags */}
              {hasTags && (
                <div className="flex flex-wrap gap-2 mb-4">
                  {post.tags.map((tag: string, idx: number) => (
                    <span key={idx} className="px-3 py-1 bg-indigo-50 border border-indigo-100 text-indigo-600 text-[11px] font-black rounded-full cursor-pointer hover:bg-indigo-100 transition-colors">
                      {tag.startsWith('@') ? tag : `@${tag}`}
                    </span>
                  ))}
                </div>
              )}

              {/* Footer Actions */}
              <div className="flex items-center justify-between pt-4 border-t border-slate-300/50">
                <div className="flex gap-2">
                  <button onClick={() => toggleLike(post.id)} className={`flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-bold transition-all ${post.isLiked ? 'text-rose-500 shadow-[inset_2px_2px_4px_#a3b1c6,inset_-2px_-2px_4px_#ffffff]' : 'text-slate-500 hover:text-rose-500 hover:shadow-[3px_3px_6px_#a3b1c6,-3px_-3px_6px_#ffffff]'}`}>
                    <Heart size={16} className={post.isLiked ? "fill-rose-500" : ""} /> {post.likes}
                  </button>
                  <button onClick={() => setExpandedComments(prev => ({ ...prev, [post.id]: !prev[post.id] }))} className={`flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-bold transition-all ${expandedComments[post.id] ? 'text-[#1da1f2] shadow-[inset_2px_2px_4px_#a3b1c6,inset_-2px_-2px_4px_#ffffff]' : 'text-slate-500 hover:text-[#1da1f2] hover:shadow-[3px_3px_6px_#a3b1c6,-3px_-3px_6px_#ffffff]'}`}>
                    <MessageCircle size={16} /> {post.comments}
                  </button>
                  <button onClick={() => toggleRepost(post.id)} className={`flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-bold transition-all ${post.isReposted ? 'text-green-500 shadow-[inset_2px_2px_4px_#a3b1c6,inset_-2px_-2px_4px_#ffffff]' : 'text-slate-500 hover:text-green-500 hover:shadow-[3px_3px_6px_#a3b1c6,-3px_-3px_6px_#ffffff]'}`}>
                    <Repeat size={16} className={post.isReposted ? "text-green-500" : ""} /> {post.reposts || 0}
                  </button>
                </div>
                <div className="flex gap-2">
                  <button onClick={() => handleShare()} className="p-2 text-slate-500 hover:text-teal-500 rounded-xl hover:shadow-[3px_3px_6px_#a3b1c6,-3px_-3px_6px_#ffffff] transition-all"><Share2 size={16} /></button>
                  <button onClick={() => toggleSave(post.id)} className={`p-2 rounded-xl transition-all ${post.isSaved ? 'text-indigo-500 shadow-[inset_2px_2px_4px_#a3b1c6,inset_-2px_-2px_4px_#ffffff]' : 'text-slate-500 hover:text-indigo-500 hover:shadow-[3px_3px_6px_#a3b1c6,-3px_-3px_6px_#ffffff]'}`}>
                    <Bookmark size={16} className={post.isSaved ? "fill-indigo-500" : ""} />
                  </button>
                </div>
              </div>

              {/* COMMENTS */}
              {expandedComments[post.id] && (
                <div className="mt-4 pt-4 border-t border-slate-300/50 space-y-4 animate-in slide-in-from-top-2 duration-300">
                  {post.commentsList?.map((comment: any) => (
                    <div key={comment.id} className="flex gap-3 group/comment">
                      <div className="w-8 h-8 rounded-full bg-[#d1d8e0] shadow-[inset_2px_2px_4px_#a3b1c6,inset_-2px_-2px_4px_#ffffff] overflow-hidden shrink-0 cursor-pointer" onClick={() => navigate(`/profile/${comment.user_id}`)}>
                        {comment.user?.avatar_url ? <img src={comment.user.avatar_url} className="w-full h-full object-cover" /> : <Building2 size={14} className="m-2 text-slate-400" />}
                      </div>
                      <div className="flex-1">
                        {editingCommentId === comment.id ? (
                          <div className="flex gap-2 bg-[#e0e5ec] shadow-[inset_3px_3px_6px_#a3b1c6,inset_-3px_-3px_6px_#ffffff] rounded-2xl rounded-tl-none p-2">
                            <input 
                              value={editCommentText} onChange={(e) => setEditCommentText(e.target.value)}
                              className="flex-1 bg-transparent text-xs font-medium text-slate-700 focus:outline-none" autoFocus
                            />
                            <button onClick={() => handleUpdateComment(comment.id)} className="text-[#1da1f2] p-1"><Send size={12} /></button>
                            <button onClick={() => setEditingCommentId(null)} className="text-slate-400 p-1"><X size={12} /></button>
                          </div>
                        ) : (
                          <div className="bg-[#e0e5ec] shadow-[inset_3px_3px_6px_#a3b1c6,inset_-3px_-3px_6px_#ffffff] rounded-2xl rounded-tl-none p-3">
                            <div className="flex justify-between items-baseline mb-1">
                              <span className="text-xs font-bold text-slate-800 cursor-pointer hover:underline" onClick={() => navigate(`/profile/${comment.user_id}`)}>
                                {comment.user?.company || `${comment.user?.first_name} ${comment.user?.last_name}`}
                              </span>
                              <div className="flex items-center gap-2">
                                <span className="text-[9px] font-bold text-slate-400">{timeAgo(comment.created_at)}</span>
                                {user && comment.user_id === user.id && (
                                  <div className="opacity-0 group-hover/comment:opacity-100 transition-opacity flex gap-2">
                                    <button onClick={() => { setEditingCommentId(comment.id); setEditCommentText(comment.content); }} className="text-slate-400 hover:text-[#1da1f2]"><Edit2 size={10} /></button>
                                    <button onClick={() => handleDeleteComment(comment.id)} className="text-slate-400 hover:text-rose-500"><Trash2 size={10} /></button>
                                  </div>
                                )}
                              </div>
                            </div>
                            <p className="text-xs text-slate-600 leading-relaxed">
                              {comment.content.split(' ').map((word: string, i: number) => word.startsWith('@') ? <span key={i} className="text-[#1da1f2] font-bold">{word} </span> : `${word} `)}
                            </p>
                          </div>
                        )}
                      </div>
                    </div>
                  ))}
                  
                  <div className="flex gap-3 items-end pt-2 relative">
                    <div className="w-8 h-8 rounded-full bg-[#d1d8e0] shadow-[inset_2px_2px_4px_#a3b1c6,inset_-2px_-2px_4px_#ffffff] overflow-hidden shrink-0 hidden sm:flex items-center justify-center cursor-pointer" onClick={() => navigate(`/profile/${user?.id}`)}>
                      {user?.avatarUrl ? <img src={user.avatarUrl} className="w-full h-full object-cover" /> : <Building2 size={14} className="text-slate-400" />}
                    </div>
                    <div className="flex-1 relative">
                      <input 
                        type="text" value={commentInputs[post.id] || ''} onChange={(e) => handleCommentChange(e, post.id)} onKeyDown={(e) => { if (e.key === 'Enter') handleCreateComment(post.id); }}
                        placeholder="Write a comment... (Type @ to mention)"
                        className="w-full bg-[#e0e5ec] text-xs font-medium text-slate-700 placeholder:text-slate-400 rounded-full py-3 px-4 shadow-[inset_3px_3px_6px_#a3b1c6,inset_-3px_-3px_6px_#ffffff] focus:outline-none pr-12"
                      />
                      <button onClick={() => handleCreateComment(post.id)} disabled={!commentInputs[post.id]?.trim()} className="absolute right-1.5 top-1.5 bottom-1.5 w-8 rounded-full bg-[#1da1f2] text-white flex items-center justify-center shadow-sm disabled:opacity-50 transition-all hover:bg-[#1a91da]"><Send size={12} className="ml-0.5" /></button>
                      
                      {mentionState.active && mentionState.targetId === post.id && (
                        <div className="absolute bottom-full left-0 mb-2 w-56 bg-[#e0e5ec] rounded-2xl shadow-[0_-10px_20px_rgba(163,177,198,0.5)] border border-white/50 overflow-hidden z-50 p-1">
                          {isSearchingMentions ? (
                            <div className="p-3 flex justify-center"><Loader2 size={14} className="animate-spin text-[#1da1f2]" /></div>
                          ) : mentionResults.length > 0 ? (
                            mentionResults.map(pUser => {
                              const displayName = pUser.company || `${pUser.first_name} ${pUser.last_name}`;
                              return (
                                <div key={pUser.id} onClick={() => insertMention(displayName)} className="px-3 py-2 text-xs font-bold text-slate-700 hover:bg-[#d1d8e0] rounded-xl cursor-pointer transition-colors flex items-center gap-2">
                                  <div className="w-5 h-5 rounded-full bg-slate-300 overflow-hidden shrink-0">
                                    {pUser.avatar_url ? <img src={pUser.avatar_url} className="w-full h-full object-cover" /> : <Building2 size={10} className="m-auto h-full text-slate-500" />}
                                  </div>
                                  <span className="truncate">{displayName}</span>
                                </div>
                              );
                            })
                          ) : (
                            <div className="px-3 py-2 text-xs text-slate-500 text-center">No users found</div>
                          )}
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              )}

            </div>
          );
        })}
      </div>

      {lightboxData && (
        <Lightbox mediaUrls={lightboxData.urls} initialIndex={lightboxData.index} onClose={() => setLightboxData(null)} />
      )}

      {/* --- FULL-SCREEN STORY VIEWER --- */}
      {activeStoryIndex !== null && (
        <div className="fixed inset-0 z-[100] bg-slate-900/95 backdrop-blur-md flex items-center justify-center p-0 sm:p-6 animate-in fade-in zoom-in-95 duration-300">
          
          <div className="w-full h-full sm:max-w-md sm:h-[85vh] sm:rounded-[2.5rem] bg-black relative flex flex-col overflow-hidden shadow-2xl ring-1 ring-white/10">
            
            <div className="absolute top-0 left-0 right-0 z-20 p-4 pt-safe sm:pt-4 bg-gradient-to-b from-black/80 to-transparent flex items-center justify-between pointer-events-none">
              <div className="flex items-center gap-3 cursor-pointer pointer-events-auto" onClick={() => navigate(`/profile/${stories[activeStoryIndex].id}`)}>
                <img src={stories[activeStoryIndex].avatar || `https://ui-avatars.com/api/?name=${stories[activeStoryIndex].author}`} className="w-10 h-10 rounded-full border-2 border-white object-cover" />
                <div>
                  <h4 className="text-sm font-bold text-white shadow-sm hover:underline">{stories[activeStoryIndex].author}</h4>
                  <p className="text-[10px] font-bold text-white/70 uppercase">Just now</p>
                </div>
              </div>
              <button onClick={() => setActiveStoryIndex(null)} className="p-2 bg-white/10 backdrop-blur rounded-full text-white hover:bg-white/20 transition-colors pointer-events-auto">
                <X size={20} />
              </button>
            </div>

            <div className="flex-1 w-full bg-slate-900 relative flex items-center justify-center overflow-hidden">
              {isVideoUrl(stories[activeStoryIndex].items[0]) ? (
                <video src={stories[activeStoryIndex].items[0]} autoPlay className="w-full h-full object-cover relative z-0" />
              ) : (
                <img src={stories[activeStoryIndex].items[0]} className="w-full h-full object-cover relative z-0" />
              )}
              
              <div className="absolute inset-0 z-10 flex">
                <div className="w-1/2 h-full cursor-pointer" onClick={(e) => handleStoryTap(e, 'prev')} />
                <div className="w-1/2 h-full cursor-pointer" onClick={(e) => handleStoryTap(e, 'next')} />
              </div>
            </div>

            <div className="absolute bottom-0 left-0 right-0 z-20 p-4 pb-safe sm:pb-4 bg-gradient-to-t from-black/80 to-transparent">
              <div className="relative flex gap-3 items-end">
                <div className="flex-1 relative">
                  <input 
                    type="text" 
                    value={storyCommentInput}
                    onChange={(e) => handleCommentChange(e, 'story')}
                    placeholder="Reply... (@ to tag)"
                    className="w-full bg-white/10 backdrop-blur-md border border-white/20 text-white placeholder:text-white/60 rounded-full py-3 px-5 text-sm focus:outline-none focus:bg-white/20 transition-colors pr-10"
                  />
                  <button className="absolute right-1 top-1 bottom-1 w-8 rounded-full bg-white text-slate-900 flex items-center justify-center shadow-sm hover:bg-slate-200 transition-colors">
                    <Send size={14} className="ml-0.5" />
                  </button>

                  {mentionState.active && mentionState.targetId === 'story' && (
                    <div className="absolute bottom-full left-0 mb-2 w-56 bg-slate-800/90 backdrop-blur-md rounded-2xl shadow-xl border border-white/10 overflow-hidden z-50 p-1">
                      {isSearchingMentions ? (
                        <div className="p-3 flex justify-center"><Loader2 size={14} className="animate-spin text-white" /></div>
                      ) : mentionResults.length > 0 ? (
                        mentionResults.map(pUser => {
                          const displayName = pUser.company || `${pUser.first_name} ${pUser.last_name}`;
                          return (
                            <div key={pUser.id} onClick={() => insertMention(displayName)} className="px-3 py-2 text-xs font-bold text-white hover:bg-white/10 rounded-xl cursor-pointer transition-colors flex items-center gap-2">
                              <div className="w-5 h-5 rounded-full bg-slate-600 overflow-hidden shrink-0">
                                {pUser.avatar_url ? <img src={pUser.avatar_url} className="w-full h-full object-cover" /> : <Building2 size={10} className="m-auto h-full text-slate-300" />}
                              </div>
                              <span className="truncate">{displayName}</span>
                            </div>
                          );
                        })
                      ) : (
                        <div className="px-3 py-2 text-xs text-white/50 text-center">No users found</div>
                      )}
                    </div>
                  )}
                </div>
                
                <div className="flex items-center gap-1.5">
                  <button onClick={() => toggleStoryInteraction(stories[activeStoryIndex].id, 'liked')} className="p-2.5 rounded-full bg-white/10 backdrop-blur-md border border-white/20 text-white hover:bg-white/20 transition-colors">
                    <Heart size={18} className={storyInteractions[stories[activeStoryIndex].id]?.liked ? "fill-rose-500 text-rose-500" : ""} />
                  </button>
                  <button onClick={() => handleShare()} className="p-2.5 rounded-full bg-white/10 backdrop-blur-md border border-white/20 text-white hover:bg-white/20 transition-colors">
                    <Share2 size={18} />
                  </button>
                </div>
              </div>
            </div>

          </div>
        </div>
      )}

      {/* RENDER THE AUTH MODAL */}
      <AuthModal isOpen={isAuthModalOpen} onClose={() => setIsAuthModalOpen(false)} message={authMessage} />
    </div>
  );
}