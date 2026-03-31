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
  
  // Ref to track ID so background listener doesn't get trapped in a stale closure
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
    if (activeUserId.current === sessionUser.id) {
      setInitializing(false);
      return;
    }

    try {
      // 1. Read the explicit role we saved during Sign Up / OAuth
      const metadata = sessionUser.user_metadata || {};
      const userRole = metadata.role || 'tourist'; // Default to tourist for safety
      
      if (userRole === 'vendor' || userRole === 'partner') {
        // --- 🟢 VENDOR ROUTE: Only search the profiles table ---
        const { data: vendorProfile, error: vendorError } = await supabase
          .from('profiles')
          .select('*')
          .eq('id', sessionUser.id)
          .maybeSingle(); 

        if (vendorProfile && !vendorError) {
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
            isVerified: vendorProfile.is_verified || false,
            role: 'vendor', 
            raw: sessionUser
          });
          activeUserId.current = sessionUser.id;
          return; 
        }
      } else {
        // --- 🔵 TOURIST ROUTE: Only search the tourists table ---
        const { data: touristProfile, error: touristError } = await supabase
          .from('tourists')
          .select('id, first_name, last_name, avatar_url') 
          .eq('id', sessionUser.id)
          .maybeSingle();

        if (touristProfile && !touristError) {
          setUser({
            id: sessionUser.id,
            email: sessionUser.email,
            fullName: `${touristProfile.first_name || ''} ${touristProfile.last_name || ''}`.trim(),
            avatarUrl: touristProfile.avatar_url,
            isVerified: false,
            role: 'tourist', 
            raw: sessionUser
          });
          activeUserId.current = sessionUser.id;
          return; 
        }
      }

      // --- 🟡 FALLBACK: If row is missing (e.g., Database trigger delayed) ---
      setUser({
        id: sessionUser.id,
        email: sessionUser.email,
        fullName: metadata.first_name ? `${metadata.first_name} ${metadata.last_name || ''}`.trim() : (metadata.full_name || metadata.name || 'Explorer'), 
        avatarUrl: metadata.avatar_url || metadata.picture, 
        isVerified: false,
        role: userRole, 
        raw: sessionUser
      });
      activeUserId.current = sessionUser.id;

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