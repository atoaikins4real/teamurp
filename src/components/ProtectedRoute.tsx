import React from 'react';
import { Navigate, Outlet, useLocation } from 'react-router-dom';
import { useTenant } from '../contexts/TenantContext'; // Or wherever this lives
import { Loader2 } from 'lucide-react';

interface ProtectedRouteProps {
  allowedRoles?: string[];
}

export const ProtectedRoute: React.FC<ProtectedRouteProps> = ({ allowedRoles }) => {
  // 1. Grab the user and initializing state directly from the context
  const { user, initializing } = useTenant();
  const location = useLocation();

  // 2. The Loading Gate: Wait for TenantContext to finish its initial check
  if (initializing) {
    return (
      <div className="w-full min-h-screen flex items-center justify-center bg-[#1e222b]">
        <Loader2 className="animate-spin text-emerald-500" size={48} />
      </div>
    );
  }

  // 3. Not logged in? Kick to login, but remember where they tried to go
  if (!user) {
    return <Navigate to="/login" state={{ from: location }} replace />;
  }

  // 4. Logged in, but wrong role? Kick to explore page
  // Since TenantContext already sets user.role (e.g., 'tourist', 'vendor'), we just check it!
  if (allowedRoles && !allowedRoles.includes(user.role)) {
    return <Navigate to="/explore" replace />;
  }

  // 5. Passed all checks! Open the route.
  return <Outlet />;
};