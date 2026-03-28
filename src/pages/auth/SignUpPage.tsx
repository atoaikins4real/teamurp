import React, { useState } from 'react';
import { Mail, Eye, EyeOff, User, Loader2 } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { SlideshowLayout } from '../../layouts/SlideshowLayout';
import { supabase } from '../../lib/supabase';

const SignUpPage: React.FC = () => {
  const navigate = useNavigate();
  const [showPassword, setShowPassword] = useState(false);
  const [isSocialAuth, setIsSocialAuth] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');

  const [formData, setFormData] = useState({
    firstName: '',
    lastName: '',
    email: '',
    password: ''
  });

  const handleSignUp = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    setErrorMsg('');

    try {
      // Notice we are grabbing 'data' now!
      const { data, error } = await supabase.auth.signUp({
        email: formData.email,
        password: formData.password,
        options: {
          data: {
            first_name: formData.firstName,
            last_name: formData.lastName,
          }
        }
      });

      if (error) throw error;

      // THE FIX: If email confirmation is OFF, Supabase gives us a session instantly.
      if (data.session) {
        // They are officially logged in! Send them straight to the wizard.
        navigate('/onboarding');
      } else {
        // Fallback: If you ever turn Email Confirmations back on in the future
        alert("Account created successfully! Please check your email to verify.");
        navigate('/login');
      }

    } catch (error: any) {
      setErrorMsg(error.message || "Something went wrong during sign up.");
    } finally {
      setIsLoading(false);
    }
  };

  const handleOAuth = async (provider: 'google' | 'apple' | 'facebook') => {
    setIsLoading(true);
    setErrorMsg('');
    try {
      const { error } = await supabase.auth.signInWithOAuth({
        provider: provider,
        options: { redirectTo: `${window.location.origin}/onboarding` }
      });
      if (error) throw error;
    } catch (error: any) {
      setErrorMsg(error.message || `Something went wrong with ${provider} sign up.`);
      setIsLoading(false);
    }
  };

  return (
    <SlideshowLayout>
      <div className="bg-[#1e222b]/30 backdrop-blur-xl max-w-[480px] w-full rounded-[2.5rem] p-8 md:p-12 border border-white/5 shadow-[0_20px_40px_rgba(0,0,0,0.4)] relative animate-in fade-in slide-in-from-bottom-4 duration-700">
        
        <div className="mb-10">
          <p className="text-[18px] font-black text-slate-400 uppercase tracking-widest mb-3">Start for free</p>
          <h1 className="text-4xl font-bold text-white tracking-tight flex items-end">
            Create account<span className="text-[#1da1f2] text-5xl leading-[0.5] ml-1">.</span>
          </h1>
          
          <div className="mt-5 flex items-center gap-2 text-2xl text-slate-400">
            <span>Already A Member?</span>
            <a href="/login" className="font-bold text-[#1da1f2] hover:text-blue-400 transition-colors">Log In</a>
          </div>
        </div>

        {errorMsg && (
          <div className="mb-6 p-4 rounded-xl bg-rose-500/10 border border-rose-500/50 text-rose-500 text-sm font-bold">
            {errorMsg}
          </div>
        )}

        <form onSubmit={handleSignUp} className="space-y-4">
          
          {isSocialAuth ? (
            <div className="py-6 space-y-4 animate-in fade-in zoom-in-95 duration-300">
              <button type="button" onClick={() => handleOAuth('google')} disabled={isLoading} className="w-full flex items-center justify-center gap-3 p-4 rounded-2xl bg-[#2a2f3a]/80 border border-white/5 hover:bg-[#2a2f3a] text-white font-bold transition-all group">
                <img src="https://authjs.dev/img/providers/google.svg" alt="Google" className="h-5 group-hover:scale-110 transition-transform" />
                Sign up with Google
              </button>
              <button type="button" onClick={() => handleOAuth('apple')} disabled={isLoading} className="w-full flex items-center justify-center gap-3 p-4 rounded-2xl bg-[#2a2f3a]/80 border border-white/5 hover:bg-[#2a2f3a] text-white font-bold transition-all group">
                <img src="https://authjs.dev/img/providers/apple.svg" alt="Apple" className="h-5 invert group-hover:scale-110 transition-transform" />
                Sign up with Apple
              </button>
              <button type="button" onClick={() => handleOAuth('facebook')} disabled={isLoading} className="w-full flex items-center justify-center gap-3 p-4 rounded-2xl bg-[#1877f2]/90 border border-white/5 hover:bg-[#1877f2] text-white font-bold transition-all group">
                <img src="https://authjs.dev/img/providers/facebook.svg" alt="Facebook" className="h-5 invert group-hover:scale-110 transition-transform" />
                Sign up with Facebook
              </button>
            </div>
          ) : (
            <div className="space-y-4 animate-in fade-in zoom-in-95 duration-300">
              <div className="grid grid-cols-2 gap-4">
                <div className="relative">
                  <User size={18} className="absolute right-5 top-1/2 -translate-y-1/2 text-slate-500" />
                  <input 
                    type="text" required value={formData.firstName} onChange={(e) => setFormData({...formData, firstName: e.target.value})} placeholder="First name" 
                    className="w-full bg-[#2a2f3a]/80 text-base font-medium text-white placeholder:text-slate-500 rounded-2xl py-4 pl-5 pr-12 border border-transparent focus:border-[#1da1f2]/50 focus:bg-[#2a2f3a] focus:outline-none transition-all"
                  />
                </div>
                <div className="relative">
                  <User size={18} className="absolute right-5 top-1/2 -translate-y-1/2 text-slate-500" />
                  <input 
                    type="text" required value={formData.lastName} onChange={(e) => setFormData({...formData, lastName: e.target.value})} placeholder="Last name" 
                    className="w-full bg-[#2a2f3a]/80 text-base font-medium text-white placeholder:text-slate-500 rounded-2xl py-4 pl-5 pr-12 border border-transparent focus:border-[#1da1f2]/50 focus:bg-[#2a2f3a] focus:outline-none transition-all"
                  />
                </div>
              </div>

              <div className="relative">
                <Mail size={18} className="absolute right-5 top-1/2 -translate-y-1/2 text-slate-500" />
                <input 
                  type="email" required value={formData.email} onChange={(e) => setFormData({...formData, email: e.target.value})} placeholder="Email Address" 
                  className="w-full bg-[#2a2f3a]/80 text-base font-medium text-white placeholder:text-slate-500 rounded-2xl py-4 pl-5 pr-12 border border-transparent focus:border-[#1da1f2]/50 focus:bg-[#2a2f3a] focus:outline-none transition-all"
                />
              </div>

              <div className="relative">
                <button type="button" onClick={() => setShowPassword(!showPassword)} className="absolute right-5 top-1/2 -translate-y-1/2 text-slate-500 hover:text-white transition-colors z-10">
                  {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                </button>
                <input 
                  type={showPassword ? "text" : "password"} required value={formData.password} onChange={(e) => setFormData({...formData, password: e.target.value})} placeholder="Password (Min. 8 chars)" 
                  className="w-full bg-[#2a2f3a]/80 text-base font-medium text-white placeholder:text-slate-500 rounded-2xl py-4 pl-5 pr-12 border border-transparent focus:border-[#1da1f2]/50 focus:bg-[#2a2f3a] focus:outline-none transition-all"
                />
              </div>
            </div>
          )}

          <div className="flex items-center gap-4 pt-4">
            <button type="button" onClick={() => setIsSocialAuth(!isSocialAuth)} className="flex-1 py-4 bg-[#2a2f3a] text-slate-300 rounded-full font-bold text-sm hover:bg-[#343a46] hover:text-white transition-all active:scale-[0.98]">
              {isSocialAuth ? "Use Email Instead" : "Try Other"}
            </button>
            
            {!isSocialAuth && (
              <button type="submit" disabled={isLoading} className="flex-1 py-4 bg-[#1da1f2] text-white rounded-full font-bold text-lg shadow-[0_8px_20px_rgba(29,161,242,0.3)] hover:bg-[#1a91da] transition-all active:scale-[0.98] disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2">
                {isLoading ? <Loader2 className="animate-spin" size={20} /> : "Create account"}
              </button>
            )}
          </div>
        </form>

      </div>
    </SlideshowLayout>
  );
};

export default SignUpPage;