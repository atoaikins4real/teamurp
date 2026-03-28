import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { 
  Building2, Car, ChevronRight, ChevronLeft, 
  CheckCircle2, Loader2, MapPin, Camera, DollarSign
} from 'lucide-react';
import { supabase } from '../lib/supabase';

const BACKGROUND_IMAGES = [
  '/o-bg1.jpg',
  '/o-bg2.jpg',
  '/o-bg3.jpg',
  '/o-bg4.jpg'
];

export default function Onboarding() {
  const navigate = useNavigate();
  
  const [step, setStep] = useState(1);
  const [isSaving, setIsSaving] = useState(false);
  const [userId, setUserId] = useState<string | null>(null);
  const [bgIndex, setBgIndex] = useState(0);

  const [profileData, setProfileData] = useState({
    company: '',
    business_type: 'Fleet Provider',
    phone: '',
    bio: ''
  });

  const [serviceData, setServiceData] = useState({
    name: '',
    category: 'SUV',
    price: '',
  });

  useEffect(() => {
    const interval = setInterval(() => {
      setBgIndex((current) => (current + 1) % BACKGROUND_IMAGES.length);
    }, 6000); 
    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    const initWizard = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      
      if (!session) {
        navigate('/explore'); // Send to public explore if not logged in
        return;
      }
      
      setUserId(session.user.id);

      const { data: profile } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', session.user.id)
        .maybeSingle(); 
        
      // 🛑 THE FIX: Strictly bounce tourists out of the onboarding wizard
      if (profile?.user_role === 'tourist') {
         navigate('/explore', { replace: true });
         return;
      }

      // If they are a vendor and already have a company, send to feeds
      if (profile?.company) {
        navigate('/feeds', { replace: true }); 
      } else if (profile) {
        // Otherwise, prepopulate their name so they can finish onboarding
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

  const handleComplete = async (skippedAsset: boolean = false) => {
    if (!userId) return;
    setIsSaving(true);

    try {
      const { error: profileError } = await supabase
        .from('profiles')
        .upsert({
          id: userId, 
          company: profileData.company,
          business_type: profileData.business_type,
          phone: profileData.phone,
          bio: profileData.bio,
          // THE FIX: Explicitly lock their role in as a vendor/partner
          user_role: 'vendor' 
        });

      if (profileError) throw profileError;

      if (!skippedAsset && serviceData.name.trim() !== '') {
        await supabase.from('assets').insert({
          owner_id: userId,
          name: serviceData.name,
          category: serviceData.category,
          price_per_day: serviceData.price ? parseFloat(serviceData.price) : 0
        });
      }

      // Force a hard reload of the window to ensure the TenantContext 
      // picks up the newly assigned 'vendor' role instantly from the database
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
        <span className={`text-[10px] font-black uppercase tracking-wider ${
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
    <div className="min-h-screen relative flex flex-col items-center justify-center p-4 font-sans select-none overflow-hidden">
      
      {/* BACKGROUND SLIDESHOW LAYER */}
      <div className="absolute inset-0 z-0 bg-[#1e222b]">
        {BACKGROUND_IMAGES.map((img, index) => (
          <div
            key={img}
            className={`absolute inset-0 bg-cover bg-center bg-no-rotate transition-opacity duration-1000 ease-in-out ${
              index === bgIndex ? 'opacity-100' : 'opacity-0'
            }`}
            style={{ backgroundImage: `url(${img})` }}
          />
        ))}
        <div className="absolute inset-0 bg-slate-900/40 backdrop-blur-[2px]"></div>
      </div>

      {/* FOREGROUND CONTENT */}
      <div className="w-full max-w-xl relative z-10 animate-in fade-in zoom-in-95 duration-700">
        
        {/* Progress Header */}
        <div className="mb-8">
          <h1 className="text-3xl font-black text-white text-center mb-8 drop-shadow-lg">Set up your business</h1>
          <div className="flex items-center justify-between relative px-4">
            <div className="absolute left-8 right-8 top-1/2 -translate-y-1/2 h-1 bg-white/20 backdrop-blur-sm -z-10 rounded-full">
              <div 
                className="h-full bg-[#1da1f2] rounded-full transition-all duration-500 shadow-[0_0_10px_rgba(29,161,242,0.8)]" 
                style={{ width: step === 1 ? '0%' : step === 2 ? '50%' : '100%' }}
              ></div>
            </div>
            <StepIndicator currentStep={step} stepNum={1} icon={<Building2 size={16} />} label="Profile" />
            <StepIndicator currentStep={step} stepNum={2} icon={<Car size={16} />} label="First Asset" />
            <StepIndicator currentStep={step} stepNum={3} icon={<CheckCircle2 size={16} />} label="Done" />
          </div>
        </div>

        {/* Wizard Card */}
        <div className="bg-white/80 rounded-[2rem] p-6 md:p-8 shadow-[0_20px_40px_rgba(0,0,0,0.3)] relative overflow-hidden min-h-[400px] flex flex-col transition-all duration-300">
          
          {/* STEP 1: BUSINESS PROFILE */}
          {step === 1 && (
            <div className="flex-1 animate-in slide-in-from-right-8 duration-300">
              <h2 className="text-xl font-black text-slate-800 mb-1">Business Details</h2>
              <p className="text-xs font-bold text-slate-500 mb-6">How will partners recognize you on the network?</p>

              <div className="space-y-4">
                <div>
                  <label className="block text-[11px] font-bold text-slate-500 uppercase tracking-widest mb-1.5">Company / Display Name</label>
                  <input 
                    type="text" name="company" value={profileData.company} onChange={handleProfileChange}
                    placeholder="e.g. Ridge Tour Guides"
                    className="w-full px-4 py-3 rounded-xl border border-slate-200 bg-slate-50 focus:bg-white focus:border-[#1da1f2] focus:ring-1 focus:ring-[#1da1f2] outline-none transition-all text-sm font-semibold text-slate-800 shadow-sm"
                  />
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-[11px] font-bold text-slate-500 uppercase tracking-widest mb-1.5">Business Type</label>
                    <select 
                      name="business_type" value={profileData.business_type} onChange={handleProfileChange}
                      className="w-full px-4 py-3 rounded-xl border border-slate-200 bg-slate-50 focus:bg-white focus:border-[#1da1f2] focus:ring-1 focus:ring-[#1da1f2] outline-none transition-all text-sm font-semibold text-slate-800 shadow-sm cursor-pointer"
                    >
                      <option value="Fleet Provider">Fleet Provider</option>
                      <option value="Tour Agency">Tour Agency</option>
                      <option value="Accommodation">Accommodation</option>
                      <option value="Independent Guide">Independent Guide</option>
                      <option value="Pharmacy">Pharmacy</option>
                      <option value="Supermarket">Supermarket</option>
                      <option value="Food Vendor">Food Vendor</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-[11px] font-bold text-slate-500 uppercase tracking-widest mb-1.5">Phone Number <span className="text-slate-300 font-normal">(Optional)</span></label>
                    <input 
                      type="tel" name="phone" value={profileData.phone} onChange={handleProfileChange}
                      placeholder="+233 54..." 
                      className="w-full px-4 py-3 rounded-xl border border-slate-200 bg-slate-50 focus:bg-white focus:border-[#1da1f2] outline-none transition-all text-sm font-semibold text-slate-800 shadow-sm"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-[11px] font-bold text-slate-500 uppercase tracking-widest mb-1.5">Short Bio <span className="text-slate-300 font-normal">(Optional)</span></label>
                  <textarea 
                    name="bio" value={profileData.bio} onChange={handleProfileChange}
                    placeholder="Briefly describe your services..." rows={2}
                    className="w-full px-4 py-3 rounded-xl border border-slate-200 bg-slate-50 focus:bg-white focus:border-[#1da1f2] outline-none transition-all text-sm font-semibold text-slate-800 resize-none shadow-sm"
                  />
                </div>
              </div>
            </div>
          )}

          {/* STEP 2: FIRST ASSET / SERVICE */}
          {step === 2 && (
            <div className="flex-1 animate-in slide-in-from-right-8 duration-300 flex flex-col">
              <div>
                <h2 className="text-xl font-black text-slate-800 mb-1">Add your first service</h2>
                <p className="text-xs font-bold text-slate-500 mb-6">Give partners something to book. You can skip this and add it later.</p>

                <div className="space-y-4">
                  <div className="w-full h-24 rounded-2xl border-2 border-dashed border-slate-300 bg-slate-50 flex flex-col items-center justify-center text-slate-400 hover:bg-[#1da1f2]/5 hover:text-[#1da1f2] hover:border-[#1da1f2] transition-colors cursor-pointer group">
                    <Camera size={24} className="mb-1 group-hover:scale-110 transition-transform" />
                    <span className="text-xs font-bold">Upload Cover Photo</span>
                  </div>

                  <div>
                    <label className="block text-[11px] font-bold text-slate-500 uppercase tracking-widest mb-1.5">Service Name</label>
                    <input 
                      type="text" name="name" value={serviceData.name} onChange={handleServiceChange}
                      placeholder="e.g. 7-Seater Land Cruiser V8" 
                      className="w-full px-4 py-3 rounded-xl border border-slate-200 bg-slate-50 focus:bg-white focus:border-[#1da1f2] outline-none transition-all text-sm font-semibold text-slate-800 shadow-sm"
                    />
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="block text-[11px] font-bold text-slate-500 uppercase tracking-widest mb-1.5">Category</label>
                      <select name="category" value={serviceData.category} onChange={handleServiceChange} className="w-full px-4 py-3 rounded-xl border border-slate-200 bg-slate-50 focus:bg-white text-sm font-semibold shadow-sm cursor-pointer">
                        <option value="SUV">SUV</option>
                        <option value="Bus">Bus</option>
                        <option value="Room">Room</option>
                        <option value="Groceries">Groceries</option>
                        <option value="Pharmacy">Pharmacy</option>
                        <option value="Travel">Travel</option>
                      </select>
                    </div>
                    <div>
                      <label className="block text-[11px] font-bold text-slate-500 uppercase tracking-widest mb-1.5">Daily Rate (GHS)</label>
                      <div className="relative">
                        <DollarSign size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                        <input type="number" name="price" value={serviceData.price} onChange={handleServiceChange} placeholder="2500" className="w-full pl-8 pr-4 py-3 rounded-xl border border-slate-200 bg-slate-50 focus:bg-white text-sm font-semibold shadow-sm" />
                      </div>
                    </div>
                  </div>
                </div>
              </div>
              
              <div className="mt-6 text-center">
                <button onClick={() => handleComplete(true)} className="text-xs font-bold text-slate-400 hover:text-[#1da1f2] transition-colors hover:underline">
                  Skip this step for now
                </button>
              </div>
            </div>
          )}

          {/* STEP 3: SUCCESS */}
          {step === 3 && (
            <div className="flex-1 flex flex-col items-center justify-center text-center animate-in zoom-in-95 duration-500">
              <div className="w-24 h-24 bg-green-50 rounded-full flex items-center justify-center mb-6 shadow-inner">
                <CheckCircle2 size={48} className="text-green-500" />
              </div>
              <h2 className="text-2xl font-black text-slate-800 mb-3">You're all set!</h2>
              <p className="text-sm font-medium text-slate-500 max-w-[250px] leading-relaxed">
                Your business profile is created. Let's head to the map so you can pin your exact location.
              </p>
            </div>
          )}

          {/* Navigation Buttons */}
          <div className="mt-8 pt-6 border-t border-slate-100 flex justify-between items-center">
            {step > 1 && step < 3 ? (
              <button onClick={() => setStep(step - 1)} className="px-5 py-2.5 rounded-xl font-bold text-sm text-slate-500 bg-slate-50 hover:bg-slate-100 transition-colors flex items-center gap-1 shadow-sm">
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
                disabled={!serviceData.name.trim()}
                className="px-6 py-2.5 rounded-xl font-bold text-sm bg-[#1da1f2] text-white shadow-md hover:shadow-lg hover:bg-[#1a91da] transition-all flex items-center gap-1 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                Save Asset <ChevronRight size={16} />
              </button>
            )}

            {step === 3 && (
              <button 
                onClick={() => handleComplete(false)}
                disabled={isSaving}
                className="w-full py-4 rounded-xl font-black text-sm bg-slate-900 text-white shadow-lg hover:shadow-xl hover:-translate-y-0.5 hover:bg-slate-800 transition-all flex items-center justify-center gap-2"
              >
                {isSaving ? <Loader2 size={18} className="animate-spin" /> : <>Go to the Map <MapPin size={16} /></>}
              </button>
            )}
          </div>

        </div>
      </div>
    </div>
  );
}