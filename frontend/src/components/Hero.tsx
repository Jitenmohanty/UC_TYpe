import React from 'react';
import { Canvas3D } from './Canvas3D';
import { Sparkles, Zap, ShieldCheck, MapPin, Clock, ArrowRight } from 'lucide-react';

interface HeroProps {
  onOpenBooking: () => void;
}

export const Hero: React.FC<HeroProps> = ({ onOpenBooking }) => {
  return (
    <section className="relative min-h-[90vh] flex items-center justify-center pt-8 pb-16 overflow-hidden">
      <div className="absolute top-1/4 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[600px] bg-purple-600/15 rounded-full blur-[140px] pointer-events-none"></div>
      <div className="absolute top-1/3 right-10 w-[400px] h-[400px] bg-amber-500/10 rounded-full blur-[120px] pointer-events-none"></div>

      <div className="max-w-7xl mx-auto px-4 md:px-8 w-full grid grid-cols-1 lg:grid-cols-12 gap-12 items-center relative z-10">
        
        <div className="lg:col-span-7 space-y-6 text-center lg:text-left">
          
          <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-purple-500/10 border border-purple-500/30 text-purple-300 text-xs font-semibold tracking-wide">
            <Sparkles className="w-3.5 h-3.5 text-amber-400" />
            Premium On-Demand Salon & Barber Services
          </div>

          <h1 className="text-4xl sm:text-6xl lg:text-7xl font-extrabold font-outfit tracking-tight leading-[1.1]">
            Precision Grooming. <br />
            <span className="gradient-text">Delivered to Your Door.</span>
          </h1>

          <p className="text-base sm:text-lg text-gray-300 max-w-2xl font-light leading-relaxed mx-auto lg:mx-0">
            Experience luxury salon styling delivered right to your home. Connect instantly with top-rated professional mobile barbers in your neighborhood.
          </p>

          <div className="flex flex-col sm:flex-row items-center justify-center lg:justify-start gap-4 pt-2">
            <button
              onClick={onOpenBooking}
              className="w-full sm:w-auto gradient-gold hover:opacity-95 text-black font-bold px-8 py-4 rounded-2xl text-base transition-all shadow-xl shadow-amber-500/25 flex items-center justify-center gap-3 hover:scale-105 active:scale-95"
            >
              <Zap className="w-5 h-5 fill-current" />
              Book Appointment Now
              <ArrowRight className="w-4 h-4" />
            </button>

            <a
              href="#radar"
              className="w-full sm:w-auto glass-card hover:bg-white/10 text-gray-200 font-semibold px-6 py-4 rounded-2xl text-base border border-white/10 transition-all flex items-center justify-center gap-2"
            >
              <MapPin className="w-4 h-4 text-purple-400" />
              Explore Nearby Barbers
            </a>
          </div>

          <div className="pt-6 border-t border-white/10 grid grid-cols-3 gap-4 text-left max-w-lg mx-auto lg:mx-0">
            <div>
              <span className="text-2xl font-bold font-outfit text-white flex items-center gap-1">
                &lt; 30<span className="text-xs text-purple-400 font-normal">min</span>
              </span>
              <span className="text-xs text-gray-400 block">Fast Doorstep Arrival</span>
            </div>
            <div>
              <span className="text-2xl font-bold font-outfit text-amber-400 flex items-center gap-1">
                4.9 ★
              </span>
              <span className="text-xs text-gray-400 block">Client Rating</span>
            </div>
            <div>
              <span className="text-2xl font-bold font-outfit text-white flex items-center gap-1">
                100%
              </span>
              <span className="text-xs text-gray-400 block">Verified Pros</span>
            </div>
          </div>

        </div>

        <div className="lg:col-span-5 relative">
          <div className="glass-card rounded-3xl p-2 relative overflow-hidden border-purple-500/20 shadow-2xl shadow-purple-950/50">
            <Canvas3D />

            <div className="absolute top-6 left-6 glass-card p-3 rounded-2xl border-white/15 flex items-center gap-3 animate-float pointer-events-none">
              <div className="w-10 h-10 rounded-xl bg-purple-600/30 border border-purple-500/40 flex items-center justify-center text-purple-400">
                <Clock className="w-5 h-5" />
              </div>
              <div>
                <span className="text-xs font-bold text-white block">Real-time Dispatch</span>
                <span className="text-[10px] text-green-400 flex items-center gap-1">
                  <span className="w-1.5 h-1.5 rounded-full bg-green-400 animate-pulse"></span>
                  Barbers Active Now
                </span>
              </div>
            </div>

            <div className="absolute bottom-12 right-6 glass-card p-3 rounded-2xl border-white/15 flex items-center gap-3 animate-float [animation-delay:2s] pointer-events-none">
              <div className="w-10 h-10 rounded-xl bg-amber-500/30 border border-amber-500/40 flex items-center justify-center text-amber-400">
                <ShieldCheck className="w-5 h-5" />
              </div>
              <div>
                <span className="text-xs font-bold text-white block">Sanitized Equipment</span>
                <span className="text-[10px] text-gray-400">Premium Hygiene Protocol</span>
              </div>
            </div>
          </div>
        </div>

      </div>
    </section>
  );
};
