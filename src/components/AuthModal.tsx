import React, { useState } from 'react';
import { Mail, Eye, EyeOff, Loader2, X, Lock, Compass, Store, ArrowRight, Building2, ChevronLeft } from 'lucide-react';
import { supabase } from '../lib/supabase';

interface AuthModalProps {
  isOpen: boolean;
  onClose: () => void;
  message?: string;
}

// Simplified to 3 clear views. Default is the role selector.
type AuthView = 'role-select' | 'partner-login' | 'partner-signup';

export const AuthModal: React.FC<AuthModalProps> = ({ isOpen, onClose, message = "Welcome to TeamUp" }) => {
  const [view, setView] = useState<AuthView>('role-select');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [companyName, setCompanyName] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');

  if (!isOpen) return null;

  // --- 1. TOURIST LOGIN / SIGNUP (Google 1-Click) ---
  const handleGoogleAuth = async () => {
    setIsLoading(true);
    setErrorMsg('');
    try {
      const { error } = await supabase.auth.signInWithOAuth({
        provider: 'google',
        options: { redirectTo: `${window.location.origin}/home` }
      });
      if (error) throw error;
    } catch (error: any) {
      setErrorMsg(error.message);
      setIsLoading(false);
    }
  };

  // --- 2. PARTNER STANDARD LOGIN ---
  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    setErrorMsg('');

    try {
      const { error } = await supabase.auth.signInWithPassword({ email, password });
      if (error) throw error;
      onClose();
    } catch (error: any) {
      setErrorMsg(error.message || "Invalid email or password.");
    } finally {
      setIsLoading(false);
    }
  };

  // --- 3. PARTNER SIGNUP (Email + Company Name) ---
  const handleVendorSignup = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    setErrorMsg('');

    try {
      const { data, error } = await supabase.auth.signUp({ email, password });
      if (error) throw error;

      if (data?.user) {
        await supabase.from('profiles').upsert({
          id: data.user.id,
          company: companyName,
          user_role: 'vendor', 
          business_type: 'Uncategorized'
        });
        onClose(); 
      }
    } catch (error: any) {
      setErrorMsg(error.message);
    } finally {
      setIsLoading(false);
    }
  };

  const switchView = (newView: AuthView) => {
    setView(newView);
    setErrorMsg('');
    setEmail('');
    setPassword('');
    setCompanyName('');
  };

  return (
    <div className="fixed inset-0 z-[9999] flex items-center justify-center p-4">
      {/* The Blur Backdrop */}
      <div 
        className="absolute inset-0 bg-slate-900/60 backdrop-blur-md animate-in fade-in duration-300"
        onClick={onClose}
      />
      
      {/* The Modal Content */}
      <div className="bg-[#1e222b]/95 backdrop-blur-xl max-w-[400px] w-full rounded-[2rem] p-8 border border-white/10 shadow-[0_20px_60px_rgba(0,0,0,0.5)] relative animate-in zoom-in-95 duration-300 z-10">
        
        <button onClick={onClose} className="absolute top-6 right-6 text-slate-400 hover:text-white transition-colors z-20">
          <X size={20} />
        </button>

        {/* Back Button for Partner Views */}
        {view !== 'role-select' && (
          <button 
            onClick={() => switchView('role-select')} 
            className="absolute top-6 left-6 text-slate-400 hover:text-white transition-colors z-20 flex items-center gap-1 text-sm font-bold"
          >
            <ChevronLeft size={20} /> Back
          </button>
        )}

        {/* Dynamic Header */}
        <div className="text-center mb-8 mt-2">
          <div className="w-12 h-12 bg-[#2a2f3a] text-white rounded-full flex items-center justify-center mx-auto mb-4 border border-white/10 shadow-inner">
            {view === 'role-select' && <Compass size={20} className="text-[#1da1f2]" />}
            {view === 'partner-login' && <Lock size={20} className="text-emerald-400" />}
            {view === 'partner-signup' && <Building2 size={20} className="text-emerald-400" />}
          </div>
          <h2 className="text-2xl font-bold text-white tracking-tight">
            {view === 'role-select' && message}
            {view === 'partner-login' && "Partner Login"}
            {view === 'partner-signup' && "Partner Setup"}
          </h2>
          <p className="text-sm text-slate-400 mt-2">
            {view === 'role-select' && "How are you using TeamUp today?"}
            {view === 'partner-login' && "Access your business dashboard"}
            {view === 'partner-signup' && "Register your operations"}
          </p>
        </div>

        {errorMsg && (
          <div className="mb-6 p-3 rounded-xl bg-rose-500/10 border border-rose-500/50 text-rose-500 text-xs font-bold text-center">
            {errorMsg}
          </div>
        )}

        {/* ============================== */}
        {/* VIEW 1: ROLE SELECTION (FRONT) */}
        {/* ============================== */}
        {view === 'role-select' && (
          <div className="space-y-4 animate-in slide-in-from-right-4">
            
            {/* The Tourist Path -> Triggers Google Immediately */}
            <button 
              onClick={handleGoogleAuth} disabled={isLoading}
              className="w-full group p-4 bg-[#2a2f3a]/50 border border-white/10 rounded-2xl hover:border-[#1da1f2]/50 hover:bg-[#2a2f3a] transition-all text-left flex items-center justify-between"
            >
              <div className="flex items-center gap-4">
                <div className="w-12 h-12 bg-[#1da1f2]/20 text-[#1da1f2] rounded-full flex items-center justify-center group-hover:scale-110 transition-transform">
                  <Compass size={24} />
                </div>
                <div>
                  <h3 className="font-bold text-white text-base">Tourist / Guest</h3>
                  <div className="flex items-center gap-1.5 mt-1 text-slate-400">
                    {isLoading ? <Loader2 size={12} className="animate-spin" /> : (
                      <svg className="w-3.5 h-3.5" viewBox="0 0 24 24">
                        <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
                        <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
                        <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/>
                        <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
                      </svg>
                    )}
                    <span className="text-[11px] font-bold uppercase tracking-wider">Sign in with Google</span>
                  </div>
                </div>
              </div>
              <ArrowRight size={20} className="text-slate-500 group-hover:text-[#1da1f2] group-hover:translate-x-1 transition-all" />
            </button>

            {/* The Partner Path -> Triggers Email Login/Signup */}
            <button 
              onClick={() => switchView('partner-login')}
              className="w-full group p-4 bg-[#2a2f3a]/50 border border-white/10 rounded-2xl hover:border-emerald-500/50 hover:bg-[#2a2f3a] transition-all text-left flex items-center justify-between"
            >
              <div className="flex items-center gap-4">
                <div className="w-12 h-12 bg-emerald-500/20 text-emerald-400 rounded-full flex items-center justify-center group-hover:scale-110 transition-transform">
                  <Store size={24} />
                </div>
                <div>
                  <h3 className="font-bold text-white text-base">Partner / Vendor</h3>
                  <p className="text-xs text-slate-400 mt-1 font-medium">Manage ops & bookings</p>
                </div>
              </div>
              <ArrowRight size={20} className="text-slate-500 group-hover:text-emerald-400 group-hover:translate-x-1 transition-all" />
            </button>

          </div>
        )}

        {/* ============================== */}
        {/* VIEW 2: PARTNER LOGIN          */}
        {/* ============================== */}
        {view === 'partner-login' && (
          <div className="animate-in slide-in-from-right-4">
            <form onSubmit={handleLogin} className="space-y-4">
              <div className="relative">
                <Mail size={16} className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-500" />
                <input 
                  type="email" required
                  value={email} onChange={(e) => setEmail(e.target.value)}
                  placeholder="Work email" 
                  className="w-full bg-[#2a2f3a]/80 text-sm font-medium text-white placeholder:text-slate-400 rounded-xl py-3.5 px-4 border border-transparent focus:border-emerald-500/50 focus:bg-[#2a2f3a] focus:outline-none transition-all"
                />
              </div>

              <div className="relative">
                <button 
                  type="button" onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-400 hover:text-white transition-colors z-10"
                >
                  {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                </button>
                <input 
                  type={showPassword ? "text" : "password"} required
                  value={password} onChange={(e) => setPassword(e.target.value)}
                  placeholder="Password" 
                  className="w-full bg-[#2a2f3a]/80 text-sm font-medium text-white placeholder:text-slate-400 rounded-xl py-3.5 px-4 pr-10 border border-transparent focus:border-emerald-500/50 focus:bg-[#2a2f3a] focus:outline-none transition-all"
                />
              </div>

              <button 
                type="submit" disabled={isLoading}
                className="w-full py-3.5 mt-2 bg-emerald-500 text-white rounded-xl font-bold text-sm shadow-[0_4px_12px_rgba(16,185,129,0.3)] hover:bg-emerald-600 transition-all active:scale-[0.98] disabled:opacity-50 flex items-center justify-center gap-2"
              >
                {isLoading ? <Loader2 className="animate-spin" size={18} /> : "Log In to Workspace"}
              </button>
            </form>

            <div className="mt-6 text-center text-sm text-slate-400">
              New partner? <button onClick={() => switchView('partner-signup')} className="font-bold text-emerald-400 hover:text-emerald-300 transition-colors ml-1">Register your business</button>
            </div>
          </div>
        )}

        {/* ============================== */}
        {/* VIEW 3: PARTNER SIGNUP         */}
        {/* ============================== */}
        {view === 'partner-signup' && (
          <div className="animate-in slide-in-from-right-4">
            <form onSubmit={handleVendorSignup} className="space-y-4">
              <div className="relative">
                <Building2 size={16} className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-500" />
                <input 
                  type="text" required
                  value={companyName} onChange={(e) => setCompanyName(e.target.value)}
                  placeholder="Business / Company Name" 
                  className="w-full bg-[#2a2f3a]/80 text-sm font-medium text-white placeholder:text-slate-400 rounded-xl py-3.5 px-4 pr-10 border border-transparent focus:border-emerald-500/50 focus:bg-[#2a2f3a] focus:outline-none transition-all"
                />
              </div>

              <div className="relative">
                <Mail size={16} className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-500" />
                <input 
                  type="email" required
                  value={email} onChange={(e) => setEmail(e.target.value)}
                  placeholder="Work Email" 
                  className="w-full bg-[#2a2f3a]/80 text-sm font-medium text-white placeholder:text-slate-400 rounded-xl py-3.5 px-4 pr-10 border border-transparent focus:border-emerald-500/50 focus:bg-[#2a2f3a] focus:outline-none transition-all"
                />
              </div>

              <div className="relative">
                <button 
                  type="button" onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-400 hover:text-white transition-colors z-10"
                >
                  {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                </button>
                <input 
                  type={showPassword ? "text" : "password"} required
                  value={password} onChange={(e) => setPassword(e.target.value)}
                  placeholder="Create Password" 
                  className="w-full bg-[#2a2f3a]/80 text-sm font-medium text-white placeholder:text-slate-400 rounded-xl py-3.5 px-4 pr-10 border border-transparent focus:border-emerald-500/50 focus:bg-[#2a2f3a] focus:outline-none transition-all"
                />
              </div>

              <button 
                type="submit" disabled={isLoading}
                className="w-full py-3.5 mt-2 bg-emerald-500 text-white rounded-xl font-bold text-sm shadow-[0_4px_12px_rgba(16,185,129,0.3)] hover:bg-emerald-600 transition-all active:scale-[0.98] disabled:opacity-50 flex items-center justify-center gap-2"
              >
                {isLoading ? <Loader2 className="animate-spin" size={18} /> : "Create Partner Account"}
              </button>
            </form>

            <div className="mt-6 text-center text-sm text-slate-400">
              Already a partner? <button onClick={() => switchView('partner-login')} className="font-bold text-emerald-400 hover:text-emerald-300 transition-colors ml-1">Log in</button>
            </div>
          </div>
        )}

      </div>
    </div>
  );
};