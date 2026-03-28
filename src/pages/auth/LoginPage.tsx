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
  const [socialLoading, setSocialLoading] = useState<string | null>(null); // NEW: Tracks which social button is loading
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

      // Success! Send them to the app using React Router instead of a hard refresh
      navigate('/feeds');

    } catch (error: any) {
      setErrorMsg(error.message || "Invalid email or password.");
    } finally {
      setIsLoading(false);
    }
  };


  // NEW: Function to handle Social (OAuth) Login
  const handleSocialLogin = async (provider: 'google' | 'apple' | 'facebook') => {
    setSocialLoading(provider);
    setErrorMsg('');

    try {
      const { error } = await supabase.auth.signInWithOAuth({
        provider: provider,
        options: {
          // Redirect them to the feeds page after they approve the login
          redirectTo: `${window.location.origin}/feeds`,
        }
      });

      if (error) throw error;
      // Note: We don't set loading to false here because the browser will physically redirect to Google/Apple/FB

    } catch (error: any) {
      setErrorMsg(error.message || `Failed to log in with ${provider}.`);
      setSocialLoading(null);
    }
  };
  

  return (
    <SlideshowLayout>
      {/* Dark Glass Card matching the inspiration image */}
      <div className="bg-[#1e222b]/40 backdrop-blur-xl max-w-[440px] w-full rounded-[2.5rem] p-8 md:p-12 border border-white/5 shadow-[0_20px_40px_rgba(0,0,0,0.2)] relative animate-in fade-in slide-in-from-bottom-4 duration-700">
        
        {/* Header Area */}
        <div className="mb-10">
          <p className="text-[18px] font-black text-slate-400 uppercase tracking-widest mb-3">Welcome Back</p>
          <h1 className="text-5xl font-bold text-white tracking-tight flex items-end">
            Log In<span className="text-[#1da1f2] text-5xl leading-[0.5] ml-1">.</span>
          </h1>
          
          <div className="mt-5 flex items-center gap-2 text-2xl text-slate-400">
            <span>Already a Member?</span>
            <a href="/signup" className="font-bold text-[#1da1f2] hover:text-blue-400 transition-colors">Sign Up</a>
          </div>
        </div>

        {/* Error Message Display */}
        {errorMsg && (
          <div className="mb-6 p-4 rounded-xl bg-rose-500/10 border border-rose-500/50 text-rose-500 text-sm font-bold animate-in fade-in">
            {errorMsg}
          </div>
        )}

        {/* Email/Password Form */}
        <form onSubmit={handleLogin} className="space-y-4">
          
          {/* Email/Username Input */}
          <div className="relative">
            <Mail size={18} className="absolute right-5 top-1/2 -translate-y-1/2 text-slate-500" />
            <input 
              type="email" 
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="Email address" 
              className="w-full bg-[#2a2f3a]/80 text-lg font-medium text-white placeholder:text-slate-400 rounded-2xl py-4 px-5 border border-transparent focus:border-[#1da1f2]/50 focus:bg-[#2a2f3a] focus:outline-none transition-all"
            />
          </div>

          {/* Password Input */}
          <div className="relative">
            <button 
              type="button"
              onClick={() => setShowPassword(!showPassword)}
              className="absolute right-5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-white transition-colors z-10"
            >
              {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
            </button>
            <input 
              type={showPassword ? "text" : "password"} 
              required
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="Password" 
              className="w-full bg-[#2a2f3a]/80 text-lg font-medium text-white placeholder:text-slate-400 rounded-2xl py-4 px-5 pr-12 border border-transparent focus:border-[#1da1f2]/50 focus:bg-[#2a2f3a] focus:outline-none transition-all"
            />
          </div>

          {/* Forgot Password Link */}
          <div className="flex justify-end pt-2 pb-4">
            <a href="#" className="text-lg font-semibold text-slate-400 hover:text-[#1da1f2] transition-colors">Forgot Password?</a>
          </div>

          {/* Primary Blue Button */}
          <button 
            type="submit"
            disabled={isLoading || socialLoading !== null}
            className="w-full py-4 bg-[#1da1f2] text-white rounded-full font-bold text-lg shadow-[0_8px_20px_rgba(0,0,0,0.2)] hover:bg-[#1a91da] transition-all active:scale-[0.98] disabled:opacity-50 flex items-center justify-center gap-2"
          >
            {isLoading ? <Loader2 className="animate-spin" size={20} /> : "Log In"}
          </button>
        </form>


        {/* Dedicated Social Login Section */}
        <div className="mt-10 pt-8 border-t border-white/5">
          <div className="grid grid-cols-3 gap-4">
            
    
            {/* Google Button */}
            
            <button 
              type="button"
              onClick={() => handleSocialLogin('google')}
              disabled={socialLoading !== null}
              className="flex items-center justify-center p-3.5 rounded-2xl bg-[#2a2f3a]/50 border border-white/5 hover:bg-[#2a2f3a] transition-all group disabled:opacity-50"
            >
              {socialLoading === 'google' 
                ? <Loader2 className="animate-spin text-white h-5" /> 
                : <img src="https://authjs.dev/img/providers/google.svg" alt="Google" className="h-5 group-hover:scale-110 transition-transform" />
              }
            </button>
      
            {/* Apple Button */}
            {/*
            <button 
              type="button"
              onClick={() => handleSocialLogin('apple')}
              disabled={socialLoading !== null}
              className="flex items-center justify-center p-3.5 rounded-2xl bg-[#2a2f3a]/50 border border-white/5 hover:bg-[#2a2f3a] transition-all group disabled:opacity-50"
            >
              {socialLoading === 'apple' 
                ? <Loader2 className="animate-spin text-white h-5" /> 
                : <img src="https://authjs.dev/img/providers/apple.svg" alt="Apple" className="h-5 invert group-hover:scale-110 transition-transform" />
              }
            </button>

            {/* Facebook Button */}
    {/*        
            <button 
              type="button"
              onClick={() => handleSocialLogin('facebook')}
              disabled={socialLoading !== null}
              className="flex items-center justify-center p-3.5 rounded-2xl bg-[#2a2f3a]/50 border border-white/5 hover:bg-[#2a2f3a] transition-all group disabled:opacity-50"
            >
              {socialLoading === 'facebook' 
                ? <Loader2 className="animate-spin text-white h-5" /> 
                : <img src="https://authjs.dev/img/providers/facebook.svg" alt="Facebook" className="h-5 group-hover:scale-110 transition-transform" />
              }
            </button>
*/}
            

          </div>
        </div>
      </div>
    </SlideshowLayout>
  );
};

export default LoginPage;