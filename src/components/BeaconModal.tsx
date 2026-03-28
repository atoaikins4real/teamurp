import React from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { Map, LayoutList, Plus, MessageCircle, User, Calendar } from 'lucide-react';

interface BottomNavProps {
  onOpenPostModal: () => void;
  userRole: string; // The new prop to control the UI
}

export const BottomNav: React.FC<BottomNavProps> = ({ onOpenPostModal, userRole }) => {
  const navigate = useNavigate();
  const location = useLocation();

  const isActive = (path: string) => location.pathname.startsWith(path);

  return (
    <div className="bg-white border-t border-slate-200 pb-safe">
      <div className="flex items-center justify-around h-16 px-2">
        
        {/* 1. FIRST TAB: Homepage (Tourists) OR Feeds (Partners) */}
        {userRole === 'tourist' ? (
          <NavItem 
            icon={<Map size={22} />} 
            label="Homepage" 
            active={isActive('/home') || location.pathname === '/'} 
            onClick={() => navigate('/home')} 
          />
        ) : (
          <NavItem 
            icon={<LayoutList size={22} />} 
            label="Feeds" 
            active={isActive('/feeds') || location.pathname === '/'} 
            onClick={() => navigate('/feeds')} 
          />
        )}

        {/* 2. SECOND TAB: Bookings (Tourists) OR Homepage (Partners) */}
        {userRole === 'tourist' ? (
          <NavItem 
            icon={<Calendar size={22} />} 
            label="Bookings" 
            active={isActive('/bookings')} 
            onClick={() => navigate('/bookings')} 
          />
        ) : (
          <NavItem 
            icon={<Map size={22} />} 
            label="Homepage" 
            active={isActive('/home')} 
            onClick={() => navigate('/home')} 
          />
        )}

        {/* 3. CENTER ACTION: Hidden for Tourists, 'Post' Button for Partners */}
        {userRole !== 'tourist' && (
          <div className="relative -top-5 flex justify-center w-16">
            <button
              onClick={onOpenPostModal}
              className="w-12 h-12 bg-[#1da1f2] text-white rounded-full flex items-center justify-center shadow-[0_8px_16px_rgba(29,161,242,0.3)] hover:bg-[#1a91da] transition-transform active:scale-95 border-4 border-slate-50"
            >
              <Plus size={24} strokeWidth={3} />
            </button>
          </div>
        )}

        {/* 4. FOURTH TAB: Messages (Universal) */}
        <NavItem 
          icon={<MessageCircle size={22} />} 
          label="Messages" 
          active={isActive('/messages')} 
          onClick={() => navigate('/messages')} 
        />

        {/* 5. FIFTH TAB: Profile (Universal) */}
        <NavItem 
          icon={<User size={22} />} 
          label="Profile" 
          active={isActive('/profile')} 
          onClick={() => navigate('/profile')} 
        />
        
      </div>
    </div>
  );
};

// Internal Helper Component for clean tab rendering
const NavItem = ({ icon, label, active, onClick }: any) => (
  <button
    onClick={onClick}
    className={`flex flex-col items-center justify-center w-16 h-full gap-1 transition-colors ${
      active ? 'text-[#1da1f2]' : 'text-slate-400 hover:text-slate-600'
    }`}
  >
    {icon}
    <span className="text-[10px] font-bold tracking-wide">{label}</span>
  </button>
);