import React, { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { 
  Building2, Car, ChevronRight, ChevronLeft, Plus,
  CheckCircle2, Loader2, MapPin, Camera, DollarSign, X,
  Image as ImageIcon, Link as LinkIcon, Phone, FileText
} from 'lucide-react';
import { supabase } from '../lib/supabase';

const BACKGROUND_IMAGES = [
  '/o-bg1.jpg',
  '/o-bg2.jpg',
  '/o-bg3.jpg',
  '/o-bg4.jpg'
];

// Reusable upload helper
const uploadFile = async (file: File, bucket: string, userId: string) => {
  const ext = file.name.split('.').pop();
  const fileName = `${userId}-${Math.random().toString(36).substring(2, 15)}.${ext}`;
  const { error } = await supabase.storage.from(bucket).upload(fileName, file);
  if (error) throw error;
  return supabase.storage.from(bucket).getPublicUrl(fileName).data.publicUrl;
};

export default function Onboarding() {
  const navigate = useNavigate();
  
  const [step, setStep] = useState(1);
  const [isSaving, setIsSaving] = useState(false);
  const [userId, setUserId] = useState<string | null>(null);
  const [bgIndex, setBgIndex] = useState(0);

  // --- MEDIA STATES (Avatar removed) ---
  const [coverFile, setCoverFile] = useState<File | null>(null);
  const [coverPreview, setCoverPreview] = useState<string | null>(null);
  const coverInputRef = useRef<HTMLInputElement>(null);

  const [galleryFiles, setGalleryFiles] = useState<File[]>([]);
  const [galleryPreviews, setGalleryPreviews] = useState<string[]>([]);
  const galleryInputRef = useRef<HTMLInputElement>(null);

  // --- DATA STATES ---
  const [profileData, setProfileData] = useState({
    company: '',
    business_type: 'Tour Operator',
    phone: '',
    website: '',
    address: '',
    bio: ''
  });

  const [serviceData, setServiceData] = useState({
    name: '',
    category: 'SUV',
    price: '',
  });

  // Background Slideshow
  useEffect(() => {
    const interval = setInterval(() => {
      setBgIndex((current) => (current + 1) % BACKGROUND_IMAGES.length);
    }, 6000); 
    return () => clearInterval(interval);
  }, []);

  // Init Wizard
  useEffect(() => {
    const initWizard = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      
      if (!session) {
        navigate('/explore');
        return;
      }
      
      setUserId(session.user.id);

      const { data: profile } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', session.user.id)
        .maybeSingle(); 
        
      if (profile?.user_role === 'tourist') {
         navigate('/explore', { replace: true });
         return;
      }

      if (profile?.company) {
        navigate('/feeds', { replace: true }); 
      } else if (profile) {
        setProfileData(prev => ({
          ...prev,
          company: `${profile.first_name || ''} ${profile.last_name || ''}`.trim()
        }));
      }
    };

    initWizard();
  }, [navigate]);

  const handleProfileChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => {
    setProfileData({ ...profileData, [e.target.name]: e.target.value });
  };

  const handleServiceChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    setServiceData({ ...serviceData, [e.target.name]: e.target.value });
  };

  // --- MEDIA HANDLERS ---
  const handleCoverSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setCoverFile(file);
      setCoverPreview(URL.createObjectURL(file));
    }
  };

  const handleGallerySelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []);
    if (files.length > 0) {
      setGalleryFiles(prev => [...prev, ...files].slice(0, 6)); // Limit to 6 photos
      const newPreviews = files.map(file => URL.createObjectURL(file));
      setGalleryPreviews(prev => [...prev, ...newPreviews].slice(0, 6));
    }
    if (galleryInputRef.current) galleryInputRef.current.value = '';
  };

  const removeGalleryImage = (index: number) => {
    setGalleryFiles(prev => prev.filter((_, i) => i !== index));
    setGalleryPreviews(prev => {
      URL.revokeObjectURL(prev[index]);
      return prev.filter((_, i) => i !== index);
    });
  };

  // --- FINAL SUBMISSION ---
  const handleComplete = async (skippedAsset: boolean = false) => {
    if (!userId) return;
    setIsSaving(true);

    try {
      let coverUrl = null;
      let galleryUrls: string[] = [];

      // 1. Upload all media in parallel to speed things up
      const uploadPromises = [];

      if (coverFile) {
        uploadPromises.push(uploadFile(coverFile, 'cover', userId).then(url => coverUrl = url));
      }
      if (galleryFiles.length > 0) {
        const galleryPromises = galleryFiles.map(file => uploadFile(file, 'gallery', userId));
        uploadPromises.push(Promise.all(galleryPromises).then(urls => galleryUrls = urls));
      }

      // Wait for all images to finish uploading
      await Promise.all(uploadPromises);

      // 2. Prepare Profile Payload
      const profilePayload: any = {
        id: userId, 
        company: profileData.company,
        business_type: profileData.business_type,
        phone: profileData.phone,
        website: profileData.website,
        location: profileData.address, // Saving address to the existing 'location' column
        bio: profileData.bio,
        user_role: 'vendor' 
      };

      if (coverUrl) profilePayload.cover_url = coverUrl;
      if (galleryUrls.length > 0) profilePayload.gallery_urls = galleryUrls; 

      // 3. Upsert the Profile (Avatar is untouched, so it stays perfectly intact in the DB)
      const { error: profileError } = await supabase.from('profiles').upsert(profilePayload);
      if (profileError) throw profileError;

      // 4. Save the Service/Asset (if not skipped)
      if (!skippedAsset && serviceData.name.trim() !== '') {
        await supabase.from('assets').insert({
          owner_id: userId,
          name: serviceData.name,
          category: serviceData.category,
          price_per_day: serviceData.price ? parseFloat(serviceData.price) : 0
        });
      }

      window.location.href = '/feeds';
      
    } catch (error: any) {
      console.error("FULL ERROR LOG:", error);
      alert(`Error: ${error.message}`);
    } finally {
      setIsSaving(false);
    }
  };

  const StepIndicator = ({ currentStep, stepNum, icon, label }: any) => {
    const isCompleted = currentStep > stepNum;
    const isCurrent = currentStep === stepNum;
    return (
      <div className="flex flex-col items-center gap-2 relative z-10 px-2 ">
        <div className={`w-10 h-10 rounded-full flex items-center justify-center border-2 transition-all duration-300 ${
          isCompleted ? 'bg-[#1da1f2] border-[#1da1f2] text-white shadow-[0_0_15px_rgba(29,161,242,0.5)]' :
          isCurrent ? 'bg-white border-[#1da1f2] text-[#1da1f2] shadow-lg ' :
          'bg-white/20 border-white/80 text-slate-100 backdrop-blur-md '
        }`}>
          {isCompleted ? <CheckCircle2 size={18} /> : icon}
        </div>
        <span className={`text-[9px] sm:text-[10px] font-black uppercase tracking-wider ${
          isCurrent || isCompleted ? 'text-white drop-shadow-md' : 'text-white/60'
        }`}>
          {label}
        </span>
      </div>
    );
  };

  if (!userId) {
    return (
      <div className="min-h-screen bg-[#1e222b] flex items-center justify-center">
        <Loader2 className="animate-spin text-[#1da1f2]" />
      </div>
    );
  }

  return (
    <div className="min-h-screen relative flex flex-col items-center justify-center p-4 font-sans select-none overflow-x-hidden overflow-y-auto">
      
      {/* BACKGROUND SLIDESHOW LAYER */}
      <div className="fixed inset-0 z-0 bg-[#1e222b]">
        {BACKGROUND_IMAGES.map((img, index) => (
          <div
            key={img}
            className={`absolute inset-0 bg-cover bg-center bg-no-repeat transition-opacity duration-1000 ease-in-out ${
              index === bgIndex ? 'opacity-100' : 'opacity-0'
            }`}
            style={{ backgroundImage: `url(${img})` }}
          />
        ))}
        <div className="absolute inset-0 bg-slate-900/40 backdrop-blur-[3px]"></div>
      </div>

      {/* FOREGROUND CONTENT */}
      <div className="w-full max-w-xl relative z-10 animate-in fade-in zoom-in-95 duration-700 py-10">
        
        {/* Progress Header */}
        <div className="mb-8">
          <h1 className="text-3xl font-black text-white text-center mb-8 drop-shadow-lg">Build your brand</h1>
          <div className="flex items-center justify-between relative px-2 sm:px-4">
            <div className="absolute left-8 right-8 top-1/2 -translate-y-1/2 h-1 bg-white/20 backdrop-blur-sm -z-10 rounded-full">
              <div 
                className="h-full bg-[#1da1f2] rounded-full transition-all duration-500 shadow-[0_0_10px_rgba(29,161,242,0.8)]" 
                style={{ width: step === 1 ? '0%' : step === 2 ? '33%' : step === 3 ? '66%' : '100%' }}
              ></div>
            </div>
            <StepIndicator currentStep={step} stepNum={1} icon={<Building2 size={16} />} label="Identity" />
            <StepIndicator currentStep={step} stepNum={2} icon={<ImageIcon size={16} />} label="Media" />
            <StepIndicator currentStep={step} stepNum={3} icon={<Car size={16} />} label="Asset" />
            <StepIndicator currentStep={step} stepNum={4} icon={<CheckCircle2 size={16} />} label="Done" />
          </div>
        </div>

        {/* Wizard Card */}
        <div className="bg-white/90 backdrop-blur-md rounded-[2rem] p-5 sm:p-8 shadow-[0_20px_40px_rgba(0,0,0,0.3)] relative overflow-hidden min-h-[450px] flex flex-col transition-all duration-300">
          
          {/* STEP 1: BUSINESS PROFILE */}
          {step === 1 && (
            <div className="flex-1 animate-in slide-in-from-right-8 duration-300">
              <div className="mb-6">
                <h2 className="text-xl font-black text-slate-800 mb-1">Business Identity</h2>
                <p className="text-xs font-bold text-slate-500">How will partners recognize you?</p>
              </div>

              <div className="space-y-4">
                <div>
                  <label className="block text-[11px] font-bold text-slate-500 uppercase tracking-widest mb-1.5">Company Name</label>
                  <input 
                    type="text" name="company" value={profileData.company} onChange={handleProfileChange}
                    placeholder="e.g. Ridge Tour Guides"
                    className="w-full px-4 py-3 rounded-xl border border-slate-200 bg-white focus:border-[#1da1f2] focus:ring-1 focus:ring-[#1da1f2] outline-none transition-all text-sm font-bold text-slate-800 shadow-sm"
                  />
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-[11px] font-bold text-slate-500 uppercase tracking-widest mb-1.5">Business Type</label>
                    <select 
                      name="business_type" value={profileData.business_type} onChange={handleProfileChange}
                      className="w-full px-4 py-3 rounded-xl border border-slate-200 bg-white focus:border-[#1da1f2] focus:ring-1 focus:ring-[#1da1f2] outline-none transition-all text-sm font-bold text-slate-800 shadow-sm cursor-pointer"
                    >
                      <option value="Hotelier / Accommodation">Hotelier / Accommodation</option>
                      <option value="Transportation / Fleet">Transportation / Fleet</option>
                      <option value="Travel & Tour Company">Travel & Tour Company</option>
                      <option value="Tour Operator">Tour Operator</option>
                      <option value="Tour Agent">Tour Agent</option>
                      <option value="Independent Tour Guide">Independent Tour Guide</option>
                      <option value="Food & Beverage">Food & Beverage</option>
                      <option value="Supermarket / Groceries">Supermarket / Groceries</option>
                      <option value="Pharmacy">Pharmacy</option>
                      <option value="Event Organizer">Event Organizer</option>
                      <option value="Photography & Video">Photography & Video</option>
                      <option value="Travel Gear Rental">Travel Gear Rental</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-[11px] font-bold text-slate-500 uppercase tracking-widest mb-1.5">Phone Number</label>
                    <div className="relative">
                      <Phone size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                      <input 
                        type="tel" name="phone" value={profileData.phone} onChange={handleProfileChange}
                        placeholder="+233 54..." 
                        className="w-full pl-8 pr-4 py-3 rounded-xl border border-slate-200 bg-white focus:border-[#1da1f2] outline-none transition-all text-sm font-bold text-slate-800 shadow-sm"
                      />
                    </div>
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-[11px] font-bold text-slate-500 uppercase tracking-widest mb-1.5">Website / Booking Link</label>
                    <div className="relative">
                      <LinkIcon size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                      <input 
                        type="url" name="website" value={profileData.website} onChange={handleProfileChange}
                        placeholder="www.yourwebsite.com" 
                        className="w-full pl-8 pr-4 py-3 rounded-xl border border-slate-200 bg-white focus:border-[#1da1f2] outline-none transition-all text-sm font-bold text-slate-800 shadow-sm"
                      />
                    </div>
                  </div>
                  <div>
                    <label className="block text-[11px] font-bold text-slate-500 uppercase tracking-widest mb-1.5">Main Office Location</label>
                    <div className="relative">
                      <MapPin size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                      <input 
                        type="text" name="address" value={profileData.address} onChange={handleProfileChange}
                        placeholder="Accra, Ghana" 
                        className="w-full pl-8 pr-4 py-3 rounded-xl border border-slate-200 bg-white focus:border-[#1da1f2] outline-none transition-all text-sm font-bold text-slate-800 shadow-sm"
                      />
                    </div>
                  </div>
                </div>

                <div>
                  <label className="block text-[11px] font-bold text-slate-500 uppercase tracking-widest mb-1.5">About your business</label>
                  <div className="relative">
                    <FileText size={14} className="absolute left-3 top-3 text-slate-400" />
                    <textarea 
                      name="bio" value={profileData.bio} onChange={handleProfileChange}
                      placeholder="Briefly describe your services, experience, and what makes you unique..." rows={2}
                      className="w-full pl-8 pr-4 py-3 rounded-xl border border-slate-200 bg-white focus:border-[#1da1f2] outline-none transition-all text-sm font-bold text-slate-800 resize-none shadow-sm"
                    />
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* STEP 2: MEDIA & PORTFOLIO */}
          {step === 2 && (
            <div className="flex-1 animate-in slide-in-from-right-8 duration-300">
              <h2 className="text-xl font-black text-slate-800 mb-1">Brand Visuals</h2>
              <p className="text-xs font-bold text-slate-500 mb-6">Upload a cover photo and a gallery of your work.</p>

              <div className="space-y-6">
                {/* COVER PHOTO */}
                <div>
                  <label className="block text-[11px] font-bold text-slate-500 uppercase tracking-widest mb-1.5">Main Cover Photo</label>
                  <input type="file" accept="image/*" ref={coverInputRef} onChange={handleCoverSelect} className="hidden" />
                  <div 
                    onClick={() => coverInputRef.current?.click()}
                    className={`w-full h-32 rounded-2xl border-2 border-dashed overflow-hidden flex flex-col items-center justify-center transition-all cursor-pointer group relative ${coverPreview ? 'border-transparent bg-slate-900' : 'border-slate-300 bg-slate-50 hover:bg-[#1da1f2]/5 hover:text-[#1da1f2] hover:border-[#1da1f2] text-slate-400'}`}
                  >
                    {coverPreview ? (
                      <>
                        <img src={coverPreview} className="absolute inset-0 w-full h-full object-cover opacity-80 group-hover:opacity-60 transition-opacity" />
                        <div className="relative z-10 flex items-center gap-2 px-4 py-2 bg-black/50 backdrop-blur-sm rounded-full text-white font-bold text-xs opacity-0 group-hover:opacity-100 transition-opacity">
                          <Camera size={14} /> Change Cover
                        </div>
                      </>
                    ) : (
                      <>
                        <ImageIcon size={24} className="mb-1 group-hover:scale-110 transition-transform" />
                        <span className="text-xs font-bold">Upload Cover</span>
                      </>
                    )}
                  </div>
                </div>

                {/* GALLERY */}
                <div>
                  <div className="flex justify-between items-end mb-1.5">
                    <label className="block text-[11px] font-bold text-slate-500 uppercase tracking-widest">Portfolio Gallery</label>
                    <span className="text-[10px] font-bold text-slate-400">{galleryPreviews.length}/6 photos</span>
                  </div>
                  
                  <input type="file" accept="image/*" multiple ref={galleryInputRef} onChange={handleGallerySelect} className="hidden" />
                  
                  <div className="grid grid-cols-3 gap-2 sm:gap-3">
                    {galleryPreviews.map((preview, index) => (
                      <div key={index} className="aspect-square rounded-xl overflow-hidden relative group border border-slate-200 shadow-sm">
                        <img src={preview} className="w-full h-full object-cover" />
                        <button 
                          onClick={() => removeGalleryImage(index)}
                          className="absolute top-1 right-1 p-1 bg-black/50 hover:bg-rose-500 text-white rounded-full transition-colors z-10 opacity-0 group-hover:opacity-100"
                        >
                          <X size={12} />
                        </button>
                      </div>
                    ))}
                    
                    {galleryPreviews.length < 6 && (
                      <div 
                        onClick={() => galleryInputRef.current?.click()}
                        className="aspect-square rounded-xl border-2 border-dashed border-slate-300 bg-slate-50 flex flex-col items-center justify-center text-slate-400 hover:text-[#1da1f2] hover:border-[#1da1f2] hover:bg-[#1da1f2]/5 transition-colors cursor-pointer"
                      >
                        <Plus size={20} className="mb-1" />
                        <span className="text-[10px] font-bold">Add Photo</span>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* STEP 3: FIRST ASSET / SERVICE */}
          {step === 3 && (
            <div className="flex-1 animate-in slide-in-from-right-8 duration-300 flex flex-col">
              <div>
                <h2 className="text-xl font-black text-slate-800 mb-1">Add your first service</h2>
                <p className="text-xs font-bold text-slate-500 mb-6">Give partners something specific to book.</p>

                <div className="space-y-4">
                  <div>
                    <label className="block text-[11px] font-bold text-slate-500 uppercase tracking-widest mb-1.5">Service Name</label>
                    <input 
                      type="text" name="name" value={serviceData.name} onChange={handleServiceChange}
                      placeholder="e.g. 7-Seater Land Cruiser V8, 3-Day Safari Tour..." 
                      className="w-full px-4 py-3 rounded-xl border border-slate-200 bg-white focus:border-[#1da1f2] outline-none transition-all text-sm font-bold text-slate-800 shadow-sm"
                    />
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="block text-[11px] font-bold text-slate-500 uppercase tracking-widest mb-1.5">Category</label>
                      <select name="category" value={serviceData.category} onChange={handleServiceChange} className="w-full px-4 py-3 rounded-xl border border-slate-200 bg-white focus:border-[#1da1f2] text-sm font-bold shadow-sm cursor-pointer outline-none">
                        <option value="SUV">SUV</option>
                        <option value="Bus">Bus</option>
                        <option value="Tour Package">Tour Package</option>
                        <option value="Room">Room</option>
                        <option value="Groceries">Groceries</option>
                        <option value="Pharmacy">Pharmacy</option>
                        <option value="Event Space">Event Space</option>
                        <option value="Gear Rental">Gear Rental</option>
                      </select>
                    </div>
                    <div>
                      <label className="block text-[11px] font-bold text-slate-500 uppercase tracking-widest mb-1.5">Rate (GHS)</label>
                      <div className="relative">
                        <DollarSign size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                        <input type="number" name="price" value={serviceData.price} onChange={handleServiceChange} placeholder="2500" className="w-full pl-8 pr-4 py-3 rounded-xl border border-slate-200 bg-white focus:border-[#1da1f2] text-sm font-bold shadow-sm outline-none" />
                      </div>
                    </div>
                  </div>
                </div>
              </div>
              
              <div className="mt-8 text-center">
                <button onClick={() => handleComplete(true)} className="text-xs font-bold text-slate-400 hover:text-[#1da1f2] transition-colors hover:underline">
                  Skip this specific asset for now
                </button>
              </div>
            </div>
          )}

          {/* STEP 4: SUCCESS */}
          {step === 4 && (
            <div className="flex-1 flex flex-col items-center justify-center text-center animate-in zoom-in-95 duration-500">
              <div className="w-24 h-24 bg-green-50 rounded-full flex items-center justify-center mb-6 shadow-[inset_0_0_20px_rgba(34,197,94,0.2)]">
                <CheckCircle2 size={48} className="text-green-500" />
              </div>
              <h2 className="text-2xl font-black text-slate-800 mb-3">You're all set!</h2>
              <p className="text-sm font-medium text-slate-500 max-w-[280px] leading-relaxed">
                Your business profile is created. Let's head to the network so you can start connecting.
              </p>
            </div>
          )}

          {/* Navigation Buttons */}
          <div className="mt-8 pt-6 border-t border-slate-100 flex justify-between items-center">
            {step > 1 && step < 4 ? (
              <button onClick={() => setStep(step - 1)} disabled={isSaving} className="px-5 py-2.5 rounded-xl font-bold text-sm text-slate-500 bg-slate-50 hover:bg-slate-100 transition-colors flex items-center gap-1 shadow-sm disabled:opacity-50">
                <ChevronLeft size={16} /> Back
              </button>
            ) : <div />}

            {step === 1 && (
              <button 
                onClick={() => setStep(step + 1)}
                disabled={!profileData.company.trim()}
                className="px-6 py-2.5 rounded-xl font-bold text-sm bg-[#1da1f2] text-white shadow-md hover:shadow-lg hover:bg-[#1a91da] transition-all flex items-center gap-1 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                Next Step <ChevronRight size={16} />
              </button>
            )}

            {step === 2 && (
              <button 
                onClick={() => setStep(step + 1)}
                className="px-6 py-2.5 rounded-xl font-bold text-sm bg-[#1da1f2] text-white shadow-md hover:shadow-lg hover:bg-[#1a91da] transition-all flex items-center gap-1"
              >
                Next Step <ChevronRight size={16} />
              </button>
            )}

            {step === 3 && (
              <button 
                onClick={() => {
                  if (serviceData.name.trim() !== '') {
                    handleComplete(false);
                  } else {
                    setStep(4);
                  }
                }}
                disabled={isSaving}
                className="px-6 py-2.5 rounded-xl font-bold text-sm bg-[#1da1f2] text-white shadow-md hover:shadow-lg hover:bg-[#1a91da] transition-all flex items-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {isSaving ? <><Loader2 size={16} className="animate-spin" /> Saving...</> : <>Complete Profile <CheckCircle2 size={16} /></>}
              </button>
            )}

            {step === 4 && (
              <button 
                onClick={() => handleComplete(true)} // Skips asset save again just to route
                disabled={isSaving}
                className="w-full py-4 rounded-xl font-black text-sm bg-slate-900 text-white shadow-lg hover:shadow-xl hover:-translate-y-0.5 hover:bg-slate-800 transition-all flex items-center justify-center gap-2 disabled:opacity-50"
              >
                {isSaving ? <Loader2 size={18} className="animate-spin" /> : <>Enter Network <MapPin size={16} /></>}
              </button>
            )}
          </div>

        </div>
      </div>
    </div>
  );
}