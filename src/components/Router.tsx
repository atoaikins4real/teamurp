import React from 'react';
import { Routes, Route, Navigate, Outlet, useLocation } from 'react-router-dom';
import { useTenant } from '../contexts/TenantContext'; // <-- Now using your actual auth state!
import { Loader2 } from 'lucide-react';
import MainLayout from '../layouts/MainLayout';

// Auth Pages
import LoginPage from '../pages/auth/LoginPage';
import SignUpPage from '../pages/auth/SignUpPage';

// Core Pages
import Feeds from '../pages/Feeds';
import Explore from '../pages/Explore';
import Recap from '../pages/Recap';
import Messages from '../pages/Messages';
import Profile from '../pages/Profile';
import Onboarding from '../pages/Onboarding';

// New B2B Pages
import Bookings from '../pages/Bookings';
import Saved from '../pages/Saved';
import Groups from '../pages/Groups';
import Network from '../pages/Network';
import AssetDetail from '../pages/AssetDetail';
import Settings from '../pages/Settings';

interface ProtectedRouteProps {
  allowedRoles?: string[];
}

export const ProtectedRoute: React.FC<ProtectedRouteProps> = ({ allowedRoles }) => {
  // THE FIX: We pull the real user state from Supabase via your Context
  const { user, initializing } = useTenant();
  const location = useLocation();

  if (initializing) {
    return (
      <div className="w-full min-h-screen flex items-center justify-center bg-[#1e222b]">
        <Loader2 className="animate-spin text-[#1da1f2]" size={48} />
      </div>
    );
  }

  // Not authenticated? Send to login.
  if (!user) {
    return <Navigate to="/login" state={{ from: location }} replace />;
  }

  // Wrong role? Send to explore.
  if (allowedRoles && !allowedRoles.includes(user.role)) {
    return <Navigate to="/explore" replace />;
  }

  return <Outlet />;
};

function AppRouter() {
  return (
    <Routes>
      {/* ==========================================
          FULL-SCREEN ROUTES
          ========================================== */}
      <Route path="/login" element={<LoginPage />} />
      <Route path="/signup" element={<SignUpPage />} />
      <Route path="/onboarding" element={<Onboarding />} />
      <Route path="/settings" element={<Settings />} />
      <Route path="/asset/:id" element={<AssetDetail />} />

      {/* ==========================================
          APP ROUTES (Wrapped in MainLayout)
          ========================================== */}
      <Route element={<MainLayout />}>
        
        {/* 🟢 PUBLIC ZONE */}
        <Route path="/explore" element={<Explore />} />
        
        {/* 🔴 ALL LOGGED-IN USERS */}
        <Route element={<ProtectedRoute />}>
          <Route path="/messages" element={<Messages />} />
          <Route path="/profile" element={<Profile />} />
          <Route path="/profile/:id" element={<Profile />} />
          <Route path="/bookings" element={<Bookings />} />
          <Route path="/saved" element={<Saved />} />
          {/* Added /home to prevent the BottomNav from crashing into the fallback route */}
          <Route path="/home" element={<Explore />} /> 
        </Route>

        {/* 🟣 PARTNERS / VENDORS ONLY */}
        <Route element={<ProtectedRoute allowedRoles={['partner', 'vendor']} />}>
          <Route path="/" element={<Navigate to="/feeds" replace />} />
          <Route path="/feeds" element={<Feeds />} />
          <Route path="/recap" element={<Recap />} />
          <Route path="/groups" element={<Groups />} />
          <Route path="/network" element={<Network />} />
        </Route>

      </Route>

      {/* Fallback */}
      <Route path="*" element={<Navigate to="/explore" replace />} />
    </Routes>
  );
}

export default AppRouter;