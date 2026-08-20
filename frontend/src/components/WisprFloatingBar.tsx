import React, { useState, useEffect } from 'react';
import { MapPin, Zap, Scissors, Crown, ShieldCheck, ChevronUp, ChevronDown } from 'lucide-react';
import type { ServiceItem } from '../types';

interface WisprFloatingBarProps {
  onOpenBooking: () => void;
  onSelectService: (service: ServiceItem) => void;
  services: ServiceItem[];
}

export const WisprFloatingBar: React.FC<WisprFloatingBarProps> = ({
  onOpenBooking,
  onSelectService,
  services,
}) => {
  const [isExpanded, setIsExpanded] = useState(false);
  const [pulseIndex, setPulseIndex] = useState(0);

  useEffect(() => {
    const interval = setInterval(() => {
      setPulseIndex((prev) => (prev + 1) % 4);
    }, 1200);
    return () => clearInterval(interval);
  }, []);

  const quickServices = services.slice(0, 3);

  return (
    <aside aria-label="Quick Booking Capsule" className="fixed bottom-6 left-1/2 -translate-x-1/2 z-40 w-[94%] max-w-4xl transition-all duration-500 ease-out">
      <div className="glass-card rounded-[28px] p-2.5 sm:p-3 border-white/[0.12] bg-[#0e1018]/90 backdrop-blur-2xl shadow-[0_20px_50px_rgba(0,0,0,0.8),0_0_30px_rgba(255,108,76,0.15)] flex flex-col gap-2 relative overflow-hidden">
        
        {/* Top Floating Mini Header */}
        <div className="flex items-center justify-between gap-3 px-2 sm:px-3">
          
          {/* Live Waveform & Location Pill */}
          <div className="flex items-center gap-2.5">
            {/* Wispr Flow Soundwave Pulse Visualizer */}
            <div className="flex items-center gap-0.5 h-4 px-1.5 py-0.5 rounded-full bg-[#ff6c4c]/15 border border-[#ff6c4c]/30">
              <span className={`w-0.5 rounded-full bg-[#ff6c4c] transition-all duration-300 ${pulseIndex === 0 ? 'h-3.5' : 'h-1.5'}`}></span>
              <span className={`w-0.5 rounded-full bg-[#ff6c4c] transition-all duration-300 ${pulseIndex === 1 ? 'h-3.5' : 'h-2'}`}></span>
              <span className={`w-0.5 rounded-full bg-[#ff6c4c] transition-all duration-300 ${pulseIndex === 2 ? 'h-4' : 'h-1.5'}`}></span>
              <span className={`w-0.5 rounded-full bg-[#ff6c4c] transition-all duration-300 ${pulseIndex === 3 ? 'h-3' : 'h-2'}`}></span>
            </div>

            <div className="flex items-center gap-1.5 text-xs text-gray-200">
              <span className="font-extrabold text-white">Aura Flow</span>
              <span className="text-gray-500 hidden sm:inline">•</span>
              <span className="text-[11px] text-gray-400 hidden sm:flex items-center gap-1">
                <MapPin className="w-3 h-3 text-[#ff6c4c]" /> Brahmapur (25 min dispatch)
              </span>
            </div>
          </div>

          {/* Quick Service Chips (Desktop) */}
          <div className="hidden md:flex items-center gap-1.5">
            {quickServices.map((service) => (
              <button
                key={service._id}
                onClick={() => onSelectService(service)}
                className="px-3 py-1.5 rounded-xl bg-white/[0.04] hover:bg-white/[0.08] border border-white/[0.08] text-[11px] font-bold text-gray-200 hover:text-white transition-all flex items-center gap-1.5 active:scale-95"
              >
                <span>{service.name.split(' ')[0]}</span>
                <span className="text-[#ff8a6a] font-extrabold">₹{service.price}</span>
              </button>
            ))}
          </div>

          {/* Instant Dispatch Primary CTA */}
          <div className="flex items-center gap-2">
            <button
              onClick={onOpenBooking}
              className="gradient-flow hover:opacity-95 text-white font-extrabold text-xs sm:text-sm px-4 sm:px-5 py-2 sm:py-2.5 rounded-2xl shadow-lg shadow-[#ff6c4c]/30 transition-all flex items-center gap-2 active:scale-95"
            >
              <Zap className="w-4 h-4 fill-current" />
              <span>Book Doorstep Now</span>
            </button>

            <button
              onClick={() => setIsExpanded(!isExpanded)}
              title={isExpanded ? "Collapse quick menu" : "Expand quick menu"}
              className="p-2 rounded-2xl bg-white/[0.04] hover:bg-white/[0.08] text-gray-400 hover:text-white border border-white/[0.08] transition-colors"
            >
              {isExpanded ? <ChevronDown className="w-4 h-4" /> : <ChevronUp className="w-4 h-4" />}
            </button>
          </div>

        </div>

        {/* Collapsible Fast Menu & Hygiene Badge */}
        {isExpanded && (
          <div className="pt-3 mt-2 border-t border-white/[0.08] px-3 pb-2 grid grid-cols-1 sm:grid-cols-3 gap-3 animate-fade-in">
            <div className="p-3 rounded-2xl bg-white/[0.03] border border-white/[0.06] flex items-center gap-3">
              <div className="w-9 h-9 rounded-xl bg-[#ff6c4c]/15 text-[#ff6c4c] flex items-center justify-center font-bold">
                <Scissors className="w-4 h-4" />
              </div>
              <div>
                <span className="text-xs font-bold text-white block">Executive Cuts</span>
                <span className="text-[10px] text-gray-400">Tailored to face structure</span>
              </div>
            </div>

            <div className="p-3 rounded-2xl bg-white/[0.03] border border-white/[0.06] flex items-center gap-3">
              <div className="w-9 h-9 rounded-xl bg-emerald-500/15 text-emerald-400 flex items-center justify-center font-bold">
                <ShieldCheck className="w-4 h-4" />
              </div>
              <div>
                <span className="text-xs font-bold text-white block">100% Sterile Kits</span>
                <span className="text-[10px] text-gray-400">Single-use capes & blades</span>
              </div>
            </div>

            <div className="p-3 rounded-2xl bg-white/[0.03] border border-white/[0.06] flex items-center gap-3">
              <div className="w-9 h-9 rounded-xl bg-amber-500/15 text-amber-400 flex items-center justify-center font-bold">
                <Crown className="w-4 h-4" />
              </div>
              <div>
                <span className="text-xs font-bold text-white block">Royal Combos</span>
                <span className="text-[10px] text-gray-400">Hair + Beard + Facial Spa</span>
              </div>
            </div>
          </div>
        )}

      </div>
    </aside>
  );
};
