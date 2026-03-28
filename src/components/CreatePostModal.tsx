import React, { useState, useRef, useEffect } from 'react';
import { 
  X, Image as ImageIcon, MapPin, Loader2, Building2, 
  Video, Users, MapPinOff, XCircle, FileVideo, Calendar, DollarSign, 
} from 'lucide-react';
import { useTenant } from '../contexts/TenantContext';
import { supabase } from '../lib/supabase';

interface CreatePostModalProps {
  isOpen: boolean;
  onClose: () => void;
}

interface MediaFile {
  file: File;
  previewUrl: string;
  type: 'image' | 'video';
}

export const CreatePostModal: React.FC<CreatePostModalProps> = ({ isOpen, onClose }) => {
  const { user } = useTenant();
  
  // Refs
  const fileInputRef = useRef<HTMLInputElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  // Core State
  const [content, setContent] = useState('');
  const [isPublishing, setIsPublishing] = useState(false);
  
  // --- NEW: Event/Trip State ---
  const [isEventMode, setIsEventMode] = useState(false);
  const [eventData, setEventData] = useState({
    title: '',
    price: '',
    date: '',
    time: '',
    capacity: ''
  });

  // Media State
  const [mediaItems, setMediaItems] = useState<MediaFile[]>([]);
  
  // Location State
  const [showLocation, setShowLocation] = useState(false);
  const [location, setLocation] = useState('');

  // Tags State
  const [showTags, setShowTags] = useState(false);
  const [currentTag, setCurrentTag] = useState('');
  const [tags, setTags] = useState<string[]>([]);

  // Auto-resize textarea
  useEffect(() => {
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto';
      textareaRef.current.style.height = `${Math.min(textareaRef.current.scrollHeight, 250)}px`;
    }
  }, [content]);

  // Cleanup memory for media previews when modal closes
  useEffect(() => {
    if (!isOpen) {
      mediaItems.forEach(item => URL.revokeObjectURL(item.previewUrl));
      setContent('');
      setMediaItems([]);
      setLocation('');
      setShowLocation(false);
      setTags([]);
      setShowTags(false);
      setCurrentTag('');
      setIsEventMode(false);
      setEventData({ title: '', price: '', date: '', time: '', capacity: '' });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOpen]);

  if (!isOpen || !user) return null;

  // --- Handlers ---

  const handleMediaSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!e.target.files) return;
    const files = Array.from(e.target.files);
    
    if (mediaItems.length + files.length > 4) {
      alert("You can only attach up to 4 media items per post.");
      return;
    }

    const newMedia = files.map(file => ({
      file,
      previewUrl: URL.createObjectURL(file),
      type: file.type.startsWith('video/') ? 'video' : 'image' as 'image' | 'video'
    }));

    setMediaItems(prev => [...prev, ...newMedia]);
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const removeMedia = (indexToRemove: number) => {
    setMediaItems(prev => {
      const item = prev[indexToRemove];
      URL.revokeObjectURL(item.previewUrl); 
      return prev.filter((_, index) => index !== indexToRemove);
    });
  };

  const handleAddTag = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter' && currentTag.trim()) {
      e.preventDefault();
      if (!tags.includes(currentTag.trim())) {
        setTags([...tags, currentTag.trim()]);
      }
      setCurrentTag('');
    }
  };

  const removeTag = (tagToRemove: string) => {
    setTags(tags.filter(t => t !== tagToRemove));
  };

  const handlePost = async () => {
    if (!content.trim() && mediaItems.length === 0 && !isEventMode) return;
    setIsPublishing(true);

    try {
      const uploadedUrls: string[] = [];

      // 1. Upload Media
      for (const item of mediaItems) {
        const fileExt = item.file.name.split('.').pop();
        const fileName = `${user.id}-${Math.random().toString(36).substring(2, 15)}.${fileExt}`;
        
        const { error: uploadError } = await supabase.storage
          .from('posts')
          .upload(fileName, item.file, { upsert: false });

        if (uploadError) throw uploadError;

        const { data: { publicUrl } } = supabase.storage.from('posts').getPublicUrl(fileName);
        uploadedUrls.push(publicUrl);
      }

      // 2. Prepare Payload
      const payload: any = {
        author_id: user.id,
        content: content.trim(),
        location: location.trim() || null,
        media_urls: uploadedUrls.length > 0 ? uploadedUrls : null,
        tags: tags.length > 0 ? tags : null,
        is_event: isEventMode // Mark as an event
      };

      // 3. Inject Event Data if applicable
      if (isEventMode) {
        payload.title = eventData.title;
        payload.price = eventData.price;
        payload.event_date = eventData.date;
        payload.event_time = eventData.time;
        payload.capacity = eventData.capacity;
      }

      // 4. Save to Database
      const { error: dbError } = await supabase.from('posts').insert(payload);

      if (dbError) throw dbError;

      onClose();
      window.location.reload(); 

    } catch (error: any) {
      console.error("Error creating post:", error);
      alert("Failed to publish post. Ensure your file sizes aren't too large.");
    } finally {
      setIsPublishing(false);
    }
  };

  // Validation to disable publish button
  const isPublishDisabled = 
    isPublishing || 
    content.length > 300 || 
    (isEventMode && (!eventData.title || !eventData.price || !eventData.date)) ||
    (!isEventMode && !content.trim() && mediaItems.length === 0);

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 sm:p-0">
      
      {/* Dark Blur Backdrop */}
      <div 
        className="absolute inset-0 bg-slate-900/60 backdrop-blur-sm animate-in fade-in duration-300"
        onClick={!isPublishing ? onClose : undefined}
      />

      <input 
        type="file" multiple accept="image/*,video/mp4,video/quicktime" 
        ref={fileInputRef} onChange={handleMediaSelect} className="hidden" 
      />

      {/* Modal Content */}
      <div className="bg-white w-full max-w-[600px] rounded-[2rem] shadow-[0_20px_60px_rgba(0,0,0,0.3)] relative z-10 animate-in zoom-in-95 slide-in-from-bottom-8 duration-300 flex flex-col max-h-[90vh]">
        
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100 shrink-0">
          <h2 className="text-lg font-black text-slate-800">
            {isEventMode ? 'Create Bookable Event' : 'Create an Update'}
          </h2>
          <button 
            onClick={onClose} disabled={isPublishing}
            className="w-8 h-8 rounded-full bg-slate-50 flex items-center justify-center text-slate-400 hover:text-slate-700 hover:bg-slate-200 transition-colors disabled:opacity-50"
          >
            <X size={18} />
          </button>
        </div>

        {/* Scrollable Body */}
        <div className="p-6 overflow-y-auto custom-scrollbar flex-1">
          <div className="flex gap-4">
            <div className="w-12 h-12 shrink-0 rounded-full bg-[#e0e5ec] border border-slate-200 shadow-sm flex items-center justify-center overflow-hidden">
              {user.avatarUrl ? (
                <img src={user.avatarUrl} alt="Avatar" className="w-full h-full object-cover" />
              ) : (
                <Building2 size={20} className="text-slate-400" />
              )}
            </div>
            
            <div className="flex-1 min-w-0">
              <h3 className="text-sm font-bold text-slate-800">{user.company || user.fullName}</h3>
              
              {/* --- NEW: EVENT/TRIP FIELDS --- */}
              {isEventMode && (
                <div className="mt-3 mb-4 p-4 bg-amber-50/50 rounded-2xl border border-amber-100 space-y-4 animate-in fade-in slide-in-from-top-2">
                  <div className="flex items-center gap-2 mb-1">
                    <Calendar size={16} className="text-amber-500" />
                    <h4 className="text-xs font-black text-amber-700 uppercase tracking-widest">Event Details</h4>
                  </div>
                  
                  <div>
                    <input 
                      type="text" placeholder="Event / Trip Name (e.g. Easter Safari)" 
                      value={eventData.title} onChange={e => setEventData({...eventData, title: e.target.value})}
                      className="w-full bg-white border border-amber-200 text-slate-800 text-sm font-bold rounded-xl px-4 py-2.5 outline-none focus:border-amber-400 placeholder:text-slate-400 placeholder:font-medium"
                    />
                  </div>

                  <div className="grid grid-cols-2 gap-3">
                    <div className="relative">
                      <DollarSign size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                      <input 
                        type="text" placeholder="Price (GHS)" 
                        value={eventData.price} onChange={e => setEventData({...eventData, price: e.target.value})}
                        className="w-full bg-white border border-amber-200 text-slate-800 text-sm font-bold rounded-xl pl-8 pr-4 py-2.5 outline-none focus:border-amber-400 placeholder:text-slate-400 placeholder:font-medium"
                      />
                    </div>
                    <div className="relative">
                      <Users size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                      <input 
                        type="text" placeholder="Total Seats" 
                        value={eventData.capacity} onChange={e => setEventData({...eventData, capacity: e.target.value})}
                        className="w-full bg-white border border-amber-200 text-slate-800 text-sm font-bold rounded-xl pl-8 pr-4 py-2.5 outline-none focus:border-amber-400 placeholder:text-slate-400 placeholder:font-medium"
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-3">
                    <input 
                      type="date" 
                      value={eventData.date} onChange={e => setEventData({...eventData, date: e.target.value})}
                      className="w-full bg-white border border-amber-200 text-slate-800 text-sm font-bold rounded-xl px-4 py-2.5 outline-none focus:border-amber-400"
                    />
                    <input 
                      type="time" 
                      value={eventData.time} onChange={e => setEventData({...eventData, time: e.target.value})}
                      className="w-full bg-white border border-amber-200 text-slate-800 text-sm font-bold rounded-xl px-4 py-2.5 outline-none focus:border-amber-400"
                    />
                  </div>
                </div>
              )}

              <textarea
                ref={textareaRef} autoFocus
                value={content} onChange={(e) => setContent(e.target.value)}
                placeholder={isEventMode ? "Describe the itinerary, what's included, and what to expect..." : "Share a business update, new vehicle, or tour package..."}
                className={`w-full text-lg text-slate-800 placeholder:text-slate-400 resize-none outline-none min-h-[80px] bg-transparent ${isEventMode ? 'mt-0' : 'mt-2'}`}
              />

              {/* MEDIA PREVIEWS */}
              {mediaItems.length > 0 && (
                <div className={`mt-4 grid gap-2 ${mediaItems.length === 1 ? 'grid-cols-1' : 'grid-cols-2'}`}>
                  {mediaItems.map((item, idx) => (
                    <div key={item.previewUrl} className="relative rounded-2xl overflow-hidden bg-slate-100 border border-slate-200 aspect-video group">
                      {item.type === 'image' ? (
                        <img src={item.previewUrl} alt="Preview" className="w-full h-full object-cover" />
                      ) : (
                        <div className="w-full h-full flex items-center justify-center bg-slate-900 relative">
                          <video src={item.previewUrl} className="w-full h-full object-cover opacity-80" />
                          <FileVideo size={32} className="absolute text-white/70" />
                        </div>
                      )}
                      <button 
                        onClick={() => removeMedia(idx)}
                        className="absolute top-2 right-2 w-8 h-8 bg-slate-900/60 backdrop-blur-md rounded-full text-white flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity hover:bg-rose-500"
                      >
                        <X size={16} />
                      </button>
                    </div>
                  ))}
                </div>
              )}

              {/* LOCATION INPUT */}
              {showLocation && (
                <div className="mt-4 flex items-center gap-2 p-3 bg-blue-50/50 rounded-xl border border-blue-100 animate-in fade-in slide-in-from-top-2">
                  <MapPin size={18} className="text-[#1da1f2]" />
                  <input 
                    type="text" value={location} onChange={(e) => setLocation(e.target.value)}
                    placeholder="Where are you? (e.g. Kakum National Park)"
                    className="flex-1 bg-transparent text-sm font-semibold text-slate-700 outline-none placeholder:text-slate-400"
                  />
                  <button onClick={() => { setShowLocation(false); setLocation(''); }} className="text-slate-400 hover:text-slate-600">
                    <MapPinOff size={16} />
                  </button>
                </div>
              )}

              {/* TAGS INPUT */}
              {showTags && (
                <div className="mt-4 p-3 bg-indigo-50/50 rounded-xl border border-indigo-100 animate-in fade-in slide-in-from-top-2">
                  <div className="flex items-center gap-2 mb-2">
                    <Users size={18} className="text-indigo-500" />
                    <input 
                      type="text" value={currentTag} onChange={(e) => setCurrentTag(e.target.value)} onKeyDown={handleAddTag}
                      placeholder="Type a partner name & press Enter..."
                      className="flex-1 bg-transparent text-sm font-semibold text-slate-700 outline-none placeholder:text-slate-400"
                    />
                  </div>
                  {tags.length > 0 && (
                    <div className="flex flex-wrap gap-2 mt-2">
                      {tags.map(tag => (
                        <span key={tag} className="px-3 py-1 bg-white border border-indigo-200 text-indigo-700 text-xs font-bold rounded-full flex items-center gap-1 shadow-sm">
                          {tag}
                          <button onClick={() => removeTag(tag)} className="hover:text-rose-500"><XCircle size={14} /></button>
                        </span>
                      ))}
                    </div>
                  )}
                </div>
              )}

            </div>
          </div>
        </div>

        {/* Footer Actions */}
        <div className="px-6 py-4 bg-slate-50 border-t border-slate-100 flex items-center justify-between shrink-0">
          <div className="flex items-center gap-1">
            
            {/* THE NEW EVENT BUTTON (Always First) */}
            <button 
              onClick={() => setIsEventMode(!isEventMode)} title="Create Bookable Trip"
              className={`w-10 h-10 rounded-full flex items-center justify-center transition-colors active:scale-95 ${isEventMode ? 'bg-amber-100 text-amber-700 shadow-inner' : 'hover:bg-amber-50 text-amber-500'}`}
            >
              <Calendar size={20} />
            </button>

            <button onClick={() => fileInputRef.current?.click()} title="Add Image" className="w-10 h-10 rounded-full hover:bg-blue-100 text-[#1da1f2] flex items-center justify-center transition-colors active:scale-95">
              <ImageIcon size={20} />
            </button>
            <button onClick={() => fileInputRef.current?.click()} title="Add Video" className="w-10 h-10 rounded-full hover:bg-blue-100 text-[#1da1f2] flex items-center justify-center transition-colors active:scale-95">
              <Video size={20} />
            </button>
            <button onClick={() => setShowLocation(!showLocation)} title="Add Location" className={`w-10 h-10 rounded-full flex items-center justify-center transition-colors active:scale-95 ${showLocation ? 'bg-blue-100 text-blue-700' : 'hover:bg-blue-100 text-[#1da1f2]'}`}>
              <MapPin size={20} />
            </button>
            <button onClick={() => setShowTags(!showTags)} title="Tag Partners" className={`w-10 h-10 rounded-full flex items-center justify-center transition-colors active:scale-95 ${showTags ? 'bg-indigo-100 text-indigo-700' : 'hover:bg-indigo-100 text-indigo-500'}`}>
              <Users size={20} />
            </button>
          </div>

          <div className="flex items-center gap-4">
            <span className={`text-xs font-bold ${content.length > 250 ? 'text-rose-500' : 'text-slate-400'}`}>
              {content.length}/300
            </span>
            <button
              onClick={handlePost}
              disabled={isPublishDisabled}
              className="px-6 py-2.5 bg-[#1da1f2] text-white rounded-full font-bold text-sm shadow-[0_4px_14px_rgba(29,161,242,0.4)] hover:bg-[#1a91da] hover:shadow-lg active:scale-95 disabled:opacity-50 disabled:shadow-none disabled:cursor-not-allowed transition-all flex items-center gap-2"
            >
              {isPublishing ? <Loader2 size={18} className="animate-spin" /> : (isEventMode ? 'Publish Event' : 'Publish Update')}
            </button>
          </div>
        </div>

      </div>
    </div>
  );
};