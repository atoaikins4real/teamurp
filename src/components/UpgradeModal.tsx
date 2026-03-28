import React, { useState, useEffect } from 'react';
import { X, CheckCircle, Zap, Star, ShieldCheck, Loader2, TrendingUp } from 'lucide-react';
import { supabase } from '../lib/supabase';
import { useTenant } from '../contexts/TenantContext';

interface UpgradeModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const UpgradeModal: React.FC<UpgradeModalProps> = ({ isOpen, onClose }) => {
  const { user } = useTenant();
  const [loadingPlan, setLoadingPlan] = useState<string | null>(null);

  // Dynamically load the Paystack Inline Script when the modal opens
  useEffect(() => {
    if (isOpen) {
      const script = document.createElement('script');
      script.src = 'https://js.paystack.co/v1/inline.js';
      script.async = true;
      document.body.appendChild(script);
      
      return () => {
        document.body.removeChild(script);
      };
    }
  }, [isOpen]);

  if (!isOpen) return null;

  const handleCheckout = async (planId: string, priceGHS: number) => {
    if (!user) return;
    setLoadingPlan(planId);

    try {
      // 1. Ensure the Paystack script loaded successfully
      if (!(window as any).PaystackPop) {
        alert("Secure payment gateway is still loading. Please wait a second and try again.");
        setLoadingPlan(null);
        return;
      }

      // 2. Fetch the user email for the receipt
      const { data: authData } = await supabase.auth.getUser();
      const userEmail = 
        authData.user?.email || 
        authData.user?.user_metadata?.email || 
        'anaalfe63@gmail.com'; // Ultimate fallback

      // 3. Grab the Public Key from your .env file
      const publicKey = import.meta.env.VITE_PAYSTACK_PUBLIC_KEY;
      if (!publicKey) {
        throw new Error("Paystack Public Key is missing from your .env file!");
      }

      // 4. Launch the in-app Paystack Popup!
      const handler = (window as any).PaystackPop.setup({
        key: publicKey, 
        email: userEmail,
        amount: priceGHS * 100, // Paystack requires the amount in Pesewas
        currency: 'GHS',
        metadata: {
          user_id: user.id,
          plan_type: planId,
        },
        callback: function(response: any) {
          // This runs when the payment is SUCCESSFUL
          console.log("Payment complete! Reference:", response.reference);
          alert("Payment Successful! Your account is being upgraded in the background.");
          setLoadingPlan(null);
          onClose(); // Close the modal smoothly so they can keep working
        },
        onClose: function() {
          // This runs if the user clicks "Cancel" or clicks outside the popup
          setLoadingPlan(null);
        }
      });

      // Open the Iframe
      handler.openIframe();

    } catch (err: any) {
      console.error("Checkout Error:", err);
      alert(err.message || "Failed to initialize checkout. Please try again.");
      setLoadingPlan(null);
    }
  };

  return (
    <div className="fixed inset-0 z-[3000] flex items-center justify-center p-4 sm:p-6">
      {/* Backdrop */}
      <div 
        className="absolute inset-0 bg-slate-900/60 backdrop-blur-sm animate-in fade-in duration-300" 
        onClick={onClose}
      />
      
      {/* Modal Content */}
      <div className="bg-slate-50 w-full max-w-4xl rounded-[2.5rem] overflow-hidden shadow-2xl relative z-10 animate-in zoom-in-95 slide-in-from-bottom-8 duration-300 flex flex-col max-h-[90vh]">
        
        {/* Header */}
        <div className="p-6 sm:p-8 flex justify-between items-start bg-white border-b border-slate-100 shrink-0">
          <div>
            <h2 className="text-2xl sm:text-3xl font-black text-slate-900 leading-tight">Grow your business<br/>with TeamUp</h2>
            <p className="text-sm font-medium text-slate-500 mt-2">Get more bookings, unlock premium leads, and stand out on the map.</p>
          </div>
          <button 
            onClick={onClose} 
            className="w-10 h-10 bg-slate-100 rounded-full flex items-center justify-center text-slate-400 hover:text-slate-600 hover:bg-slate-200 transition-colors"
          >
            <X size={20} />
          </button>
        </div>

        {/* Pricing Cards Grid */}
        <div className="p-6 sm:p-8 overflow-y-auto custom-scrollbar flex-1">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            
            {/* PLAN 1: PROMOTED PIN */}
            <div className="bg-white border border-slate-200 rounded-3xl p-6 shadow-sm flex flex-col relative overflow-hidden group hover:border-amber-300 transition-colors">
              <div className="absolute top-0 right-0 w-24 h-24 bg-amber-50 rounded-bl-full -mr-4 -mt-4 z-0 transition-transform group-hover:scale-110" />
              
              <div className="relative z-10">
                <div className="w-12 h-12 rounded-2xl bg-amber-100 text-amber-600 flex items-center justify-center mb-4">
                  <Star size={24} fill="currentColor" />
                </div>
                <h3 className="text-lg font-black text-slate-900">Promoted Pin</h3>
                <p className="text-[11px] font-bold text-amber-500 uppercase tracking-widest mt-1">One-Time Boost</p>
                
                <div className="my-6">
                  <span className="text-3xl font-black text-slate-900">GH₵ 50</span>
                  <span className="text-sm font-bold text-slate-400"> / week</span>
                </div>

                <ul className="space-y-3 mb-8">
                  {[
                    'Stand out with a Gold Map Pin',
                    'Rank #1 in "Popular Nearby" suggestions',
                    'Get up to 5x more profile views',
                    'Perfect for weekend events or promos'
                  ].map((feature, i) => (
                    <li key={i} className="flex items-start gap-3 text-sm font-semibold text-slate-600">
                      <CheckCircle size={18} className="text-amber-500 shrink-0 mt-0.5" />
                      {feature}
                    </li>
                  ))}
                </ul>
              </div>

              <button 
                onClick={() => handleCheckout('promoted_pin', 50)}
                disabled={loadingPlan !== null}
                className="mt-auto w-full py-3.5 bg-amber-100 hover:bg-amber-200 text-amber-700 rounded-xl font-black text-sm transition-all flex items-center justify-center gap-2"
              >
                {loadingPlan === 'promoted_pin' ? <Loader2 className="animate-spin" size={18}/> : <>Boost My Profile <Zap size={16} fill="currentColor"/></>}
              </button>
            </div>

            {/* PLAN 2: PRO SUBSCRIPTION */}
            <div className="bg-slate-900 border border-slate-800 rounded-3xl p-6 shadow-xl flex flex-col relative overflow-hidden transform md:-translate-y-2">
              <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-blue-500 via-teal-400 to-emerald-500" />
              <div className="absolute -bottom-20 -right-20 w-64 h-64 bg-[#1da1f2]/10 rounded-full blur-3xl" />
              
              <div className="relative z-10">
                <div className="flex justify-between items-start mb-4">
                  <div className="w-12 h-12 rounded-2xl bg-[#1da1f2]/20 text-[#1da1f2] flex items-center justify-center border border-[#1da1f2]/30">
                    <ShieldCheck size={24} />
                  </div>
                  <span className="px-3 py-1 bg-blue-500/20 border border-blue-500/30 text-blue-400 text-[10px] font-black uppercase tracking-widest rounded-full">Most Popular</span>
                </div>
                
                <h3 className="text-lg font-black text-white">TeamUp Pro</h3>
                <p className="text-[11px] font-bold text-slate-400 uppercase tracking-widest mt-1">Monthly Subscription</p>
                
                <div className="my-6">
                  <span className="text-3xl font-black text-white">GH₵ 150</span>
                  <span className="text-sm font-bold text-slate-500"> / month</span>
                </div>

                <ul className="space-y-3 mb-8">
                  {[
                    'Unlock and reply to B2B RFP Leads',
                    'Verified Partner Badge on your profile',
                    'Direct messaging with un-connected teams',
                    'Advanced profile analytics & insights'
                  ].map((feature, i) => (
                    <li key={i} className="flex items-start gap-3 text-sm font-semibold text-slate-300">
                      <CheckCircle size={18} className="text-[#1da1f2] shrink-0 mt-0.5" />
                      {feature}
                    </li>
                  ))}
                </ul>
              </div>

              <button 
                onClick={() => handleCheckout('pro_subscription', 150)}
                disabled={loadingPlan !== null}
                className="mt-auto w-full py-3.5 bg-[#1da1f2] hover:bg-[#1a91da] text-white rounded-xl font-black text-sm transition-all shadow-[0_0_20px_rgba(29,161,242,0.4)] flex items-center justify-center gap-2"
              >
                {loadingPlan === 'pro_subscription' ? <Loader2 className="animate-spin" size={18}/> : <>Upgrade to Pro <TrendingUp size={16}/></>}
              </button>
            </div>

          </div>
        </div>
      </div>
    </div>
  );
};