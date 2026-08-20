import React from 'react';
import { ShieldCheck, KeyRound, Sparkles, CheckCircle2, Award, Compass } from 'lucide-react';

export const BentoFeatures: React.FC = () => {

  const hygienePoints = [
    'Hermetically sealed single-use cape & towels',
    'Fresh titanium surgical-grade disposable blade per client',
    'Ultrasonic tool sterilization before every session',
    'Organic styling wax & paraben-free shampoo finish',
    'Full vacuum floor cleanup & sanitized debris disposal',
  ];

  return (
    <section className="py-24 relative z-10 bg-[#08090d]">
      <div className="max-w-7xl mx-auto px-4 md:px-8 space-y-16">
        
        {/* Section Title */}
        <div className="text-center max-w-3xl mx-auto space-y-4">
          <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-[#ff6c4c]/10 border border-[#ff6c4c]/30 text-[#ff8a6a] text-xs font-bold">
            <Sparkles className="w-3.5 h-3.5 text-[#ff6c4c]" />
            <span>The Modern Doorstep Standard</span>
          </div>
          <h2 className="text-3xl sm:text-5xl font-extrabold font-outfit text-white">
            Engineered for <span className="gradient-text-flow font-editorial italic font-normal">Luxury & Speed</span>
          </h2>
          <p className="text-gray-400 text-sm sm:text-base leading-relaxed font-normal">
            We reinvented salon grooming from the ground up. Combining military-grade hygiene standards with real-time dispatch algorithms.
          </p>
        </div>

        {/* Wispr Flow Bento Grid */}
        <div className="grid grid-cols-1 md:grid-cols-12 gap-6">
          
          {/* Tile 1: Large 7-col - 10-Point Hygiene Protocol */}
          <div className="md:col-span-7 glass-card rounded-[32px] p-8 sm:p-10 border-white/[0.08] relative overflow-hidden flex flex-col justify-between group hover:border-[#ff6c4c]/40 transition-all shadow-xl">
            <div className="space-y-6 relative z-10">
              <div className="flex items-center justify-between">
                <div className="w-14 h-14 rounded-2xl bg-emerald-500/15 border border-emerald-500/30 flex items-center justify-center text-emerald-400">
                  <ShieldCheck className="w-7 h-7" />
                </div>
                <span className="text-[11px] font-extrabold px-3 py-1 rounded-full bg-emerald-500/10 text-emerald-300 border border-emerald-500/30">
                  100% Sterile Certified
                </span>
              </div>

              <div>
                <h3 className="text-2xl sm:text-3xl font-extrabold font-outfit text-white">
                  Hospital-Grade Hygiene Protocol
                </h3>
                <p className="text-sm text-gray-400 mt-2 leading-relaxed">
                  Every mobile kit is sealed at our sterilization hub. Barbers unseal fresh blades and sanitized disposable capes in front of your eyes.
                </p>
              </div>

              {/* Checklist */}
              <div className="space-y-2.5 pt-2">
                {hygienePoints.map((point, i) => (
                  <div key={i} className="flex items-center gap-3 text-xs sm:text-sm text-gray-300">
                    <CheckCircle2 className="w-4 h-4 text-[#ff6c4c] shrink-0" />
                    <span>{point}</span>
                  </div>
                ))}
              </div>
            </div>

            <div className="pt-8 mt-6 border-t border-white/[0.08] flex items-center justify-between text-xs text-gray-400">
              <span>Zero salon queue contact</span>
              <span className="text-emerald-400 font-bold">100% Guaranteed</span>
            </div>
          </div>

          {/* Tile 2: 5-col - Sub-Second GPS Dispatch */}
          <div className="md:col-span-5 glass-card rounded-[32px] p-8 sm:p-10 border-white/[0.08] relative overflow-hidden flex flex-col justify-between group hover:border-[#ff6c4c]/40 transition-all shadow-xl">
            <div className="space-y-6 relative z-10">
              <div className="flex items-center justify-between">
                <div className="w-14 h-14 rounded-2xl gradient-flow text-white flex items-center justify-center font-extrabold shadow-lg shadow-[#ff6c4c]/20">
                  <Compass className="w-7 h-7" />
                </div>
                <span className="text-[11px] font-extrabold px-3 py-1 rounded-full bg-[#ff6c4c]/10 text-[#ff8a6a] border border-[#ff6c4c]/30">
                  Live Dispatch
                </span>
              </div>

              <div>
                <h3 className="text-2xl font-extrabold font-outfit text-white">
                  25-Min Doorstep Arrival
                </h3>
                <p className="text-sm text-gray-400 mt-2 leading-relaxed">
                  Our algorithm matches the highest-rated partner barber within a 10 km radius of your GPS location with real-time route optimization.
                </p>
              </div>

              {/* Live Dispatch Pulse Card */}
              <div className="p-4 rounded-2xl bg-white/[0.04] border border-white/[0.08] flex items-center gap-3">
                <div className="w-3 h-3 rounded-full bg-[#ff6c4c] animate-ping shrink-0"></div>
                <div className="text-xs text-gray-300">
                  <span className="font-bold text-white block">Active in Brahmapur & Bhubaneswar</span>
                  <span className="text-[11px] text-[#ff8a6a]">4 Partner Barbers ready for dispatch</span>
                </div>
              </div>
            </div>

            <div className="pt-6 border-t border-white/[0.08] text-xs text-gray-400 flex items-center justify-between">
              <span>Average Arrival Time</span>
              <span className="text-white font-extrabold">24.6 mins</span>
            </div>
          </div>

          {/* Tile 3: 5-col - Cryptographic 6-Digit OTP Handshake */}
          <div className="md:col-span-5 glass-card rounded-[32px] p-8 sm:p-10 border-white/[0.08] relative overflow-hidden flex flex-col justify-between group hover:border-[#ff6c4c]/40 transition-all shadow-xl">
            <div className="space-y-6 relative z-10">
              <div className="flex items-center justify-between">
                <div className="w-14 h-14 rounded-2xl bg-amber-500/15 border border-amber-500/30 flex items-center justify-center text-amber-400">
                  <KeyRound className="w-7 h-7" />
                </div>
                <span className="text-[11px] font-extrabold px-3 py-1 rounded-full bg-amber-500/10 text-amber-300 border border-amber-500/30">
                  Secure Handshake
                </span>
              </div>

              <div>
                <h3 className="text-2xl font-extrabold font-outfit text-white">
                  6-Digit OTP Handshake
                </h3>
                <p className="text-sm text-gray-400 mt-2 leading-relaxed">
                  Your service only starts after you share the private 6-digit OTP dispatched to your phone via Twilio SMS.
                </p>
              </div>

              {/* Sample OTP Mockup */}
              <div className="flex gap-2 justify-center py-2">
                {['8', '4', '2', '9', '1', '7'].map((d, idx) => (
                  <div key={idx} className="w-9 h-11 rounded-xl bg-white/[0.06] border border-[#ff6c4c]/40 text-[#ff8a6a] font-mono font-extrabold text-lg flex items-center justify-center">
                    {d}
                  </div>
                ))}
              </div>
            </div>

            <div className="pt-6 border-t border-white/[0.08] text-xs text-gray-400 flex items-center justify-between">
              <span>SMS Dispatch Provider</span>
              <span className="text-[#ff8a6a] font-bold">Twilio Global Gateway</span>
            </div>
          </div>

          {/* Tile 4: 7-col - Transparent Fair Pricing & Master Stylists */}
          <div className="md:col-span-7 glass-card rounded-[32px] p-8 sm:p-10 border-white/[0.08] relative overflow-hidden flex flex-col justify-between group hover:border-[#ff6c4c]/40 transition-all shadow-xl">
            <div className="space-y-6 relative z-10">
              <div className="flex items-center justify-between">
                <div className="w-14 h-14 rounded-2xl bg-[#ff6c4c]/15 border border-[#ff6c4c]/30 flex items-center justify-center text-[#ff6c4c]">
                  <Award className="w-7 h-7" />
                </div>
                <span className="text-[11px] font-extrabold px-3 py-1 rounded-full bg-white/10 text-gray-200 border border-white/20">
                  Zero Hidden Fees
                </span>
              </div>

              <div>
                <h3 className="text-2xl sm:text-3xl font-extrabold font-outfit text-white">
                  Transparent Pricing & Fair Partner Wages
                </h3>
                <p className="text-sm text-gray-400 mt-2 leading-relaxed">
                  Save 30% compared to luxury brick-and-mortar salon chains while our partner barbers earn 3x standard wages through direct booking.
                </p>
              </div>

              <div className="grid grid-cols-3 gap-4 pt-2">
                <div className="p-3.5 rounded-2xl bg-white/[0.03] border border-white/[0.06] text-center">
                  <span className="text-xl font-extrabold text-white block">₹399</span>
                  <span className="text-[10px] text-gray-400">Haircut & Spa</span>
                </div>
                <div className="p-3.5 rounded-2xl bg-white/[0.03] border border-white/[0.06] text-center">
                  <span className="text-xl font-extrabold text-white block">₹249</span>
                  <span className="text-[10px] text-gray-400">Beard Sculpting</span>
                </div>
                <div className="p-3.5 rounded-2xl bg-white/[0.03] border border-white/[0.06] text-center">
                  <span className="text-xl font-extrabold text-[#ff8a6a] block">₹699</span>
                  <span className="text-[10px] text-gray-400">Full Royal Combo</span>
                </div>
              </div>
            </div>

            <div className="pt-8 mt-6 border-t border-white/[0.08] flex items-center justify-between text-xs text-gray-400">
              <span>Post-Service Cleanup Included</span>
              <span className="text-white font-bold">100% Free</span>
            </div>
          </div>

        </div>

      </div>
    </section>
  );
};
