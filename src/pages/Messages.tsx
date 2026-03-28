import { useState, useEffect, useRef } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { 
  Search, Edit3, MoreHorizontal, CheckCircle2, ArrowLeft, Send,
  Image as ImageIcon, Video, FileText, MapPin, Mic, User as UserIcon, ShieldCheck, Loader2, X, Building2, Compass
} from 'lucide-react';
import { supabase } from '../lib/supabase';
import { useTenant } from '../contexts/TenantContext';

export default function Messages() {
  const { user } = useTenant();
  const location = useLocation();
  const navigate = useNavigate();
  
  // LIVE DATA STATES
  const [chats, setChats] = useState<any[]>([]);
  const [messages, setMessages] = useState<any[]>([]);
  const [activeChat, setActiveChat] = useState<any | null>(null);
  
  // UI STATES
  const [messageInput, setMessageInput] = useState('');
  const [isLoadingChats, setIsLoadingChats] = useState(true);
  const [isSending, setIsSending] = useState(false);
  const [showChatOptions, setShowChatOptions] = useState(false);
  
  // MEDIA UPLOAD STATES
  const [isUploading, setIsUploading] = useState(false);
  const [uploadType, setUploadType] = useState<'image' | 'video' | 'document' | 'audio'>('image');
  const fileInputRef = useRef<HTMLInputElement>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const [showMentions, setShowMentions] = useState(false);
  const [mentionResults, setMentionResults] = useState<any[]>([]);

  // QUICK PROFILE PREVIEW STATES
  const [previewProfileId, setPreviewProfileId] = useState<string | null>(null);
  const [previewProfileData, setPreviewProfileData] = useState<any | null>(null);
  const [isPreviewLoading, setIsPreviewLoading] = useState(false);

  useEffect(() => {
    setShowChatOptions(false);
  }, [activeChat]);

  // 0. FETCH QUICK PREVIEW DATA
  useEffect(() => {
    if (!previewProfileId) {
      setPreviewProfileData(null);
      return;
    }
    const fetchPreview = async () => {
      setIsPreviewLoading(true);
      // Check Vendor table
      const { data: vendor } = await supabase.from('profiles').select('*').eq('id', previewProfileId).maybeSingle();
      if (vendor) {
        setPreviewProfileData({ ...vendor, role: 'vendor' });
      } else {
        // Check Tourist table
        const { data: tourist } = await supabase.from('tourists').select('*').eq('id', previewProfileId).maybeSingle();
        if (tourist) setPreviewProfileData({ ...tourist, role: 'tourist' });
      }
      setIsPreviewLoading(false);
    };
    fetchPreview();
  }, [previewProfileId]);

  // 1. FETCH CONVERSATIONS ON LOAD
  useEffect(() => {
    const fetchChats = async () => {
      if (!user) return;
      setIsLoadingChats(true);
      
      const { data: convs, error } = await supabase
        .from('conversations')
        .select('id, participant_1, participant_2, last_message_at')
        .or(`participant_1.eq.${user.id},participant_2.eq.${user.id}`)
        .order('last_message_at', { ascending: false });

      if (convs && convs.length > 0 && !error) {
        const partnerIds = convs.map(c => c.participant_1 === user.id ? c.participant_2 : c.participant_1);

        const { data: vendorProfiles } = await supabase.from('profiles').select('id, company, first_name, last_name, avatar_url, is_verified').in('id', partnerIds);
        const { data: touristProfiles } = await supabase.from('tourists').select('id, first_name, last_name, avatar_url').in('id', partnerIds);

        const allPartners = [...(vendorProfiles || []), ...(touristProfiles || [])];

        const formattedChats = convs.map(conv => {
          const partnerId = conv.participant_1 === user.id ? conv.participant_2 : conv.participant_1;
          const partnerData: any = allPartners.find(p => p.id === partnerId) || {};

          return {
            id: conv.id,
            partnerId: partnerId,
            name: partnerData.company || `${partnerData.first_name || ''} ${partnerData.last_name || ''}`.trim() || 'Unknown User',
            avatar: partnerData.avatar_url,
            verified: partnerData.is_verified || false,
            lastMessageAt: conv.last_message_at,
            online: true, 
            unread: 0
          };
        });
        setChats(formattedChats);
      }
      setIsLoadingChats(false);
    };

    fetchChats();
  }, [user]);

  // 1.5 CATCH NEW INCOMING CHATS FROM URL
  useEffect(() => {
    const initChatFromURL = async () => {
      if (!user || isLoadingChats) return;
      
      const searchParams = new URLSearchParams(location.search);
      const targetUserId = searchParams.get('user');
      
      if (!targetUserId) return;

      const existingChat = chats.find(c => c.partnerId === targetUserId);
      if (existingChat) {
        setActiveChat(existingChat);
        navigate('/messages', { replace: true });
        return;
      }

      const { data: existingDbChat } = await supabase
        .from('conversations')
        .select('id')
        .or(`and(participant_1.eq.${user.id},participant_2.eq.${targetUserId}),and(participant_1.eq.${targetUserId},participant_2.eq.${user.id})`)
        .maybeSingle();

      if (!existingDbChat) {
        const { data: vendorData } = await supabase.from('profiles').select('*').eq('id', targetUserId).maybeSingle();
        const { data: touristData } = await supabase.from('tourists').select('*').eq('id', targetUserId).maybeSingle();
        const pData = vendorData || touristData;

        if (pData) {
          const { data: newConv } = await supabase.from('conversations').insert({
            participant_1: user.id,
            participant_2: targetUserId,
            last_message_at: new Date().toISOString()
          }).select().single();

          if (newConv) {
            const newChat = {
              id: newConv.id,
              partnerId: targetUserId,
              name: pData.company || `${pData.first_name || ''} ${pData.last_name || ''}`.trim() || 'User',
              avatar: pData.avatar_url,
              verified: pData.is_verified || false,
              lastMessageAt: newConv.last_message_at,
              online: true,
              unread: 0
            };
            setChats(prev => [newChat, ...prev]);
            setActiveChat(newChat);
          }
        }
      }
      navigate('/messages', { replace: true });
    };

    initChatFromURL();
  }, [location.search, user, isLoadingChats, chats, navigate]);


  // 2. FETCH MESSAGES & SUBSCRIBE TO REAL-TIME
  useEffect(() => {
    if (!activeChat) return;

    const fetchMessages = async () => {
      const { data } = await supabase
        .from('direct_messages')
        .select('*')
        .eq('conversation_id', activeChat.id)
        .order('created_at', { ascending: true });
      
      setMessages(data || []);
      scrollToBottom();
    };

    fetchMessages();

    const channel = supabase
      .channel(`chat_${activeChat.id}`)
      .on('postgres_changes', { 
        event: 'INSERT', 
        schema: 'public', 
        table: 'direct_messages',
        filter: `conversation_id=eq.${activeChat.id}` 
      }, (payload) => {
        setMessages((prev) => [...prev, payload.new]);
        scrollToBottom();
      })
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, [activeChat]);

  const scrollToBottom = () => {
    setTimeout(() => {
      messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }, 100);
  };

  // 3. SEND TEXT MESSAGE
  const handleSendMessage = async () => {
    if (!messageInput.trim() || !user || !activeChat) return;
    
    setIsSending(true);
    const textToSend = messageInput.trim();
    setMessageInput('');

    const { error } = await supabase.from('direct_messages').insert({
      conversation_id: activeChat.id,
      sender_id: user.id,
      content: textToSend,
      message_type: 'text' 
    });

    if (error) {
      console.error("Error sending message:", error);
      setMessageInput(textToSend); 
    } else {
      await supabase.from('conversations').update({ last_message_at: new Date().toISOString() }).eq('id', activeChat.id);
    }
    setIsSending(false);
  };

  // 4. REAL FILE UPLOAD HANDLER
  const handleFileUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file || !user || !activeChat) return;

    setIsUploading(true);
    try {
      const fileExt = file.name.split('.').pop();
      const fileName = `${user.id}-${Date.now()}.${fileExt}`;
      const filePath = `${activeChat.id}/${fileName}`;

      const { error: uploadError } = await supabase.storage.from('chat_media').upload(filePath, file);
      if (uploadError) throw uploadError;

      const { data: { publicUrl } } = supabase.storage.from('chat_media').getPublicUrl(filePath);

      await supabase.from('direct_messages').insert({
        conversation_id: activeChat.id,
        sender_id: user.id,
        content: file.name, 
        message_type: uploadType,
        media_url: publicUrl
      });

      await supabase.from('conversations').update({ last_message_at: new Date().toISOString() }).eq('id', activeChat.id);
    } catch (err) {
      console.error("Upload failed", err);
      alert("Failed to upload file.");
    } finally {
      setIsUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = ''; 
    }
  };

  // 5. LIVE LOCATION SENDER
  const handleShareLocation = () => {
    if (!navigator.geolocation) return alert("Geolocation not supported by your device.");
    if (!user || !activeChat) return;

    setIsUploading(true);
    navigator.geolocation.getCurrentPosition(
      async (position) => {
        const { latitude, longitude } = position.coords;
        try {
          await supabase.from('direct_messages').insert({
            conversation_id: activeChat.id,
            sender_id: user.id,
            content: `${latitude},${longitude}`, 
            message_type: 'location'
          });
          await supabase.from('conversations').update({ last_message_at: new Date().toISOString() }).eq('id', activeChat.id);
        } catch (err) {
          console.error(err);
        } finally {
          setIsUploading(false);
        }
      }, 
      () => {
        alert("Could not access your location. Please check your browser permissions.");
        setIsUploading(false);
      }
    );
  };

  const triggerUpload = (type: 'image' | 'video' | 'document' | 'audio') => {
    setUploadType(type);
    setTimeout(() => { fileInputRef.current?.click(); }, 0);
  };

  const getAcceptString = () => {
    switch (uploadType) {
      case 'image': return 'image/*';
      case 'video': return 'video/*';
      case 'audio': return 'audio/*';
      case 'document': return '.pdf,.doc,.docx,.xls,.xlsx,.txt';
      default: return '*/*';
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSendMessage();
    }
  };

  const renderMessageBubble = (msg: any, isMe: boolean) => {
    const isMedia = msg.message_type === 'image' || msg.message_type === 'video' || msg.message_type === 'location';
    
    const bubbleClass = isMedia 
      ? 'p-0 bg-transparent shadow-none' 
      : `max-w-[75%] md:max-w-[60%] p-4 text-[13px] font-semibold leading-relaxed shadow-[5px_5px_10px_#a3b1c6,-5px_-5px_10px_#ffffff] ${
          isMe ? 'bg-[#1da1f2] text-white rounded-2xl rounded-br-sm' : 'bg-[#e0e5ec] text-slate-800 rounded-2xl rounded-bl-sm'
        }`;

    return (
      <div className={bubbleClass}>
        {msg.message_type === 'image' && (
          <img src={msg.media_url} alt="Shared Image" className="rounded-xl max-w-[250px] md:max-w-[350px] h-auto cursor-pointer shadow-lg border border-white/20" onClick={() => window.open(msg.media_url, '_blank')} />
        )}
        
        {msg.message_type === 'video' && (
          <video src={msg.media_url} controls className="rounded-xl max-w-[250px] md:max-w-[350px] h-auto shadow-lg border border-white/20" />
        )}
        
        {msg.message_type === 'audio' && (
          <audio src={msg.media_url} controls className="max-w-[200px] md:max-w-[250px] h-12" />
        )}
        
        {msg.message_type === 'document' && (
          <div className="bg-white p-3 rounded-xl shadow-sm border border-slate-200">
            <a href={msg.media_url} target="_blank" rel="noopener noreferrer" className="flex items-center gap-2 text-[#1da1f2] hover:underline decoration-1 underline-offset-2">
              <FileText size={16} /> <span className="truncate max-w-[180px]">{msg.content || 'View Document'}</span>
            </a>
          </div>
        )}
        
        {msg.message_type === 'location' && (
          <a href={`http://maps.google.com/maps?q=${msg.content}`} target="_blank" rel="noopener noreferrer" className="flex flex-col items-center gap-2 group cursor-pointer">
            <div className="w-48 h-32 bg-slate-200 rounded-xl overflow-hidden relative border-2 border-white shadow-md group-hover:opacity-90 transition-opacity">
               <img src={`https://www.openstreetmap.org/export/embed.html?bbox=${parseFloat(msg.content.split(',')[1])-0.01},${parseFloat(msg.content.split(',')[0])-0.01},${parseFloat(msg.content.split(',')[1])+0.01},${parseFloat(msg.content.split(',')[0])+0.01}&layer=mapnik`} className="absolute inset-0 w-full h-full object-cover opacity-80 pointer-events-none" />
               <div className="absolute inset-0 flex items-center justify-center">
                 <div className={`p-2 rounded-full shadow-lg ${isMe ? 'bg-rose-500 text-white animate-bounce' : 'bg-[#1da1f2] text-white animate-bounce'}`}>
                    <MapPin size={24} />
                 </div>
               </div>
            </div>
            <span className="text-xs font-black text-slate-500 uppercase tracking-widest group-hover:text-slate-800 transition-colors">Tap to view map</span>
          </a>
        )}
        
        {(!msg.message_type || msg.message_type === 'text') && (
          <span>{msg.content}</span>
        )}
      </div>
    );
  };

  const handleTextChange = async (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    const value = e.target.value;
    setMessageInput(value);
    const lastWord = value.split(' ').pop() || '';
    if (lastWord.startsWith('@')) {
      const query = lastWord.slice(1);
      if (query.length > 0) {
        const { data } = await supabase.from('profiles').select('id, company, first_name, last_name, is_verified').or(`company.ilike.%${query}%,first_name.ilike.%${query}%`).limit(5);
        setMentionResults(data || []);
      } else { setMentionResults([]); }
      setShowMentions(true);
    } else { setShowMentions(false); }
  };

  const selectMention = (profile: any) => {
    const words = messageInput.split(' ');
    words.pop();
    const name = profile.company || `${profile.first_name}`;
    setMessageInput([...words, `@${name.replace(/\s+/g, '')} `].join(' '));
    setShowMentions(false);
  };

  const formatTime = (dateString: string) => {
    return new Date(dateString).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  };

  return (
    <div className="h-[calc(100vh-6rem)] md:h-[calc(100vh-8rem)] w-full flex bg-[#e0e5ec] rounded-3xl overflow-hidden shadow-[inset_5px_5px_10px_#a3b1c6,inset_-5px_-5px_10px_#ffffff] font-sans relative">
      
      {/* Hidden File Input for actual uploading */}
      <input type="file" ref={fileInputRef} className="hidden" accept={getAcceptString()} onChange={handleFileUpload} />

      {/* ==========================================
          LEFT SIDE: CHAT LIST
          ========================================== */}
      <div className={`w-full md:w-[350px] lg:w-[400px] flex flex-col shrink-0 transition-transform duration-300 ${
        activeChat ? '-translate-x-full md:translate-x-0 hidden md:flex' : 'translate-x-0'
      }`}>
        <div className="p-6 pb-2">
          <div className="flex justify-between items-center mb-6">
            <div>
              <h1 className="text-2xl font-black text-slate-800">Inbox</h1>
              <p className="text-xs font-bold text-slate-500 uppercase tracking-widest mt-1">Partner Comms</p>
            </div>
            <button className="w-10 h-10 rounded-full bg-[#d1d8e0] text-teal-600 flex items-center justify-center shadow-[5px_5px_10px_#a3b1c6,-5px_-5px_10px_#ffffff] hover:text-teal-500 active:shadow-[inset_3px_3px_6px_rgba(0,0,0,0.1)] transition-all">
              <Edit3 size={18} />
            </button>
          </div>

          <div className="relative mb-4">
            <Search size={16} className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" />
            <input 
              type="text" 
              placeholder="Search messages..." 
              className="w-full bg-[#e0e5ec] text-sm font-semibold text-slate-700 placeholder:text-slate-400 rounded-full py-3 pl-12 pr-4 shadow-[inset_4px_4px_8px_#a3b1c6,inset_-4px_-4px_8px_#ffffff] focus:outline-none"
            />
          </div>
        </div>

        <div className="flex-1 overflow-y-auto scrollbar-hide px-4 pb-24 md:pb-4">
          <div className="bg-[#e0e5ec] rounded-3xl p-2  min-h-[200px]">
            {isLoadingChats ? (
              <div className="flex justify-center p-8"><Loader2 className="animate-spin text-[#1da1f2]" /></div>
            ) : chats.length > 0 ? (
              chats.map((chat) => (
                <div 
                  key={chat.id} 
                  onClick={() => setActiveChat(chat)}
                  className={`flex items-center gap-4 p-3 rounded-2xl cursor-pointer transition-all group ${
                    activeChat?.id === chat.id 
                      ? 'bg-[#d1d8e0] shadow-[inset_3px_3px_6px_#a3b1c6,inset_-3px_-3px_6px_#ffffff]' 
                      : 'hover:bg-[#d1d8e0] hover:shadow-[inset_3px_3px_6px_#a3b1c6,inset_-3px_-3px_6px_#ffffff]'
                  }`}
                >
                  <div className="relative shrink-0">
                    <div className="w-12 h-12 rounded-full shadow-[3px_3px_6px_#a3b1c6,-3px_-3px_6px_#ffffff] overflow-hidden bg-slate-200 flex items-center justify-center">
                      {chat.avatar ? <img src={chat.avatar} alt={chat.name} className="w-full h-full object-cover" /> : <UserIcon className="text-slate-400" size={20}/>}
                    </div>
                    {chat.online && <div className="absolute bottom-0 right-0 w-3 h-3 bg-green-500 border-2 border-[#e0e5ec] rounded-full"></div>}
                  </div>

                  <div className="flex-1 min-w-0">
                    <div className="flex justify-between items-center mb-1">
                      <h3 className="text-[13px] font-black text-slate-800 truncate flex items-center gap-1">
                        {chat.name} {chat.verified && <ShieldCheck size={12} className="text-teal-500" />}
                      </h3>
                      <span className="text-[9px] font-bold text-slate-400 shrink-0">{formatTime(chat.lastMessageAt)}</span>
                    </div>
                    <div className="flex justify-between items-center">
                      <p className="text-[11px] truncate font-medium text-slate-500">Tap to view chat</p>
                    </div>
                  </div>
                </div>
              ))
            ) : (
              <div className="text-center p-6 text-sm font-bold text-slate-400">No active conversations.</div>
            )}
          </div>
        </div>
      </div>

      {/* ==========================================
          RIGHT SIDE: ACTIVE CHAT VIEW
          ========================================== */}
      <div className={`flex-1 flex flex-col bg-[#d1d8e0] relative shadow-[inset_9px_9px_16px_#a3b1c6,inset_-9px_-9px_16px_#ffffff] ${
        !activeChat ? 'hidden md:flex' : 'flex'
      }`}>
        
        {activeChat ? (
          <>
            {/* Chat Header */}
            <div className="h-[76px] flex items-center justify-between px-6 shrink-0 border-b border-slate-300/30 z-10">
              <div className="flex items-center gap-4">
                <button 
                  onClick={() => setActiveChat(null)}
                  className="md:hidden w-10 h-10 rounded-full bg-[#e0e5ec] shadow-[3px_3px_6px_#a3b1c6,-3px_-3px_6px_#ffffff] flex items-center justify-center text-slate-600 active:shadow-[inset_2px_2px_4px_#a3b1c6]"
                >
                  <ArrowLeft size={18} />
                </button>
                
                <div className="flex items-center gap-3">
                  <div 
                    className="w-10 h-10 rounded-full overflow-hidden shadow-sm bg-slate-200 flex items-center justify-center cursor-pointer hover:opacity-80 transition-opacity" 
                    onClick={() => setPreviewProfileId(activeChat.partnerId)}
                  >
                    {activeChat.avatar ? <img src={activeChat.avatar} /> : <UserIcon size={20} className="text-slate-400"/>}
                  </div>
                  <div>
                    <h2 
                      className="text-sm font-black text-slate-900 flex items-center gap-1 cursor-pointer hover:text-[#1da1f2] transition-colors"
                      onClick={() => setPreviewProfileId(activeChat.partnerId)}
                    >
                      {activeChat.name} {activeChat.verified && <ShieldCheck size={14} className="text-teal-500" strokeWidth={3}/>}
                    </h2>
                    <p className="text-[10px] font-bold tracking-widest uppercase text-green-600">Online</p>
                  </div>
                </div>
              </div>
              
              <div className="relative">
                <button 
                  onClick={() => setShowChatOptions(!showChatOptions)}
                  className="w-10 h-10 rounded-full bg-[#e0e5ec] shadow-[3px_3px_6px_#a3b1c6,-3px_-3px_6px_#ffffff] text-slate-600 hover:text-[#1da1f2] flex items-center justify-center transition-colors"
                >
                  <MoreHorizontal size={18} />
                </button>

                {showChatOptions && (
                  <div className="absolute right-0 top-full mt-2 w-48 bg-white rounded-2xl shadow-xl border border-slate-100 overflow-hidden z-50 py-2 animate-in fade-in slide-in-from-top-2 duration-200">
                    <button 
                      onClick={() => {
                        setShowChatOptions(false);
                        setPreviewProfileId(activeChat.partnerId);
                      }} 
                      className="w-full px-4 py-2.5 text-left text-sm font-bold text-slate-700 hover:bg-slate-50 hover:text-[#1da1f2] flex items-center gap-2"
                    >
                      <UserIcon size={14} /> View Profile
                    </button>
                    <button 
                      onClick={() => {
                        setShowChatOptions(false);
                        alert("Message clearing will be available in a future update.");
                      }} 
                      className="w-full px-4 py-2.5 text-left text-sm font-bold text-rose-500 hover:bg-rose-50 flex items-center gap-2 mt-1 border-t border-slate-50 pt-3"
                    >
                      <X size={14} /> Clear Chat
                    </button>
                  </div>
                )}
              </div>
            </div>

            {/* Chat History */}
            <div className="flex-1 overflow-y-auto p-4 md:p-6 space-y-6">
              {messages.length === 0 ? (
                <div className="text-center text-xs font-bold text-slate-400 mt-10">Start the conversation...</div>
              ) : (
                messages.map((msg) => {
                  const isMe = msg.sender_id === user?.id;
                  return (
                    <div key={msg.id} className={`flex flex-col ${isMe ? 'items-end' : 'items-start'}`}>
                      {renderMessageBubble(msg, isMe)}
                      <div className="flex items-center gap-1 mt-2 mx-1">
                        <span className="text-[9px] font-bold text-slate-500 uppercase tracking-wider">{formatTime(msg.created_at)}</span>
                        {isMe && <CheckCircle2 size={12} className={msg.message_type === 'image' || msg.message_type === 'video' || msg.message_type === 'location' ? 'text-slate-400' : 'text-[#1da1f2]'} />}
                      </div>
                    </div>
                  );
                })
              )}
              {isUploading && (
                <div className="flex justify-end">
                  <div className="max-w-[60%] p-4 bg-[#1da1f2]/50 text-white rounded-2xl rounded-br-sm flex items-center gap-2">
                     <Loader2 size={16} className="animate-spin" /> Uploading media...
                  </div>
                </div>
              )}
              <div ref={messagesEndRef} />
            </div>

            {/* Chat Input & Attachments */}
            <div className="p-4 pt-2 shrink-0 relative">
              <div className="flex gap-4 px-2 mb-3 text-slate-500">
                <button onClick={() => triggerUpload('image')} className="hover:text-teal-500 transition-colors" title="Send Image"><ImageIcon size={18}/></button>
                <button onClick={() => triggerUpload('video')} className="hover:text-rose-500 transition-colors" title="Send Video"><Video size={18}/></button>
                <button onClick={() => triggerUpload('document')} className="hover:text-indigo-500 transition-colors" title="Send Document"><FileText size={18}/></button>
                <button onClick={handleShareLocation} className="hover:text-amber-500 transition-colors" title="Share Location"><MapPin size={18}/></button>
                <button onClick={() => triggerUpload('audio')} className="hover:text-[#1da1f2] transition-colors" title="Send Audio Note"><Mic size={18}/></button>
              </div>

              {showMentions && (
                <div className="absolute bottom-full mb-2 left-4 w-64 bg-white rounded-2xl shadow-2xl border border-slate-100 overflow-hidden z-50">
                  {mentionResults.length > 0 ? (
                    mentionResults.map(p => (
                      <div key={p.id} onClick={() => selectMention(p)} className="p-3 hover:bg-slate-50 cursor-pointer flex items-center gap-3 border-b border-slate-50 last:border-0">
                        <div className="w-8 h-8 rounded-full bg-[#e0e5ec] flex items-center justify-center shrink-0">
                          <UserIcon size={14} className="text-slate-400" />
                        </div>
                        <span className="text-xs font-black text-slate-800 truncate">{p.company || p.first_name}</span>
                      </div>
                    ))
                  ) : (
                    <div className="p-4 text-center text-xs font-bold text-slate-500">Searching...</div>
                  )}
                </div>
              )}

              <div className="flex items-end gap-3 bg-[#e0e5ec] p-2 pl-4 rounded-3xl shadow-[inset_4px_4px_8px_#a3b1c6,inset_-4px_-4px_8px_#ffffff]">
                <textarea 
                  value={messageInput}
                  onChange={handleTextChange}
                  onKeyDown={handleKeyDown}
                  placeholder="Type a message or use @ to mention..."
                  className="flex-1 bg-transparent max-h-32 py-2 text-sm font-semibold text-slate-800 placeholder:text-slate-400 focus:outline-none resize-none"
                  rows={1}
                  disabled={isSending || isUploading}
                />
                <button 
                  onClick={handleSendMessage}
                  disabled={!messageInput.trim() || isSending || isUploading}
                  className={`w-10 h-10 rounded-full flex items-center justify-center shrink-0 transition-all ${
                    messageInput.trim().length > 0 
                      ? 'bg-[#1da1f2] text-white shadow-[3px_3px_6px_#a3b1c6,-3px_-3px_6px_#ffffff]' 
                      : 'bg-[#d1d8e0] text-slate-400 shadow-inner cursor-not-allowed'
                  }`}
                >
                  {isSending ? <Loader2 size={16} className="animate-spin" /> : <Send size={16} className={messageInput.trim().length > 0 ? "ml-0.5" : ""} />}
                </button>
              </div>
            </div>
          </>
        ) : (
          <div className="flex-1 hidden md:flex flex-col items-center justify-center text-slate-400">
            <div className="w-24 h-24 rounded-full bg-[#e0e5ec] shadow-[inset_5px_5px_10px_#a3b1c6,inset_-5px_-5px_10px_#ffffff] flex items-center justify-center mb-4">
              <Send size={40} className="text-slate-300 ml-2" />
            </div>
            <h3 className="text-lg font-black text-slate-700">Your Messages</h3>
            <p className="text-sm font-medium">Select a chat to view the conversation.</p>
          </div>
        )}
      </div>

      {/* ==========================================
          PROFILE PREVIEW MODAL
          ========================================== */}
      {previewProfileId && (
        <div className="fixed inset-0 z-[9999] flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-slate-900/60 backdrop-blur-sm animate-in fade-in" onClick={() => setPreviewProfileId(null)} />
          
          <div className="w-full max-w-sm bg-white rounded-[2rem] shadow-2xl relative z-10 overflow-hidden animate-in zoom-in-95 slide-in-from-bottom-4 duration-300">
            {isPreviewLoading ? (
              <div className="h-64 flex flex-col items-center justify-center text-slate-400">
                <Loader2 size={32} className="animate-spin text-[#1da1f2] mb-2" />
                <p className="text-xs font-bold uppercase tracking-widest">Loading Profile...</p>
              </div>
            ) : previewProfileData ? (
              <div className="flex flex-col">
                {/* Cover Image */}
                <div className="h-32 bg-slate-800 relative">
                  {previewProfileData.cover_url ? (
                    <img src={previewProfileData.cover_url} className="w-full h-full object-cover opacity-90" />
                  ) : (
                    <div className="w-full h-full bg-gradient-to-tr from-blue-600 to-teal-400 opacity-90" />
                  )}
                  <button 
                    onClick={() => setPreviewProfileId(null)}
                    className="absolute top-4 right-4 w-8 h-8 rounded-full bg-black/30 backdrop-blur text-white flex items-center justify-center hover:bg-black/50 transition-colors"
                  >
                    <X size={16} />
                  </button>
                </div>

                {/* Avatar & Header Info */}
                <div className="px-6 relative pb-6">
                  <div className="w-20 h-20 rounded-full border-4 border-white bg-slate-100 overflow-hidden absolute -top-10 shadow-md">
                    {previewProfileData.avatar_url ? (
                      <img src={previewProfileData.avatar_url} className="w-full h-full object-cover" />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center bg-slate-200 text-slate-400">
                        {previewProfileData.role === 'tourist' ? <UserIcon size={32}/> : <Building2 size={32}/>}
                      </div>
                    )}
                  </div>

                  <div className="mt-12">
                    <h2 className="text-xl font-black text-slate-900 flex items-center gap-1.5">
                      {previewProfileData.company || `${previewProfileData.first_name || ''} ${previewProfileData.last_name || ''}`.trim()}
                      {previewProfileData.is_verified && <ShieldCheck size={16} className="text-[#1da1f2]" />}
                    </h2>
                    
                    <div className="flex items-center gap-2 mt-1">
                      {previewProfileData.role === 'tourist' ? (
                        <span className="bg-blue-50 text-blue-600 px-2 py-0.5 rounded text-[10px] font-black uppercase tracking-widest flex items-center gap-1">
                           <Compass size={10}/> Tourist
                        </span>
                      ) : (
                        <span className="bg-slate-100 text-slate-600 px-2 py-0.5 rounded text-[10px] font-black uppercase tracking-widest">
                           {previewProfileData.business_type?.replace('_', ' ') || 'Partner'}
                        </span>
                      )}
                      
                      {previewProfileData.location && (
                        <span className="text-xs font-semibold text-slate-500 flex items-center gap-0.5">
                          <MapPin size={12} /> {previewProfileData.location}
                        </span>
                      )}
                    </div>
                    
                    {previewProfileData.bio && (
                      <p className="mt-4 text-sm text-slate-600 font-medium leading-relaxed">
                        {previewProfileData.bio}
                      </p>
                    )}
                  </div>
                </div>

                <div className="p-4 bg-slate-50 border-t border-slate-100">
                  <button 
                    onClick={() => {
                      setPreviewProfileId(null);
                      navigate(`/profile/${previewProfileData.id}`);
                    }}
                    className="w-full py-3 bg-[#1da1f2] hover:bg-[#1a91da] text-white font-bold rounded-xl shadow-md transition-all active:scale-95 text-sm"
                  >
                    View Full Profile
                  </button>
                </div>
              </div>
            ) : (
              <div className="p-6 text-center">
                <p className="text-slate-500 font-bold">User profile could not be loaded.</p>
                <button onClick={() => setPreviewProfileId(null)} className="mt-4 text-[#1da1f2] font-bold">Close</button>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}