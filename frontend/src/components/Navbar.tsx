import React from 'react';
import { User as UserIcon, LogOut, Calendar, MapPin, Shield, Clock, Sparkles } from 'lucide-react';
import type { User } from '../types';

interface NavbarProps {
  user: User | null;
  onOpenAuth: () => void;
  onOpenBooking: () => void;
  onOpenMyBookings?: () => void;
  onLogout: () => void;
  activeView: 'customer' | 'barber' | 'admin';
  setActiveView: (view: 'customer' | 'barber' | 'admin') => void;
}

export const Navbar: React.FC<NavbarProps> = ({
  user,
  onOpenAuth,
  onOpenBooking,
  onOpenMyBookings,
  onLogout,
  activeView,
  setActiveView,
}) => {
  return (
    <header className="sticky top-0 z-50 bg-[#0b0c10]/90 backdrop-blur-2xl border-b border-white/[0.08] px-4 md:px-8 py-3.5 transition-all">
      <div className="max-w-7xl mx-auto flex items-center justify-between gap-4">
        
        {/* Brand Logo & Location Pill */}
        <div className="flex items-center gap-4">
          <div
            className="flex items-center gap-3 cursor-pointer group"
            onClick={() => window.scrollTo({ top: 0, behavior: 'smooth' })}
          >
            <div className="relative w-9 h-9 rounded-xl overflow-hidden shadow-lg shadow-[#ff6c4c]/20 group-hover:scale-105 transition-transform bg-gradient-to-br from-[#ff8a6a] via-[#ff6c4c] to-[#e54d2e] p-0.5">
              <div className="w-full h-full bg-[#0e1017] rounded-[10px] flex items-center justify-center">
                <span className="text-base font-extrabold text-[#ff6c4c] font-outfit">A</span>
              </div>
            </div>
            <div>
              <div className="flex items-center gap-1.5">
                <span className="text-lg font-extrabold font-outfit tracking-tight text-white">
                  AURA
                </span>
                <span className="text-[9px] font-extrabold px-2 py-0.5 rounded-full bg-[#ff6c4c]/15 text-[#ff6c4c] border border-[#ff6c4c]/30 tracking-wider uppercase">
                  FLOW
                </span>
              </div>
              <span className="text-[10px] text-gray-400 font-medium tracking-tight block">
                Doorstep Salon & Grooming
              </span>
            </div>
          </div>

          {/* Location Chip */}
          <div className="hidden lg:flex items-center gap-2 px-3 py-1.5 rounded-full bg-white/[0.04] border border-white/[0.08] text-xs text-gray-300">
            <span className="w-2 h-2 rounded-full bg-[#ff6c4c] animate-pulse"></span>
            <MapPin className="w-3.5 h-3.5 text-[#ff6c4c]" />
            <span className="font-semibold text-white">Brahmapur, Odisha</span>
            <span className="text-[10px] text-[#ff6c4c] font-bold bg-[#ff6c4c]/10 px-1.5 py-0.5 rounded-md">Live GPS</span>
          </div>
        </div>

        {/* Navigation Links */}
        <nav className="hidden md:flex items-center gap-7 text-xs font-semibold tracking-wide text-gray-300">
          <a href="#services" className="hover:text-[#ff6c4c] transition-colors">
            Services & Packages
          </a>
          <a href="#radar" className="hover:text-[#ff6c4c] transition-colors flex items-center gap-1.5">
            <Sparkles className="w-3.5 h-3.5 text-[#ff6c4c]" />
            Live Barbers Radar
          </a>
        </nav>

        {/* Action Buttons & Role Selector */}
        <div className="flex items-center gap-2.5">
          {user && (user.role === 'ADMIN' || user.role === 'BARBER') && (
            <div className="bg-[#13151f] p-1 rounded-2xl border border-white/[0.08] flex items-center text-xs font-bold shadow-inner">
              <button
                onClick={() => setActiveView('customer')}
                className={`px-3 py-1.5 rounded-xl transition-all ${
                  activeView === 'customer'
                    ? 'bg-white/10 text-white shadow-sm'
                    : 'text-gray-400 hover:text-white'
                }`}
              >
                Client View
              </button>

              {user.role === 'BARBER' && (
                <button
                  onClick={() => setActiveView('barber')}
                  className={`px-3 py-1.5 rounded-xl transition-all flex items-center gap-1.5 ${
                    activeView === 'barber'
                      ? 'gradient-flow text-white font-extrabold shadow-md'
                      : 'text-gray-400 hover:text-white'
                  }`}
                >
                  <Shield className="w-3.5 h-3.5" />
                  Barber Portal
                </button>
              )}

              {user.role === 'ADMIN' && (
                <>
                  <button
                    onClick={() => setActiveView('barber')}
                    className={`px-3 py-1.5 rounded-xl transition-all flex items-center gap-1.5 ${
                      activeView === 'barber'
                        ? 'gradient-flow text-white font-extrabold shadow-md'
                        : 'text-gray-400 hover:text-white'
                    }`}
                  >
                    <Shield className="w-3.5 h-3.5" />
                    Barber View
                  </button>
                  <button
                    onClick={() => setActiveView('admin')}
                    className={`px-3 py-1.5 rounded-xl transition-all flex items-center gap-1.5 ${
                      activeView === 'admin'
                        ? 'bg-[#ff6c4c]/20 text-[#ff6c4c] border border-[#ff6c4c]/40'
                        : 'text-[#ff6c4c] hover:text-white'
                    }`}
                  >
                    👑 Admin
                  </button>
                </>
              )}
            </div>
          )}

          {user && onOpenMyBookings && (
            <button
              onClick={onOpenMyBookings}
              className="hidden sm:flex items-center gap-1.5 bg-[#13151f] hover:bg-[#1b1f2e] text-gray-200 hover:text-white font-bold text-xs px-3.5 py-2.5 rounded-xl transition-all border border-white/[0.08]"
            >
              <Clock className="w-3.5 h-3.5 text-[#ff6c4c]" />
              <span>My Bookings</span>
            </button>
          )}

          <button
            onClick={onOpenBooking}
            className="flex items-center gap-2 gradient-flow hover:opacity-95 text-white font-extrabold text-xs sm:text-sm px-4 sm:px-5 py-2.5 rounded-xl transition-all shadow-lg shadow-[#ff6c4c]/25 active:scale-95"
          >
            <Calendar className="w-4 h-4" />
            <span>Book Service</span>
          </button>

          {user ? (
            <div className="flex items-center gap-2">
              <div className="flex items-center gap-2.5 bg-[#13151f] px-3 py-1.5 rounded-xl border border-white/[0.08]">
                <div className="w-7 h-7 rounded-lg gradient-flow text-white flex items-center justify-center font-extrabold text-xs shadow-md">
                  {user.name.charAt(0)}
                </div>
                <div className="hidden md:block text-left">
                  <span className="text-xs font-bold text-gray-200 block truncate max-w-[100px]">{user.name}</span>
                  <span className="text-[9px] text-[#ff6c4c] font-extrabold uppercase block">{user.role}</span>
                </div>
              </div>
              <button
                onClick={onLogout}
                title="Sign Out"
                className="p-2.5 rounded-xl bg-[#13151f] hover:bg-red-500/20 text-gray-400 hover:text-red-300 border border-white/[0.08] transition-colors"
              >
                <LogOut className="w-4 h-4" />
              </button>
            </div>
          ) : (
            <button
              onClick={onOpenAuth}
              className="flex items-center gap-2 bg-[#181d2c] hover:bg-[#20273b] text-white font-bold text-xs px-4 py-2.5 rounded-xl transition-all border border-white/10 active:scale-95"
            >
              <UserIcon className="w-4 h-4 text-[#ff6c4c]" />
              Sign In
            </button>
          )}
        </div>
      </div>
    </header>
  );
};
