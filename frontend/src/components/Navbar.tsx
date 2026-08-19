import React from 'react';
import { User as UserIcon, LogOut, Calendar, MapPin, Shield } from 'lucide-react';
import type { User } from '../types';

interface NavbarProps {
  user: User | null;
  onOpenAuth: () => void;
  onOpenBooking: () => void;
  onLogout: () => void;
  activeView: 'customer' | 'barber' | 'admin';
  setActiveView: (view: 'customer' | 'barber' | 'admin') => void;
}

export const Navbar: React.FC<NavbarProps> = ({
  user,
  onOpenAuth,
  onOpenBooking,
  onLogout,
  activeView,
  setActiveView,
}) => {
  return (
    <header className="sticky top-0 z-50 bg-[#070709]/85 backdrop-blur-xl border-b border-white/10 px-4 md:px-8 py-3 transition-all">
      <div className="max-w-7xl mx-auto flex items-center justify-between">
        
        {/* Brand Logo & Image */}
        <div className="flex items-center gap-3 cursor-pointer group" onClick={() => window.scrollTo({ top: 0, behavior: 'smooth' })}>
          <div className="relative w-10 h-10 rounded-xl overflow-hidden shadow-lg shadow-purple-500/20 group-hover:scale-105 transition-transform border border-purple-500/30">
            <img src="/logo.png" alt="AURA Studio Logo" className="w-full h-full object-cover" />
          </div>
          <div>
            <span className="text-xl font-extrabold font-outfit tracking-wider text-white flex items-center gap-1.5">
              AURA <span className="text-[10px] px-2 py-0.5 rounded-full bg-purple-500/20 text-purple-400 border border-purple-500/30">STUDIO</span>
            </span>
            <span className="text-[10px] text-gray-400 tracking-widest block font-inter uppercase">Luxury Mobile Salon & Grooming</span>
          </div>
        </div>

        {/* Navigation Links */}
        <nav className="hidden md:flex items-center gap-8 text-sm font-medium text-gray-300">
          <a href="#services" className="hover:text-purple-400 transition-colors">Services</a>
          <a href="#radar" className="hover:text-purple-400 transition-colors flex items-center gap-1.5">
            <MapPin className="w-4 h-4 text-purple-400" />
            Find Barbers
          </a>
        </nav>

        {/* Action Buttons & Role Selector */}
        <div className="flex items-center gap-3">
          {user && (
            <div className="bg-obsidian-800/80 p-1 rounded-xl border border-white/10 flex items-center text-xs font-semibold">
              <button
                onClick={() => setActiveView('customer')}
                className={`px-3 py-1.5 rounded-lg transition-all ${
                  activeView === 'customer'
                    ? 'bg-purple-600 text-white shadow-md'
                    : 'text-gray-400 hover:text-white'
                }`}
              >
                Customer View
              </button>

              <button
                onClick={() => setActiveView('barber')}
                className={`px-3 py-1.5 rounded-lg transition-all flex items-center gap-1 ${
                  activeView === 'barber'
                    ? 'bg-amber-500 text-black font-bold shadow-md'
                    : 'text-gray-400 hover:text-white'
                }`}
              >
                <Shield className="w-3.5 h-3.5" />
                Barber Portal
              </button>

              {user.role === 'ADMIN' && (
                <button
                  onClick={() => setActiveView('admin')}
                  className={`px-3 py-1.5 rounded-lg transition-all flex items-center gap-1 ${
                    activeView === 'admin'
                      ? 'bg-red-500 text-white font-bold shadow-md'
                      : 'text-amber-400 hover:text-white'
                  }`}
                >
                  👑 Admin Portal
                </button>
              )}
            </div>
          )}

          <button
            onClick={onOpenBooking}
            className="hidden sm:flex items-center gap-2 gradient-gold hover:opacity-95 text-black font-bold text-sm px-4 py-2 rounded-xl transition-all shadow-lg shadow-amber-500/20 hover:scale-105 active:scale-95"
          >
            <Calendar className="w-4 h-4" />
            Book Appointment
          </button>

          {user ? (
            <div className="flex items-center gap-2">
              <div className="flex items-center gap-2 bg-obsidian-800 px-3 py-1.5 rounded-xl border border-white/10">
                <div className="w-7 h-7 rounded-full bg-purple-600/30 text-purple-300 border border-purple-500/40 flex items-center justify-center font-bold text-xs">
                  {user.name.charAt(0)}
                </div>
                <div className="hidden md:block text-left">
                  <span className="text-xs font-semibold text-gray-200 block">{user.name}</span>
                  <span className="text-[9px] text-purple-400 font-bold uppercase block">{user.role}</span>
                </div>
              </div>
              <button
                onClick={onLogout}
                title="Logout"
                className="p-2 rounded-xl bg-obsidian-800 hover:bg-red-500/20 text-gray-400 hover:text-red-400 border border-white/10 transition-colors"
              >
                <LogOut className="w-4 h-4" />
              </button>
            </div>
          ) : (
            <button
              onClick={onOpenAuth}
              className="flex items-center gap-2 bg-purple-600 hover:bg-purple-500 text-white font-bold text-xs px-4 py-2.5 rounded-xl transition-all shadow-lg shadow-purple-600/20 hover:scale-105 active:scale-95"
            >
              <UserIcon className="w-4 h-4 text-purple-200" />
              Sign In / Register
            </button>
          )}
        </div>
      </div>
    </header>
  );
};
