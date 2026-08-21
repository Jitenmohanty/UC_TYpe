import React from 'react';
import { Canvas3D } from './Canvas3D';
import { Sparkles, Zap, Scissors, ArrowRight, Star, CheckCircle2, Clock, ShieldCheck } from 'lucide-react';

interface HeroProps {
  onOpenBooking: () => void;
  onOpenServices?: () => void;
}

export const Hero: React.FC<HeroProps> = ({ onOpenBooking, onOpenServices }) => {
  return (
    <section className="relative min-h-[88vh] flex items-center justify-center pt-8 pb-16 overflow-hidden">
      {/* Wispr Flow Ambient Backlights */}
      <div className="absolute top-1/4 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[700px] h-[500px] ambient-glow-flow pointer-events-none"></div>
      <div className="absolute top-1/3 right-10 w-[500px] h-[500px] ambient-glow-purple pointer-events-none"></div>

      <div className="max-w-7xl mx-auto px-4 md:px-8 w-full grid grid-cols-1 lg:grid-cols-12 gap-12 items-center relative z-10">
        
        <div className="lg:col-span-7 space-y-6 text-center lg:text-left">
          
          {/* Wispr Flow Editorial Badge */}
          <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-[#ff6c4c]/10 border border-[#ff6c4c]/30 text-[#ff8a6a] text-xs font-bold tracking-wide">
            <Sparkles className="w-3.5 h-3.5 text-[#ff6c4c]" />
            <span>#1 Luxury Doorstep Grooming in Brahmapur & Bhubaneswar</span>
          </div>

          <h1 className="text-4xl sm:text-6xl lg:text-[62px] font-extrabold font-outfit tracking-tight leading-[1.08] text-white">
            Precision Grooming. <br />
            <span className="font-editorial italic font-normal text-4xl sm:text-6xl lg:text-[68px] gradient-text-flow block mt-1 tracking-normal">
              Delivered to Your Living Room.
            </span>
          </h1>

          <p className="text-base sm:text-lg text-gray-300 max-w-2xl font-normal leading-relaxed mx-auto lg:mx-0">
            Skip the salon queues. Experienced, background-verified mobile barbers arrive at your home with sterilized single-use kits, hot towel treatments, and full cleanup in under 30 minutes.
          </p>

          {/* Quick Action Buttons */}
          <div className="flex flex-col sm:flex-row items-center justify-center lg:justify-start gap-4 pt-2">
            <button
              onClick={onOpenBooking}
              className="w-full sm:w-auto gradient-flow hover:opacity-95 text-white font-extrabold px-8 py-4 rounded-2xl text-sm sm:text-base transition-all shadow-xl shadow-[#ff6c4c]/30 flex items-center justify-center gap-3 active:scale-95 group"
            >
              <Zap className="w-5 h-5 fill-current text-white" />
              <span>Book Doorstep Service</span>
              <ArrowRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
            </button>

            {onOpenServices && (
              <button
                onClick={onOpenServices}
                className="w-full sm:w-auto glass-card hover:bg-white/[0.08] text-gray-200 font-bold px-7 py-4 rounded-2xl text-sm sm:text-base border border-white/[0.12] transition-all flex items-center justify-center gap-2 active:scale-95 group"
              >
                <Scissors className="w-4 h-4 text-[#ff6c4c] group-hover:rotate-12 transition-transform" />
                <span>Services & Packages</span>
              </button>
            )}
          </div>

          {/* Trust Metrics Grid */}
          <div className="pt-6 border-t border-white/[0.08] grid grid-cols-3 gap-6 text-left max-w-xl mx-auto lg:mx-0">
            <div>
              <div className="flex items-center gap-1.5">
                <span className="text-2xl sm:text-3xl font-extrabold font-outfit text-white">25</span>
                <span className="text-xs font-bold text-[#ff6c4c] uppercase">Mins</span>
              </div>
              <span className="text-[11px] sm:text-xs text-gray-400 font-medium block mt-0.5">Average Arrival</span>
            </div>

            <div>
              <div className="flex items-center gap-1.5">
                <Star className="w-4 h-4 text-[#ff6c4c] fill-[#ff6c4c]" />
                <span className="text-2xl sm:text-3xl font-extrabold font-outfit text-white">4.94</span>
              </div>
              <span className="text-[11px] sm:text-xs text-gray-400 font-medium block mt-0.5">3,400+ Verified Visits</span>
            </div>

            <div>
              <div className="flex items-center gap-1.5">
                <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                <span className="text-2xl sm:text-3xl font-extrabold font-outfit text-white">100%</span>
              </div>
              <span className="text-[11px] sm:text-xs text-gray-400 font-medium block mt-0.5">Sterilized Toolkits</span>
            </div>
          </div>

        </div>

        {/* 3D Visual & Live Floating Status Badges */}
        <div className="lg:col-span-5 relative">
          <div className="glass-card rounded-[32px] p-2 relative overflow-hidden border-white/[0.1] shadow-2xl shadow-black/80">
            <Canvas3D />

            {/* Top Floating Pill: Live Dispatch */}
            <div className="absolute top-5 left-5 glass-card p-3 rounded-2xl border-white/15 flex items-center gap-3 animate-float pointer-events-none shadow-xl">
              <div className="w-10 h-10 rounded-xl gradient-flow flex items-center justify-center text-white font-extrabold shadow-md">
                <Clock className="w-5 h-5" />
              </div>
              <div>
                <span className="text-xs font-extrabold text-white block">Real-time GPS Dispatch</span>
                <span className="text-[10px] text-[#ff6c4c] font-bold flex items-center gap-1">
                  <span className="w-1.5 h-1.5 rounded-full bg-[#ff6c4c] animate-ping"></span>
                  4 Partner Barbers Active
                </span>
              </div>
            </div>

            {/* Bottom Floating Pill: Hygiene Standard */}
            <div className="absolute bottom-10 right-5 glass-card p-3 rounded-2xl border-white/15 flex items-center gap-3 animate-float [animation-delay:2s] pointer-events-none shadow-xl">
              <div className="w-10 h-10 rounded-xl bg-emerald-500/20 border border-emerald-500/40 flex items-center justify-center text-emerald-400">
                <ShieldCheck className="w-5 h-5" />
              </div>
              <div>
                <span className="text-xs font-extrabold text-white block">10-Point Hygiene Protocol</span>
                <span className="text-[10px] text-gray-400 font-medium">Single-use capes & fresh blades</span>
              </div>
            </div>
          </div>
        </div>

      </div>
    </section>
  );
};
