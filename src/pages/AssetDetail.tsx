import  { useState, useEffect } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { 
  ArrowLeft, Heart, Bookmark, MapPin, 
  ArrowRight, ShieldCheck, Users, Star, Calendar, Loader2, Building2
} from 'lucide-react';
import { supabase } from '../lib/supabase';

export default function AssetDetail() {
  const navigate = useNavigate();
  const { id } = useParams(); // Get the post/event ID from the URL
  
  const [asset, setAsset] = useState<any>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isLiked, setIsLiked] = useState(false);
  const [isSaved, setIsSaved] = useState(false);

  // 1. FETCH REAL ASSET/EVENT FROM DATABASE
  useEffect(() => {
    const fetchAsset = async () => {
      if (!id) return;
      setIsLoading(true);

      const { data, error } = await supabase
        .from('posts')
        .select('*, provider:profiles(id, company, first_name, last_name, is_verified, avatar_url)')
        .eq('id', id)
        .single();

      if (error) {
        console.error("Error fetching asset details:", error);
      } else if (data) {
        setAsset(data);
      }
      setIsLoading(false);
    };

    fetchAsset();
  }, [id]);

  if (isLoading) {
    return (
      <div className="absolute inset-0 z-[100] bg-white flex items-center justify-center">
        <Loader2 className="w-10 h-10 animate-spin text-[#1da1f2]" />
      </div>
    );
  }

  if (!asset) {
    return (
      <div className="absolute inset-0 z-[100] bg-white flex flex-col items-center justify-center p-6 text-center">
        <h2 className="text-2xl font-black text-slate-800 mb-2">Event Not Found</h2>
        <p className="text-slate-500 mb-6">This trip or asset may have been removed by the vendor.</p>
        <button onClick={() => navigate(-1)} className="px-6 py-3 bg-slate-900 text-white rounded-full font-bold">Go Back</button>
      </div>
    );
  }

  // --- DYNAMIC DATA MAPPING ---
  const providerName = asset.provider?.company || `${asset.provider?.first_name} ${asset.provider?.last_name}`;
  const mainImage = asset.media_urls?.[0] || 'https://images.unsplash.com/photo-1528150242200-cb6d58cb0354?q=80&w=800&auto=format&fit=crop';
  const thumbnails = asset.media_urls?.slice(1, 4) || [];
  const extraImagesCount = asset.media_urls?.length > 4 ? asset.media_urls.length - 4 : 0;

  const handleBookNow = () => {
    // Pass the real event data to the Bookings page/modal
    navigate('/bookings', { 
      state: { 
        openNewBooking: true, 
        prefillData: { 
          id: asset.id, 
          title: asset.title || 'Custom Booking', 
          price: asset.price 
        } 
      } 
    });
  };

  return (
    <div className="absolute inset-0 z-[100] bg-white overflow-hidden flex flex-col font-sans select-none">
      
      {/* BUTTER-SMOOTH NATIVE SCROLL */}
      <div className="flex-1 overflow-y-auto relative bg-white pb-10 scrollbar-hide">
        
        {/* =========================================================
            1. HERO SECTION (Larger & Sticky)
            ========================================================= */}
        <div className="sticky top-0 h-[60vh] w-full z-0 overflow-hidden bg-slate-900 rounded-b-[2.5rem]">
          <img 
            src={mainImage} 
            alt={asset.title || 'Asset'} 
            className="w-full h-full object-cover opacity-90"
          />
          
          <div className="absolute inset-0 bg-gradient-to-b from-black/20 via-transparent to-black/40 pointer-events-none" />

          {/* Floating Header Buttons (Back, Like, Save) */}
          <div className="absolute top-6 left-5 right-5 flex justify-between items-center z-[100]">
            <button 
              onClick={() => navigate(-1)}
              className="w-10 h-10 rounded-full bg-white/20 backdrop-blur-md border border-white/30 flex items-center justify-center text-white cursor-pointer hover:bg-white/30 transition-colors"
            >
              <ArrowLeft size={20} />
            </button>
            
            <div className="flex gap-2">
              <button 
                onClick={() => setIsLiked(!isLiked)}
                className="w-10 h-10 rounded-full bg-white/20 backdrop-blur-md border border-white/30 flex items-center justify-center text-white cursor-pointer hover:bg-white/30 transition-colors"
              >
                <Heart size={18} className={isLiked ? "fill-rose-500 text-rose-500" : ""} />
              </button>
              <button 
                onClick={() => setIsSaved(!isSaved)}
                className="w-10 h-10 rounded-full bg-white/20 backdrop-blur-md border border-white/30 flex items-center justify-center text-white cursor-pointer hover:bg-white/30 transition-colors"
              >
                <Bookmark size={18} className={isSaved ? "fill-indigo-500 text-indigo-500" : ""} />
              </button>
            </div>
          </div>

          {/* Floating Glassmorphic Thumbnails */}
          {thumbnails.length > 0 && (
            <div className="absolute bottom-8 left-1/2 -translate-x-1/2 z-20 w-[92%] max-w-sm">
              <div className="bg-white/10 backdrop-blur-xl border border-white/20 rounded-[2rem] p-2 flex justify-between shadow-2xl">
                {thumbnails.map((thumb: string, index: number) => (
                  <div key={index} className="w-[4.4rem] h-[4.4rem] rounded-2xl overflow-hidden shadow-sm bg-slate-800">
                    <img src={thumb} className="w-full h-full object-cover" />
                  </div>
                ))}
                {extraImagesCount > 0 ? (
                  <div className="w-[4.4rem] h-[4.4rem] rounded-2xl bg-black/30 backdrop-blur-md flex items-center justify-center text-white font-bold text-sm border border-white/10">
                    +{extraImagesCount}
                  </div>
                ) : (
                  <div className="w-[4.4rem] h-[4.4rem] rounded-2xl bg-transparent" /> // Spacer
                )}
              </div>
            </div>
          )}
        </div>

        {/* =========================================================
            2. CONTENT SECTION (Clean Typography)
            ========================================================= */}
        <div className="relative z-10 bg-white px-7 pt-10 pb-8 min-h-[50vh]">
          
          {/* Title & Price Row */}
          <div className="flex justify-between items-start mb-10">
            <div className="flex-1 pr-4">
              <h1 className="text-3xl font-bold text-slate-900 tracking-tight leading-tight">
                {asset.title || 'Partner Update'}
              </h1>
              <p className="text-base font-medium text-slate-400 mt-0.5">
                {asset.is_event ? 'Guided Event / Trip' : 'Listed Asset'}
              </p>
            </div>
            {asset.price && (
              <div className="text-right shrink-0">
                <h2 className="text-3xl font-bold text-slate-900 leading-tight">₵{asset.price}</h2>
                <p className="text-[13px] font-bold text-slate-900">{asset.is_event ? 'per seat' : 'unit'}</p>
              </div>
            )}
          </div>

          {/* Info Details List */}
          <div className="space-y-8 mb-10">
            {/* Location & Provider Tag */}
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-4">
                
                {/* THE YELLOW PULSING PIN LOGIC */}
                <div className="relative flex items-center justify-center">
                  {asset.is_event && (
                    <div className="absolute inset-0 rounded-full bg-amber-400 animate-ping opacity-30"></div>
                  )}
                  <div className={`w-10 h-10 rounded-full flex items-center justify-center relative z-10 border ${
                    asset.is_event ? 'bg-amber-50 border-amber-200 text-amber-500 shadow-[0_0_15px_rgba(245,158,11,0.4)]' : 'bg-slate-50 border-slate-100 text-[#1da1f2]'
                  }`}>
                    <MapPin size={18} strokeWidth={2} />
                  </div>
                </div>

                <span className="text-[15px] font-medium text-slate-800">{asset.location || 'Location TBD'}</span>
              </div>
              
              {/* Partner Verification Detail */}
              <div className="bg-slate-50 border border-slate-100 rounded-2xl p-2 px-3 flex flex-col items-end">
                 <div className="flex items-center gap-1.5 mb-1">
                    <span className="text-[13px] font-bold text-slate-900 truncate max-w-[120px]">{providerName}</span>
                    {asset.provider?.is_verified && (
                      <div className="flex items-center gap-1 bg-teal-500 text-white text-[8px] font-black px-1.5 py-0.5 rounded-md uppercase tracking-tighter">
                        <ShieldCheck size={8} strokeWidth={4} /> Verified
                      </div>
                    )}
                 </div>
                 <div className="flex items-center gap-1 text-[10px] font-bold text-slate-400">
                    Network Partner <div className="flex text-slate-900"><Star size={10} className="fill-slate-900" /> <Star size={10} className="fill-slate-900" /> <Star size={10} className="fill-slate-900" /> <Star size={10} className="fill-slate-900" /> <Star size={10} className="fill-slate-900" /></div>
                 </div>
              </div>
            </div>

            {/* Event Date & Time OR Standard Period */}
            {asset.is_event && (
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-4">
                  <div className="w-10 h-10 rounded-full bg-indigo-50 flex items-center justify-center text-indigo-500 border border-indigo-100">
                    <Calendar size={18} strokeWidth={2} />
                  </div>
                  <div>
                    <p className="text-[11px] font-medium text-slate-400 mb-0.5">Event Date</p>
                    <p className="text-[15px] font-bold text-slate-900">{asset.event_date || 'TBA'}</p>
                  </div>
                </div>
                {asset.event_time && (
                  <div className="text-right">
                    <p className="text-[11px] font-medium text-slate-400 mb-0.5">Schedule</p>
                    <span className="text-sm font-bold text-slate-800">{asset.event_time}</span>
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Description Content */}
          <div className="mb-10">
            <h3 className="text-sm font-black text-slate-900 mb-2">Description & Details</h3>
            <p className="text-[15px] leading-relaxed text-slate-600 whitespace-pre-wrap">
              {asset.content}
            </p>
          </div>

          {/* B2B / Event Specifications */}
          {asset.is_event && asset.capacity && (
            <div className="grid grid-cols-2 gap-4 mb-10">
               <SpecTile icon={<Users size={16} />} label="Group Capacity" value={`${asset.capacity} Seats Total`} />
               <SpecTile icon={<ShieldCheck size={16} />} label="Assurance" value="Platform Verified Trip" />
            </div>
          )}

          {/* PROVIDER OVERVIEW */}
          <div className="p-5 bg-slate-50 rounded-3xl border border-slate-100 flex items-center justify-between mb-8">
            <div className="flex items-center gap-4">
              <div className="w-12 h-12 rounded-full bg-indigo-100 flex items-center justify-center text-indigo-600 font-black overflow-hidden">
                {asset.provider?.avatar_url ? (
                  <img src={asset.provider.avatar_url} className="w-full h-full object-cover" />
                ) : (
                  <Building2 size={20} />
                )}
              </div>
              <div>
                <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">{asset.is_event ? 'Organized By' : 'Listed By'}</p>
                <p className="text-sm font-bold text-slate-800">{providerName}</p>
              </div>
            </div>
            
            <button 
              onClick={() => navigate(`/profile/${asset.provider?.id}`)}
              className="text-xs font-black text-indigo-600 uppercase tracking-widest hover:underline"
            >
              View Profile
            </button>
          </div>

          {/* =========================================================
              3. MAP FOOTER & ACTION
              ========================================================= */}
          <div className="relative h-44 w-full rounded-3xl overflow-hidden bg-slate-50 flex items-center justify-center mt-6 border border-slate-200">
            <div className="absolute inset-0 pointer-events-none">
              <iframe
                title="map"
                width="100%" height="200%" frameBorder="0" scrolling="no"
                src="https://www.openstreetmap.org/export/embed.html?bbox=-0.25,5.55,-0.15,5.65&layer=mapnik"
                className="grayscale contrast-100 opacity-20 -translate-y-12" 
              />
            </div>

            <button 
              onClick={handleBookNow}
              className={`relative z-10 w-[50%] h-[40%] max-w-sm py-4.5 rounded-3xl text-white font-medium text-[16px] flex items-center justify-center gap-1 shadow-[0_15px_35px_rgba(0,0,0,0.3)] active:scale-95 transition-all ${asset.is_event ? 'bg-amber-500 hover:bg-amber-600' : 'bg-[#2A2A2A] hover:bg-black'}`}
            >
              {asset.is_event ? 'Book Seat Now' : 'Book Now'} <ArrowRight size={20} strokeWidth={2} className="opacity-90" />
            </button>
          </div>

        </div>
      </div>
    </div>
  );
}

// Sub-component for Details Tiles
function SpecTile({ icon, label, value }: any) {
  return (
    <div className="p-4 bg-slate-50/50 rounded-2xl border border-slate-100 flex items-start gap-3">
      <div className="text-slate-400 mt-1">{icon}</div>
      <div>
        <p className="text-[11px] font-medium text-slate-400 leading-tight mb-1">{label}</p>
        <p className="text-[14px] font-bold text-slate-900 leading-tight">{value}</p>
      </div>
    </div>
  );
}