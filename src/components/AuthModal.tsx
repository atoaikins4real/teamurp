import React from 'react';
import { X, Compass, Store, ArrowRight } from 'lucide-react';
import { useNavigate } from 'react-router-dom';

interface AuthModalProps {
  isOpen: boolean;
  onClose: () => void;
  message?: string;
}

export const AuthModal: React.FC<AuthModalProps> = ({ isOpen, onClose, message = "Join TeamUrp" }) => {
  const navigate = useNavigate();

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[99999] flex items-center justify-center p-4">
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

        {/* Dynamic Header */}
        <div className="text-center mb-8 mt-2">
          <div className="w-12 h-12 bg-[#2a2f3a] text-white rounded-full flex items-center justify-center mx-auto mb-4 border border-white/10 shadow-inner">
            <Compass size={20} className="text-[#1da1f2]" />
          </div>
          <h2 className="text-2xl font-bold text-white tracking-tight">
            {message}
          </h2>
          <p className="text-sm text-slate-400 mt-2">
            How are you using TeamUrp today?
          </p>
        </div>

        {/* ============================== */}
        {/* ROLE SELECTION GATEWAY         */}
        {/* ============================== */}
        <div className="space-y-4">
          
          {/* The Tourist Path -> Routes to our new funnel */}
          <button 
            onClick={() => {
              onClose();
              navigate('/signup?type=tourist');
            }}
            className="w-full group p-4 bg-[#2a2f3a]/50 border border-white/10 rounded-2xl hover:border-[#1da1f2]/50 hover:bg-[#2a2f3a] transition-all text-left flex items-center justify-between shadow-sm"
          >
            <div className="flex items-center gap-4">
              <div className="w-12 h-12 bg-[#1da1f2]/20 text-[#1da1f2] rounded-full flex items-center justify-center group-hover:scale-110 transition-transform">
                <Compass size={24} />
              </div>
              <div>
                <h3 className="font-bold text-white text-base">Tourist / Guest</h3>
                <p className="text-xs text-slate-400 mt-1 font-medium">Explore & Book</p>
              </div>
            </div>
            <ArrowRight size={20} className="text-slate-500 group-hover:text-[#1da1f2] group-hover:translate-x-1 transition-all" />
          </button>

          {/* The Partner Path -> Routes to our new funnel */}
          <button 
            onClick={() => {
              onClose();
              navigate('/signup?type=vendor');
            }}
            className="w-full group p-4 bg-[#2a2f3a]/50 border border-white/10 rounded-2xl hover:border-emerald-500/50 hover:bg-[#2a2f3a] transition-all text-left flex items-center justify-between shadow-sm"
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

        {/* Standard Login Routing */}
        <div className="mt-6 pt-6 border-t border-white/5 text-center">
          <button 
            onClick={() => {
              onClose();
              navigate('/login');
            }} 
            className="text-sm font-bold text-[#1da1f2] hover:text-blue-400 transition-colors"
          >
            Already have an account? Log In
          </button>
        </div>

      </div>
    </div>
  );
};