import { useState, useEffect } from 'react';
import { Bookmark, Building2, Heart, MessageCircle, Share2, Loader2 } from 'lucide-react';
import { useTenant } from '../contexts/TenantContext';
import { supabase } from '../lib/supabase';

// Helper function to format timestamps nicely
const timeAgo = (dateString: string) => {
  const now = new Date();
  const past = new Date(dateString);
  const diffInMinutes = Math.floor((now.getTime() - past.getTime()) / 60000);
  
  if (diffInMinutes < 1) return 'Just now';
  if (diffInMinutes < 60) return `${diffInMinutes} minutes ago`;
  if (diffInMinutes < 1440) return `${Math.floor(diffInMinutes / 60)} hours ago`;
  return past.toLocaleDateString();
};

export default function Saved() {
  const { user } = useTenant();
  const [savedPosts, setSavedPosts] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  const fetchSavedPosts = async () => {
    if (!user) return;
    
    try {
      // 1. Fetch from saved_posts, and JOIN the actual post and author data!
      const { data, error } = await supabase
        .from('saved_posts')
        .select(`
          post_id,
          post:posts (
            id,
            content,
            image_urls,
            created_at,
            author:profiles(first_name, last_name, company, business_type, avatar_url, is_verified)
          )
        `)
        .eq('user_id', user.id)
        .order('created_at', { ascending: false });

      if (error) throw error;

      if (data) {
        // 2. Format it to match our Feed UI structure
        const formatted = data
          .filter(item => item.post) // Make sure the post still exists
          .map(item => {
            const p: any = item.post;
            return {
              id: p.id,
              author: {
                name: p.author?.company || `${p.author?.first_name} ${p.author?.last_name}`,
                type: p.author?.business_type?.split('_').map((w: string) => w.charAt(0).toUpperCase() + w.slice(1)).join(' ') || 'Partner',
                avatar: p.author?.avatar_url,
                verified: p.author?.is_verified || false
              },
              content: p.content,
              image: p.image_urls?.[0] || null,
              timestamp: timeAgo(p.created_at),
              likes: 0,
              comments: 0,
              isLiked: false,
              isSaved: true // It's in the saved tab, so it's definitely saved!
            };
          });
          
        setSavedPosts(formatted);
      }
    } catch (error) {
      console.error("Error fetching saved posts:", error);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchSavedPosts();
  }, [user]);

  const removeSavedPost = async (postId: string) => {
    if (!user) return;
    
    // Optimistic UI Removal
    setSavedPosts(savedPosts.filter(p => p.id !== postId));

    try {
      await supabase.from('saved_posts').delete().match({ post_id: postId, user_id: user.id });
    } catch (error) {
      console.error("Error unsaving post:", error);
      fetchSavedPosts(); // Revert if failed
    }
  };

  if (!user) {
    return (
      <div className="flex flex-col items-center justify-center h-64 text-slate-500">
        <Bookmark size={48} className="mb-4 opacity-50" />
        <p>Sign in to view your saved items.</p>
      </div>
    );
  }

  return (
    <div className="space-y-6 pb-24 animate-in fade-in duration-500">
      
      <div className="flex items-center gap-3 px-2 mb-6">
        <div className="w-10 h-10 rounded-full bg-[#e0e5ec] shadow-[3px_3px_6px_#a3b1c6,-3px_-3px_6px_#ffffff] flex items-center justify-center text-indigo-500">
          <Bookmark size={20} className="fill-indigo-500" />
        </div>
        <div>
          <h1 className="text-2xl font-black text-slate-800">Saved Items</h1>
          <p className="text-xs font-bold text-slate-500 uppercase tracking-widest">Your private collection</p>
        </div>
      </div>

      {isLoading ? (
        <div className="flex justify-center py-12">
          <Loader2 size={32} className="text-[#1da1f2] animate-spin" />
        </div>
      ) : savedPosts.length === 0 ? (
        <div className="bg-[#e0e5ec] rounded-3xl p-10 text-center shadow-[9px_9px_16px_#a3b1c6,-9px_-9px_16px_#ffffff]">
          <Bookmark size={48} className="mx-auto mb-4 text-slate-300" />
          <h3 className="text-lg font-bold text-slate-700">No saved items yet</h3>
          <p className="text-sm text-slate-500 mt-2">When you bookmark RFPs or posts from the feed, they will show up here for quick access.</p>
        </div>
      ) : (
        <div className="space-y-6">
          {savedPosts.map((post) => (
            <div key={post.id} className="bg-[#e0e5ec] rounded-3xl p-5 md:p-6 shadow-[9px_9px_16px_#a3b1c6,-9px_-9px_16px_#ffffff]">
              
              {/* Post Header */}
              <div className="flex justify-between items-start mb-4">
                <div className="flex items-center gap-3 cursor-pointer group">
                  <div className="w-12 h-12 rounded-full shadow-[inset_2px_2px_4px_#a3b1c6,inset_-2px_-2px_4px_#ffffff] p-0.5 bg-[#d1d8e0] flex items-center justify-center overflow-hidden">
                    {post.author.avatar ? (
                      <img src={post.author.avatar} alt="Avatar" className="w-full h-full rounded-full object-cover" />
                    ) : (
                      <Building2 size={20} className="text-slate-400" />
                    )}
                  </div>
                  <div>
                    <h4 className="text-sm font-black text-slate-800 flex items-center gap-1 group-hover:text-[#1da1f2] transition-colors">
                      {post.author.name}
                    </h4>
                    <p className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">{post.author.type} • {post.timestamp}</p>
                  </div>
                </div>
              </div>

              {/* Post Content */}
              <div className="mb-4">
                <p className="text-sm text-slate-700 leading-relaxed whitespace-pre-wrap">{post.content}</p>
              </div>

              {/* Media */}
              {post.image && (
                <div className="mb-4 rounded-2xl overflow-hidden shadow-[inset_3px_3px_6px_#a3b1c6,inset_-3px_-3px_6px_#ffffff] border-4 border-[#e0e5ec]">
                  <img src={post.image} alt="Post attachment" className="w-full h-auto object-cover max-h-80" />
                </div>
              )}

              {/* Action Bar */}
              <div className="flex items-center justify-between pt-4 border-t border-slate-300/50">
                <div className="flex gap-2">
                  <button className="flex items-center gap-2 px-3 py-2 rounded-xl text-xs font-bold text-slate-500 hover:text-rose-500 hover:shadow-[3px_3px_6px_#a3b1c6,-3px_-3px_6px_#ffffff] transition-all">
                    <Heart size={16} /> {post.likes}
                  </button>
                  <button className="flex items-center gap-2 px-3 py-2 rounded-xl text-xs font-bold text-slate-500 hover:text-[#1da1f2] hover:shadow-[3px_3px_6px_#a3b1c6,-3px_-3px_6px_#ffffff] transition-all">
                    <MessageCircle size={16} /> {post.comments}
                  </button>
                </div>

                <div className="flex gap-2">
                  <button className="p-2 text-slate-500 hover:text-teal-500 rounded-xl hover:shadow-[3px_3px_6px_#a3b1c6,-3px_-3px_6px_#ffffff] transition-all">
                    <Share2 size={16} />
                  </button>
                  {/* UN-SAVE BUTTON */}
                  <button 
                    onClick={() => removeSavedPost(post.id)}
                    className="p-2 rounded-xl transition-all text-indigo-500 shadow-[inset_2px_2px_4px_#a3b1c6,inset_-2px_-2px_4px_#ffffff]"
                  >
                    <Bookmark size={16} className="fill-indigo-500" />
                  </button>
                </div>
              </div>

            </div>
          ))}
        </div>
      )}
    </div>
  );
}