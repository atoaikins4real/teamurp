import React, { createContext, useContext, useState, useEffect, useRef } from 'react';
import { supabase } from '../lib/supabase';

// 1. Updated AppUser interface
export interface AppUser {
  id: string;
  email?: string;
  fullName: string;
  company?: string; 
  businessType?: string; 
  country?: string; 
  phone?: string; 
  avatarUrl?: string;
  bannerUrl?: string | null;
  isVerified: boolean;
  role: string; 
  raw: any;
}

interface TenantContextType {
  user: AppUser | null;
  initializing: boolean;
}

const TenantContext = createContext<TenantContextType | undefined>(undefined);

export const useTenant = () => {
  const context = useContext(TenantContext);
  if (context === undefined) {
    throw new Error('useTenant must be used within a TenantProvider');
  }
  return context;
};

export const TenantProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<AppUser | null>(null);
  const [initializing, setInitializing] = useState(true);
  
  // THE FIX: We use a Ref to track the ID so the background listener 
  // doesn't get trapped in a stale closure and wipe your screen.
  const activeUserId = useRef<string | null>(null);

  const fetchProfile = async (sessionUser: any) => {
    // 🛑 STRICT GUARD: No user? Clear everything out.
    if (!sessionUser || !sessionUser.id) {
      setUser(null);
      activeUserId.current = null;
      setInitializing(false);
      return;
    }

    // 🛑 THE SHIELD: If we already loaded this exact user's profile, ABORT!
    // This stops the app from re-rendering the whole tree when you switch browser tabs.
    if (activeUserId.current === sessionUser.id) {
      setInitializing(false);
      return;
    }

    try {
      // 1. CHECK VENDOR TABLE FIRST
      const { data: vendorProfile, error: vendorError } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', sessionUser.id)
        .maybeSingle(); 

      if (vendorError) throw vendorError;

      if (vendorProfile) {
        setUser({
          id: sessionUser.id,
          email: sessionUser.email,
          fullName: `${vendorProfile.first_name || ''} ${vendorProfile.last_name || ''}`.trim(),
          company: vendorProfile.company,
          businessType: vendorProfile.business_type,
          country: vendorProfile.country,
          phone: vendorProfile.phone,
          avatarUrl: vendorProfile.avatar_url,
          bannerUrl: vendorProfile.banner_url,
          isVerified: vendorProfile.is_verified,
          role: vendorProfile.user_role || 'vendor', 
          raw: sessionUser
        });
        activeUserId.current = sessionUser.id; // Lock it in
        return; 
      } 
      
      // 2. CHECK TOURIST TABLE
      const { data: touristProfile, error: touristError } = await supabase
        .from('tourists')
        .select('id, first_name, last_name, avatar_url') 
        .eq('id', sessionUser.id)
        .maybeSingle();

      if (touristError) throw touristError;

      if (touristProfile) {
        setUser({
          id: sessionUser.id,
          email: sessionUser.email,
          fullName: `${touristProfile.first_name || ''} ${touristProfile.last_name || ''}`.trim(),
          avatarUrl: touristProfile.avatar_url,
          isVerified: false,
          role: 'tourist', 
          raw: sessionUser
        });
        activeUserId.current = sessionUser.id; // Lock it in
        return; 
      }

      // 3. FALLBACK FOR BRAND NEW SIGNUPS 
      const metadata = sessionUser.user_metadata || {};
      setUser({
        id: sessionUser.id,
        email: sessionUser.email,
        fullName: metadata.full_name || metadata.name || 'Tourist', 
        avatarUrl: metadata.avatar_url || metadata.picture, 
        isVerified: false,
        role: 'tourist', 
        raw: sessionUser
      });
      activeUserId.current = sessionUser.id; // Lock it in

    } catch (error) {
      console.error("Error fetching profile:", error);
      setUser(null); 
      activeUserId.current = null;
    } finally {
      setInitializing(false);
    }
  };

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      fetchProfile(session?.user);
    });

    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      if (event === 'SIGNED_OUT') {
        setUser(null);
        activeUserId.current = null;
        return;
      }
      
      // ONLY show the loading spinner if we don't already have an active user.
      // This prevents the spinner from appearing when you switch tabs!
      if (!activeUserId.current) {
        setInitializing(true); 
      }
      
      fetchProfile(session?.user);
    });

    return () => subscription.unsubscribe();
  }, []);

  return (
    <TenantContext.Provider value={{ user, initializing }}>
      {children}
    </TenantContext.Provider>
  );
};