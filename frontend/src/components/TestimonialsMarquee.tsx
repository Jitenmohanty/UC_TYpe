import React from 'react';
import { Star, Sparkles, CheckCircle2, Quote } from 'lucide-react';

export const TestimonialsMarquee: React.FC = () => {
  const reviews = [
    {
      name: 'Dr. Siddharth Mohanty',
      role: 'Surgeon • Brahmapur',
      rating: 5,
      text: 'With my hospital schedules, finding time for a salon visit was impossible. Aura Flow sent Amit to my apartment in 20 minutes with a sealed hygiene kit. The skin fade was cleaner than top salon chains.',
      service: 'Executive Haircut + Hot Towel',
    },
    {
      name: 'Priya Mishra',
      role: 'Architect • Bhubaneswar',
      rating: 5,
      text: 'Booked the charcoal detox spa and haircut package for my father. The mobile barber was exceptionally polite, verified the OTP, and left the floor spotless after the session. Pure 5-star experience!',
      service: 'Full Royal Deluxe Package',
    },
    {
      name: 'Rohit Dash',
      role: 'Tech Lead • Cuttack',
      rating: 5,
      text: 'The 6-digit OTP verification gives total peace of mind. Single-use capes and fresh blades unsealed in front of me. Unbelievable precision and zero queues.',
      service: 'Haircut + Beard Glow Duo',
    },
    {
      name: 'Ananya Patnaik',
      role: 'Creative Director • Brahmapur',
      rating: 5,
      text: 'Fast, luxurious, and ultra-hygienic. The organic keratin scalp detox was heavenly. Will never go back to traditional waiting rooms again.',
      service: 'Scalp Detox & Hair Spa',
    },
  ];

  return (
    <section className="py-24 relative z-10 bg-[#08090d] border-t border-white/[0.06] overflow-hidden">
      <div className="max-w-7xl mx-auto px-4 md:px-8 space-y-16">
        
        {/* Section Header */}
        <div className="text-center max-w-3xl mx-auto space-y-4">
          <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-[#ff6c4c]/10 border border-[#ff6c4c]/30 text-[#ff8a6a] text-xs font-bold">
            <Sparkles className="w-3.5 h-3.5 text-[#ff6c4c]" />
            <span>Verified Home Visit Feedback</span>
          </div>
          <h2 className="text-3xl sm:text-5xl font-extrabold font-outfit text-white">
            Loved by <span className="gradient-text-flow font-editorial italic font-normal">3,400+ Homes</span>
          </h2>
          <p className="text-gray-400 text-sm sm:text-base font-normal">
            See how homeowners and busy professionals in Odisha experience salon-grade grooming delivered to their living rooms.
          </p>
        </div>

        {/* Reviews Cards Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          {reviews.map((rev, idx) => (
            <div
              key={idx}
              className="glass-card glass-card-hover rounded-3xl p-6 border-white/[0.08] relative flex flex-col justify-between hover:border-[#ff6c4c]/40 shadow-xl"
            >
              <div className="space-y-4">
                {/* Rating & Quote Icon */}
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-1">
                    {[...Array(rev.rating)].map((_, i) => (
                      <Star key={i} className="w-3.5 h-3.5 fill-[#ff6c4c] text-[#ff6c4c]" />
                    ))}
                  </div>
                  <Quote className="w-5 h-5 text-white/10" />
                </div>

                <p className="text-xs sm:text-sm text-gray-300 leading-relaxed font-normal">
                  "{rev.text}"
                </p>
              </div>

              <div className="pt-5 mt-5 border-t border-white/[0.08] space-y-2">
                <div className="flex items-center justify-between">
                  <div>
                    <h4 className="font-extrabold text-sm text-white flex items-center gap-1">
                      {rev.name}
                      <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
                    </h4>
                    <span className="text-[11px] text-gray-400 font-medium block">{rev.role}</span>
                  </div>
                </div>
                <span className="text-[10px] font-bold px-2 py-0.5 rounded-md bg-white/[0.04] text-[#ff8a6a] border border-white/[0.06] inline-block">
                  {rev.service}
                </span>
              </div>
            </div>
          ))}
        </div>

      </div>
    </section>
  );
};
