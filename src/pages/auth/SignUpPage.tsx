import React, { useState } from 'react';
import { Mail, Eye, EyeOff, User, Loader2, AtSign } from 'lucide-react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { SlideshowLayout } from '../../layouts/SlideshowLayout';
import { supabase } from '../../lib/supabase';

const SignUpPage: React.FC = () => {
  const navigate = useNavigate();
  const [showPassword, setShowPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');

  // READ THE URL SILENTLY: Lock in their role based on what they clicked in the sidebar
  const [searchParams] = useSearchParams();
  const accountType = searchParams.get('type') === 'vendor' ? 'vendor' : 'tourist';
  
  const [formData, setFormData] = useState({
    firstName: '',
    lastName: '',
    username: '', // <-- New field added
    email: '',
    password: ''
  });

  const handleSignUp = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    setErrorMsg('');

    try {
      // Build the metadata
      const userMetadata: any = {
        first_name: formData.firstName,
        last_name: formData.lastName,
        role: accountType
      };

      // Only attach the username if they are a vendor
      if (accountType === 'vendor') {
        userMetadata.username = formData.username;
      }

      const { data, error } = await supabase.auth.signUp({
        email: formData.email,
        password: formData.password,
        options: {
          data: userMetadata // <--- Injects the role and username seamlessly!
        }
      });

      if (error) throw error;

      if (data.session) {
        // SMART ROUTING: Send them to the right place based on their URL choice
        if (accountType === 'vendor') {
          navigate('/onboarding');
        } else {
          navigate('/feeds'); 
        }
      } else {
        // If email confirmation is required by your Supabase settings
        alert("Account created successfully! Please check your email to verify.");
        navigate('/login');
      }

    } catch (error: any) {
      // If they actually meant to just log in because they already have an account
      if (error.message.includes("already registered")) {
        setErrorMsg("You already have an account! Please use the Log In link below.");
      } else {
        setErrorMsg(error.message || "Something went wrong during sign up.");
      }
    } finally {
      setIsLoading(false);
    }
  };

  // Helper to force clean usernames (lowercase, no spaces, only letters/numbers/underscores)
  const handleUsernameChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const cleanUsername = e.target.value.toLowerCase().replace(/[^a-z0-9_]/g, '');
    setFormData({ ...formData, username: cleanUsername });
  };

  return (
    <SlideshowLayout>
      <div className="absolute inset-0 w-full h-full flex flex-col lg:flex-row-reverse justify-start lg:justify-center items-center p-4 sm:p-8 lg:py-12 lg:pr-12 lg:pl-40 overflow-y-auto z-10 custom-scrollbar gap-8 lg:gap-20 pt-10 sm:pt-12 lg:pt-0">
        
        {/* ==========================================
            INFO SECTION
            ========================================== */}
        <div className="w-full lg:flex-1 flex flex-col items-center lg:items-start text-center lg:text-left max-w-md lg:max-w-none animate-in fade-in slide-in-from-right-8 duration-1000 shrink-0">
          <div className="flex items-center gap-2 sm:gap-3 mb-3 sm:mb-6">
            <div className="w-8 h-8 sm:w-10 sm:h-10 lg:w-12 lg:h-12 rounded-full bg-[#1da1f2] shadow-[0_0_20px_rgba(29,161,242,0.5)]"></div>
            <span className="text-3xl sm:text-4xl lg:text-6xl font-black text-white tracking-tight drop-shadow-xl">
              TeamUrp<span className="text-[#1da1f2]">.</span>
            </span>
          </div>
          <div>
            <h2 className="text-xl sm:text-2xl lg:text-4xl font-bold text-white mb-2 sm:mb-4 drop-shadow-lg leading-tight">
              The Global Tourism <br className="hidden lg:block"/> & Partner Network.
            </h2>
            <p className="text-xs sm:text-sm lg:text-base text-slate-200 drop-shadow-md font-medium leading-relaxed bg-black/20 p-3 sm:p-4 rounded-xl sm:rounded-2xl backdrop-blur-sm border border-white/10 max-w-md mx-auto lg:mx-0">
              Connect with verified fleet operators, tour guides, and luxury stays. Streamline your bookings and build your B2B network in real-time.
            </p>
          </div>
        </div>

        {/* ==========================================
            SIGN UP / SIGN IN CARD
            ========================================== */}
        <div className="w-full sm:max-w-[360px] shrink-0 mt-2 sm:mt-6 lg:mt-0 animate-in fade-in slide-in-from-bottom-8 duration-700 relative z-20">
          <div className="bg-[#1e222b]/50 backdrop-blur-xl w-full rounded-[1.5rem] sm:rounded-[2rem] p-5 sm:p-8 border border-white/10 shadow-[0_20px_40px_rgba(0,0,0,0.4)]">
            
            <div className="mb-4 sm:mb-5">
              <p className="text-[10px] sm:text-xs font-black text-slate-400 uppercase tracking-widest mb-1">
                {accountType === 'vendor' ? 'Start for free' : 'Authenticate'}
              </p>
              <h2 className="text-2xl sm:text-3xl font-bold text-white tracking-tight">
                {accountType === 'vendor' ? 'Sign Up as Partner' : 'Sign In to Explore'}<span className="text-[#1da1f2]">.</span>
              </h2>
              <div className="mt-1.5 flex items-center gap-1.5 text-[11px] sm:text-xs text-slate-400">
                <span>Already A Member?</span>
                <a href="/login" className="font-bold text-[#1da1f2] hover:text-blue-400 transition-colors">Log In</a>
              </div>
            </div>

            {errorMsg && (
              <div className="mb-3 p-2.5 rounded-xl bg-rose-500/10 border border-rose-500/50 text-rose-500 text-[11px] sm:text-xs font-bold animate-in fade-in">
                {errorMsg}
              </div>
            )}

            <form onSubmit={handleSignUp} className="space-y-3">
              <div className="space-y-2.5 sm:space-y-3 animate-in fade-in zoom-in-95 duration-300">
                <div className="grid grid-cols-2 gap-2 sm:gap-3">
                  <div className="relative">
                    <User size={16} className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-500" />
                    <input 
                      type="text" required value={formData.firstName} onChange={(e) => setFormData({...formData, firstName: e.target.value})} placeholder="First name" 
                      className="w-full bg-[#2a2f3a]/80 text-sm font-medium text-white placeholder:text-slate-400 rounded-xl py-2.5 sm:py-3 px-3.5 pr-8 border border-transparent focus:border-[#1da1f2]/50 focus:bg-[#2a2f3a] focus:outline-none transition-all shadow-inner"
                    />
                  </div>
                  <div className="relative">
                    <User size={16} className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-500" />
                    <input 
                      type="text" required value={formData.lastName} onChange={(e) => setFormData({...formData, lastName: e.target.value})} placeholder="Last name" 
                      className="w-full bg-[#2a2f3a]/80 text-sm font-medium text-white placeholder:text-slate-400 rounded-xl py-2.5 sm:py-3 px-3.5 pr-8 border border-transparent focus:border-[#1da1f2]/50 focus:bg-[#2a2f3a] focus:outline-none transition-all shadow-inner"
                    />
                  </div>
                </div>

                {/* 👇 NEW: VENDOR USERNAME FIELD 👇 */}
                {accountType === 'vendor' && (
                  <div className="relative">
                    <AtSign size={16} className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-500" />
                    <input 
                      type="text" required value={formData.username} onChange={handleUsernameChange} placeholder="username" 
                      className="w-full bg-[#2a2f3a]/80 text-sm font-medium text-white placeholder:text-slate-400 rounded-xl py-2.5 sm:py-3 pl-10 pr-4 border border-transparent focus:border-[#1da1f2]/50 focus:bg-[#2a2f3a] focus:outline-none transition-all shadow-inner"
                    />
                  </div>
                )}

                <div className="relative">
                  <Mail size={16} className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-500" />
                  <input 
                    type="email" required value={formData.email} onChange={(e) => setFormData({...formData, email: e.target.value})} placeholder="Email address" 
                    className="w-full bg-[#2a2f3a]/80 text-sm font-medium text-white placeholder:text-slate-400 rounded-xl py-2.5 sm:py-3 px-4 pr-10 border border-transparent focus:border-[#1da1f2]/50 focus:bg-[#2a2f3a] focus:outline-none transition-all shadow-inner"
                  />
                </div>

                <div className="relative">
                  <button type="button" onClick={() => setShowPassword(!showPassword)} className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-400 hover:text-white transition-colors z-10">
                    {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                  </button>
                  <input 
                    type={showPassword ? "text" : "password"} required value={formData.password} onChange={(e) => setFormData({...formData, password: e.target.value})} placeholder="Password (Min. 8 chars)" 
                    className="w-full bg-[#2a2f3a]/80 text-sm font-medium text-white placeholder:text-slate-400 rounded-xl py-2.5 sm:py-3 px-4 pr-10 border border-transparent focus:border-[#1da1f2]/50 focus:bg-[#2a2f3a] focus:outline-none transition-all shadow-inner"
                  />
                </div>
              </div>

              <div className="pt-4">
                <button type="submit" disabled={isLoading} className="w-full py-3 bg-[#1da1f2] text-white rounded-xl font-bold text-sm shadow-[0_8px_20px_rgba(29,161,242,0.3)] hover:bg-[#1a91da] transition-all active:scale-[0.98] disabled:opacity-50 flex items-center justify-center gap-2">
                  {isLoading ? <Loader2 className="animate-spin" size={18} /> : (accountType === 'vendor' ? 'Create Account' : 'Sign In')}
                </button>
              </div>
            </form>

          </div>
        </div>

      </div>
    </SlideshowLayout>
  );
};

export default SignUpPage;