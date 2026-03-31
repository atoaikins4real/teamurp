import React, { useState } from 'react';
import { Mail, Eye, EyeOff, Loader2 } from 'lucide-react';
import { SlideshowLayout } from '../../layouts/SlideshowLayout';
import { supabase } from '../../lib/supabase'; 
import { useNavigate } from 'react-router-dom';

const LoginPage: React.FC = () => {
  const navigate = useNavigate();
  const [showPassword, setShowPassword] = useState(false);
  
  // State for form data and loading/error handling
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');

  // Function to handle Email/Password Login
  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    setErrorMsg('');

    try {
      const { error } = await supabase.auth.signInWithPassword({
        email,
        password,
      });

      if (error) throw error;
      navigate('/feeds');

    } catch (error: any) {
      setErrorMsg(error.message || "Invalid email or password.");
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <SlideshowLayout>
      {/* FULL SCREEN OVERLAY
        - Mobile: flex-col (Info top, Card bottom)
        - Desktop: lg:flex-row-reverse (Info right, Card left)
        - Center aligned with a gap so they sit right next to each other
      */}
      <div className="absolute inset-0 w-full h-full flex flex-col lg:flex-row-reverse justify-start lg:justify-center items-center p-4 sm:p-8 lg:py-12 lg:pr-12 lg:pl-40 overflow-y-auto z-10 custom-scrollbar gap-8 lg:gap-20 pt-10 sm:pt-12 lg:pt-0 ">
        
        {/* ==========================================
            INFO SECTION (Top on Mobile, Right on Desktop)
            ========================================== */}
        <div className="w-full lg:flex-1 flex flex-col items-center lg:items-start text-center lg:text-left max-w-md lg:max-w-none animate-in fade-in slide-in-from-right-8 duration-1000 shrink-0">
          
          {/* caption */}
          <div className="flex items-center gap-0 sm:gap-3 mb-8 sm:mb-6">
            <div className="w-8 h-8 sm:w-10 sm:h-10 lg:w-12 lg:h-12 rounded-full bg-[#1da1f2] shadow-[0_0_20px_rgba(29,161,242,0.5)]"></div>
            <span className="text-3xl sm:text-4xl lg:text-6xl font-black text-white tracking-tight drop-shadow-xl">
              <span className="text-[#1da1f2]">.</span>
            </span>
          </div>

          {/* Tagline & Info */}
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
            LOGIN CARD (Bottom on Mobile, Left on Desktop)
            ========================================== */}
        <div className="w-full sm:max-w-[360px] shrink-0 mt-2 sm:mt-6 lg:mt-0 animate-in fade-in slide-in-from-bottom-8 duration-700 relative z-20">
          
          {/* Aggressively reduced padding on mobile (p-5) to shrink height */}
          <div className="bg-[#1e222b]/50 backdrop-blur-xl w-full rounded-[1.5rem] sm:rounded-[2rem] p-5 sm:p-8 border border-white/10 shadow-[0_20px_40px_rgba(0,0,0,0.4)]">
            
            {/* Header Area */}
            <div className="mb-4 sm:mb-6">
              <p className="text-[10px] sm:text-xs font-black text-slate-400 uppercase tracking-widest mb-1">Welcome Back</p>
              <h2 className="text-2xl sm:text-3xl font-bold text-white tracking-tight">
                Log In<span className="text-[#1da1f2]">.</span>
              </h2>
              
              <div className="mt-1.5 flex items-center gap-1.5 text-[11px] sm:text-xs text-slate-400">
                <span>New to TeamUrp?</span>
                <a href="/signup" className="font-bold text-[#1da1f2] hover:text-blue-400 transition-colors">Sign Up</a>
              </div>
            </div>

            {/* Error Message */}
            {errorMsg && (
              <div className="mb-3 p-2.5 rounded-xl bg-rose-500/10 border border-rose-500/50 text-rose-500 text-[11px] sm:text-xs font-bold animate-in fade-in">
                {errorMsg}
              </div>
            )}

            {/* Form - Tighter spacing on mobile (space-y-2.5) */}
            <form onSubmit={handleLogin} className="space-y-2.5 sm:space-y-3">
              
              {/* Email Input */}
              <div className="relative">
                <Mail size={16} className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-500" />
                <input 
                  type="email" 
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="Email address" 
                  className="w-full bg-[#2a2f3a]/80 text-sm font-medium text-white placeholder:text-slate-400 rounded-xl py-2.5 sm:py-3 px-4 pr-10 border border-transparent focus:border-[#1da1f2]/50 focus:bg-[#2a2f3a] focus:outline-none transition-all shadow-inner"
                />
              </div>

              {/* Password Input */}
              <div className="relative">
                <button 
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-400 hover:text-white transition-colors z-10"
                >
                  {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                </button>
                <input 
                  type={showPassword ? "text" : "password"} 
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="Password" 
                  className="w-full bg-[#2a2f3a]/80 text-sm font-medium text-white placeholder:text-slate-400 rounded-xl py-2.5 sm:py-3 px-4 pr-10 border border-transparent focus:border-[#1da1f2]/50 focus:bg-[#2a2f3a] focus:outline-none transition-all shadow-inner"
                />
              </div>

              {/* Forgot Password Link */}
              <div className="flex justify-end pt-0.5 pb-1">
                <a href="#" className="text-[11px] sm:text-xs font-semibold text-slate-400 hover:text-[#1da1f2] transition-colors">Forgot Password?</a>
              </div>

              {/* Primary Blue Button */}
              <button 
                type="submit"
                disabled={isLoading}
                className="w-full py-2.5 sm:py-3 bg-[#1da1f2] text-white rounded-full font-bold text-sm shadow-[0_8px_20px_rgba(29,161,242,0.3)] hover:bg-[#1a91da] transition-all active:scale-[0.98] disabled:opacity-50 flex items-center justify-center gap-2"
              >
                {isLoading ? <Loader2 className="animate-spin" size={16} /> : "Log In"}
              </button>
            </form>

          </div>
        </div>

      </div>
    </SlideshowLayout>
  );
};

export default LoginPage;