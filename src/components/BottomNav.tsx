import React from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { Compass, LayoutList, Plus, MessageCircle, User, Calendar } from 'lucide-react';

interface BottomNavProps {
  onOpenPostModal: () => void;
  userRole: string; // 'tourist' | 'vendor'
}

export const BottomNav: React.FC<BottomNavProps> = ({ onOpenPostModal, userRole }) => {
  const navigate = useNavigate();
  const location = useLocation();

  const isActive = (path: string) => {
    // Because root '/' now redirects to feeds, highlight the feeds tab if at root
    if (path === '/feeds' && location.pathname === '/') return true;
    return location.pathname.startsWith(path);
  };

  return (
    <div className="bg-white border-t border-slate-200 pb-safe shadow-[0_-4px_20px_rgba(0,0,0,0.05)]">
      <div className="flex items-center justify-around h-16 px-2">
        
        {/* 1. FIRST TAB: Feeds (Universal) */}
        <NavItem 
          icon={<LayoutList size={22} />} 
          label="Feeds" 
          active={isActive('/feeds')} 
          onClick={() => navigate('/feeds')} 
        />

        {/* 2. SECOND TAB: Explore (Universal) */}
        <NavItem 
          icon={<Compass size={22} />} 
          label="Explore" 
          active={isActive('/explore')} 
          onClick={() => navigate('/explore')} 
        />

        {/* 3. CENTER ACTION: 'Post' Button for Partners OR 'Bookings' for Tourists */}
        {userRole !== 'tourist' ? (
          <div className="relative -top-5 flex justify-center w-16 shrink-0">
            <button
              onClick={onOpenPostModal}
              className="w-12 h-12 bg-[#1da1f2] text-white rounded-full flex items-center justify-center shadow-[0_8px_16px_rgba(29,161,242,0.3)] hover:bg-[#1a91da] transition-transform active:scale-95 border-4 border-slate-50"
            >
              <Plus size={24} strokeWidth={3} />
            </button>
          </div>
        ) : (
          <NavItem 
            icon={<Calendar size={22} />} 
            label="Bookings" 
            active={isActive('/bookings')} 
            onClick={() => navigate('/bookings')} 
          />
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
    {React.cloneElement(icon, { 
      className: active ? 'drop-shadow-sm scale-110 transition-transform' : 'transition-transform' 
    })}
    <span className="text-[10px] font-bold tracking-wide">{label}</span>
  </button>
);