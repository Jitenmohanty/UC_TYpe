import React, { useState } from 'react';
import type { ServiceItem } from '../types';
import { Clock, Sparkles, ShieldCheck, Star, CheckCircle2, Zap } from 'lucide-react';

interface ServiceCatalogProps {
  services: ServiceItem[];
  onSelectService: (service: ServiceItem) => void;
}

export const ServiceCatalog: React.FC<ServiceCatalogProps> = ({ services, onSelectService }) => {
  const [selectedCategory, setSelectedCategory] = useState<string>('all');

  const defaultServices: (ServiceItem & { originalPrice?: number; discount?: string; rating?: number; reviewCount?: number; inclusions?: string[] })[] = [
    {
      _id: 'default-1',
      name: 'Executive Haircut & Styling',
      description: 'Precision scissor & clipper haircut tailored to face structure, organic shampoo scalp cleanse, hot towel finish & styling wax.',
      price: 399,
      originalPrice: 599,
      discount: '33% OFF',
      durationMinutes: 45,
      categoryId: 'hair',
      status: 'ACTIVE',
      rating: 4.96,
      reviewCount: 680,
      inclusions: ['Single-use sterile cape', 'Scalp massage finish', 'Hot towel cleanup'],
    },
    {
      _id: 'default-2',
      name: 'Beard Sculpting & Hot Oil Spa',
      description: 'Razor edge contouring, hot oil beard nourishing treatment, precision trimming, and luxury hydrating balm application.',
      price: 249,
      originalPrice: 399,
      discount: '37% OFF',
      durationMinutes: 30,
      categoryId: 'beard',
      status: 'ACTIVE',
      rating: 4.92,
      reviewCount: 420,
      inclusions: ['Fresh disposable blade', 'Hot steam & beard oil', 'Aftershave soothing balm'],
    },
    {
      _id: 'default-3',
      name: 'Full Royal Deluxe Package',
      description: 'Complete luxury combo: Executive haircut, beard sculpting, charcoal facial detox mask, eyebrow trim & neck massage.',
      price: 699,
      originalPrice: 1099,
      discount: '36% OFF',
      durationMinutes: 75,
      categoryId: 'package',
      status: 'ACTIVE',
      rating: 4.98,
      reviewCount: 890,
      inclusions: ['Haircut + Beard Styling', 'Charcoal De-Tan Facial', 'Head & Neck Massage'],
    },
    {
      _id: 'default-4',
      name: 'Haircut + Beard Glow Duo',
      description: 'Our most popular everyday grooming package: custom haircut, beard shaping, razor cleanup & matte styling.',
      price: 499,
      originalPrice: 749,
      discount: '33% OFF',
      durationMinutes: 60,
      categoryId: 'package',
      status: 'ACTIVE',
      rating: 4.94,
      reviewCount: 1150,
      inclusions: ['Precision Haircut', 'Beard Lining & Trim', 'Post-service floor cleanup'],
    },
    {
      _id: 'default-5',
      name: 'Scalp Detox & Hair Spa Treatment',
      description: 'Deep root scalp cleansing, nourishing keratin hair mask, warm steam infusion and 15-min therapeutic head massage.',
      price: 599,
      originalPrice: 899,
      discount: '33% OFF',
      durationMinutes: 50,
      categoryId: 'spa',
      status: 'ACTIVE',
      rating: 4.91,
      reviewCount: 310,
      inclusions: ['Organic Keratin Mask', 'Warm Steam Infusion', 'Anti-Dandruff Treatment'],
    },
    {
      _id: 'default-6',
      name: 'Charcoal De-Tan Facial Glow',
      description: 'Activated charcoal deep pore extraction, dead skin exfoliation, gentle scrub, steam, and hydrating collagen mask.',
      price: 449,
      originalPrice: 699,
      discount: '35% OFF',
      durationMinutes: 40,
      categoryId: 'spa',
      status: 'ACTIVE',
      rating: 4.93,
      reviewCount: 260,
      inclusions: ['Deep Pore Cleansing', 'Dead Skin Scrub', 'Cooling Collagen Mask'],
    },
  ];

  const sourceServices = services.length > 0 ? services : defaultServices;

  const categories = [
    { id: 'all', label: 'All Services' },
    { id: 'hair', label: '✂️ Haircuts & Styling' },
    { id: 'beard', label: '🪒 Beard & Shaving' },
    { id: 'package', label: '👑 Luxury Combos' },
    { id: 'spa', label: '💆 Hair Spa & Facials' },
  ];

  const filteredServices = sourceServices.filter((s) => {
    if (selectedCategory === 'all') return true;
    return s.categoryId === selectedCategory;
  });

  return (
    <section id="services" className="py-20 relative z-10">
      <div className="max-w-7xl mx-auto px-4 md:px-8">
        
        {/* Section Header */}
        <div className="text-center max-w-3xl mx-auto space-y-4 mb-12">
          <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-[#ff6c4c]/10 border border-[#ff6c4c]/30 text-[#ff8a6a] text-xs font-bold">
            <Sparkles className="w-3.5 h-3.5 text-[#ff6c4c]" />
            <span>Curated Doorstep Grooming Menu</span>
          </div>
          <h2 className="text-3xl sm:text-5xl font-extrabold font-outfit text-white">
            Doorstep Services & <span className="gradient-text-flow font-editorial italic font-normal">Packages</span>
          </h2>
          <p className="text-gray-400 text-sm sm:text-base font-normal">
            Delivered in the comfort of your home by verified mobile barbers with 100% sanitized single-use kits.
          </p>

          {/* Category Filter Tabs */}
          <div className="flex flex-wrap items-center justify-center gap-2 pt-4">
            {categories.map((cat) => (
              <button
                key={cat.id}
                onClick={() => setSelectedCategory(cat.id)}
                className={`px-4 py-2 rounded-2xl text-xs font-bold transition-all border ${
                  selectedCategory === cat.id
                    ? 'gradient-flow text-white font-extrabold shadow-lg shadow-[#ff6c4c]/25 scale-105 border-transparent'
                    : 'bg-[#13151f] hover:bg-[#1c202e] text-gray-300 border-white/[0.08] hover:border-white/[0.15]'
                }`}
              >
                {cat.label}
              </button>
            ))}
          </div>
        </div>

        {/* Services Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {filteredServices.map((service, index) => {
            const extra = defaultServices[index % defaultServices.length];
            const originalPrice = (service as any).originalPrice || extra.originalPrice || Math.round(service.price * 1.45);
            const discount = (service as any).discount || extra.discount || '30% OFF';
            const rating = (service as any).rating || extra.rating || 4.93;
            const reviewCount = (service as any).reviewCount || extra.reviewCount || 350;
            const inclusions = (service as any).inclusions || extra.inclusions || ['Single-use cape', 'Sanitized blades', 'Organic styling'];

            return (
              <div
                key={service._id}
                className="glass-card glass-card-hover rounded-3xl p-6 md:p-7 flex flex-col justify-between relative group border-white/[0.08] hover:border-[#ff6c4c]/40 transition-all duration-300 shadow-xl"
              >
                <div className="space-y-4">
                  {/* Top Badges */}
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-[#ff6c4c]/10 border border-[#ff6c4c]/30 text-[#ff8a6a] text-[11px] font-bold">
                      <Star className="w-3 h-3 fill-[#ff6c4c] text-[#ff6c4c]" />
                      <span>{rating}</span>
                      <span className="text-gray-400 font-normal">({reviewCount})</span>
                    </div>

                    <span className="px-2.5 py-1 rounded-full bg-emerald-500/10 text-emerald-300 text-[10px] font-bold border border-emerald-500/30 flex items-center gap-1">
                      <ShieldCheck className="w-3 h-3 text-emerald-400" />
                      Sterilized Kit
                    </span>
                  </div>

                  {/* Service Title & Description */}
                  <div>
                    <h3 className="text-xl font-extrabold font-outfit text-white group-hover:text-[#ff8a6a] transition-colors">
                      {service.name}
                    </h3>
                    <p className="text-xs text-gray-400 mt-2 line-clamp-3 leading-relaxed">
                      {service.description}
                    </p>
                  </div>

                  {/* Inclusions Checklist */}
                  <div className="pt-2 space-y-1.5 border-t border-white/[0.06]">
                    <span className="text-[10px] text-gray-400 uppercase font-extrabold tracking-wider block">Service Includes:</span>
                    {inclusions.map((inc: string, i: number) => (
                      <div key={i} className="flex items-center gap-2 text-xs text-gray-300 font-medium">
                        <CheckCircle2 className="w-3.5 h-3.5 text-[#ff6c4c] shrink-0" />
                        <span>{inc}</span>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Pricing & CTA */}
                <div className="pt-5 mt-5 border-t border-white/[0.08] space-y-4">
                  <div className="flex items-baseline justify-between">
                    <div className="flex items-baseline gap-2">
                      <span className="text-2xl font-extrabold text-white font-outfit">
                        ₹{service.price}
                      </span>
                      <span className="text-xs text-gray-500 line-through font-medium">
                        ₹{originalPrice}
                      </span>
                      <span className="text-[10px] font-extrabold px-1.5 py-0.5 rounded bg-emerald-500/15 text-emerald-400 border border-emerald-500/30">
                        {discount}
                      </span>
                    </div>

                    <div className="flex items-center gap-1 text-xs text-gray-400 font-medium">
                      <Clock className="w-3.5 h-3.5 text-[#ff6c4c]" />
                      <span>{service.durationMinutes} mins</span>
                    </div>
                  </div>

                  <button
                    onClick={() => onSelectService(service)}
                    className="w-full py-3 rounded-2xl gradient-flow hover:opacity-95 text-white font-extrabold text-xs shadow-lg shadow-[#ff6c4c]/20 transition-all flex items-center justify-center gap-2 active:scale-95"
                  >
                    <Zap className="w-4 h-4 fill-current text-white" />
                    <span>Book Doorstep Visit</span>
                  </button>
                </div>
              </div>
            );
          })}
        </div>

      </div>
    </section>
  );
};
