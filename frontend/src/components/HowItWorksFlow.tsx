import React, { useState } from 'react';
import { Calendar, Navigation, ShieldCheck, Sparkles, ArrowRight, UserCheck, CheckCircle2 } from 'lucide-react';

export const HowItWorksFlow: React.FC = () => {
  const [activeTab, setActiveTab] = useState<'client' | 'barber'>('client');

  const clientSteps = [
    {
      step: '01',
      title: 'Select Service & Confirm Address',
      desc: 'Choose your personalized grooming package or individual haircut. Our live GPS pinpoints your doorstep instantly.',
      badge: 'Takes 30 seconds',
      icon: Calendar,
    },
    {
      step: '02',
      title: 'AI Radar Match & Live Tracking',
      desc: 'Our dispatch algorithm assigns the nearest top-rated mobile barber. Track their live GPS arrival with calculated ETA.',
      badge: 'Avg 25 min arrival',
      icon: Navigation,
    },
    {
      step: '03',
      title: 'OTP Handshake & Doorstep Grooming',
      desc: 'Barber arrives with sterilized single-use tools. Share your 6-digit OTP code, enjoy your grooming, and relax with zero cleanup needed.',
      badge: '100% Sterile & Clean',
      icon: ShieldCheck,
    },
  ];

  const barberSteps = [
    {
      step: '01',
      title: 'Receive Instant Client Offers',
      desc: 'Get notified of nearby bookings with complete service details, customer address, and payout breakdown.',
      badge: 'Instant Push Alerts',
      icon: UserCheck,
    },
    {
      step: '02',
      title: 'One-Tap Acceptance & Turn-by-Turn GPS',
      desc: 'Accept the job and follow built-in GPS navigation directly to the client’s home.',
      badge: 'Optimized Routes',
      icon: Navigation,
    },
    {
      step: '03',
      title: 'Verify OTP & Receive Instant Payout',
      desc: 'Verify the customer’s OTP upon doorstep arrival. Complete the session and receive automatic earnings in your wallet.',
      badge: 'Zero Delay Payouts',
      icon: CheckCircle2,
    },
  ];

  const steps = activeTab === 'client' ? clientSteps : barberSteps;

  return (
    <section className="py-24 relative z-10 bg-[#0b0c10] border-t border-white/[0.06]">
      <div className="max-w-7xl mx-auto px-4 md:px-8 space-y-16">
        
        {/* Section Header */}
        <div className="text-center max-w-3xl mx-auto space-y-4">
          <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-[#ff6c4c]/10 border border-[#ff6c4c]/30 text-[#ff8a6a] text-xs font-bold">
            <Sparkles className="w-3.5 h-3.5 text-[#ff6c4c]" />
            <span>Seamless 3-Step Journey</span>
          </div>
          <h2 className="text-3xl sm:text-5xl font-extrabold font-outfit text-white">
            How <span className="gradient-text-flow font-editorial italic font-normal">Aura Flow</span> Works
          </h2>
          <p className="text-gray-400 text-sm sm:text-base font-normal">
            Effortless luxury grooming at the tap of a button. Here is how our doorstep ecosystem operates.
          </p>

          {/* Perspective Toggle */}
          <div className="inline-flex p-1.5 rounded-2xl bg-[#13151f] border border-white/[0.08] mt-4">
            <button
              onClick={() => setActiveTab('client')}
              className={`px-5 py-2 rounded-xl text-xs font-extrabold transition-all ${
                activeTab === 'client'
                  ? 'gradient-flow text-white shadow-lg shadow-[#ff6c4c]/20'
                  : 'text-gray-400 hover:text-white'
              }`}
            >
              For Clients
            </button>
            <button
              onClick={() => setActiveTab('barber')}
              className={`px-5 py-2 rounded-xl text-xs font-extrabold transition-all ${
                activeTab === 'barber'
                  ? 'gradient-flow text-white shadow-lg shadow-[#ff6c4c]/20'
                  : 'text-gray-400 hover:text-white'
              }`}
            >
              For Partner Barbers
            </button>
          </div>
        </div>

        {/* 3-Step Cards Grid */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-8 relative">
          {steps.map((item, index) => {
            const Icon = item.icon;
            return (
              <div
                key={index}
                className="glass-card rounded-[32px] p-8 border-white/[0.08] relative flex flex-col justify-between group hover:border-[#ff6c4c]/40 transition-all shadow-xl hover:-translate-y-1"
              >
                <div className="space-y-6">
                  {/* Step Header */}
                  <div className="flex items-center justify-between">
                    <span className="text-3xl font-extrabold font-outfit gradient-text-flow">
                      {item.step}
                    </span>
                    <div className="w-12 h-12 rounded-2xl bg-white/[0.04] border border-white/[0.08] flex items-center justify-center text-[#ff6c4c] group-hover:scale-110 group-hover:bg-[#ff6c4c]/15 transition-all">
                      <Icon className="w-6 h-6" />
                    </div>
                  </div>

                  <div>
                    <h3 className="text-xl font-extrabold font-outfit text-white group-hover:text-[#ff8a6a] transition-colors">
                      {item.title}
                    </h3>
                    <p className="text-xs sm:text-sm text-gray-400 mt-2 leading-relaxed font-normal">
                      {item.desc}
                    </p>
                  </div>
                </div>

                <div className="pt-6 mt-6 border-t border-white/[0.06] flex items-center justify-between">
                  <span className="text-[11px] font-bold text-[#ff8a6a]">
                    {item.badge}
                  </span>
                  <ArrowRight className="w-4 h-4 text-gray-500 group-hover:text-white group-hover:translate-x-1 transition-all" />
                </div>
              </div>
            );
          })}
        </div>

      </div>
    </section>
  );
};
