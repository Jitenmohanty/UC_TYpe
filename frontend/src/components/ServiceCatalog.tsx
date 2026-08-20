import React, { useState } from 'react';
import type { ServiceItem } from '../types';
import { Scissors, Clock, Sparkles, ChevronRight, ShieldCheck } from 'lucide-react';

interface ServiceCatalogProps {
  services: ServiceItem[];
  onSelectService: (service: ServiceItem) => void;
}

export const ServiceCatalog: React.FC<ServiceCatalogProps> = ({ services, onSelectService }) => {
  const [selectedCategory, setSelectedCategory] = useState<string>('all');

  const defaultServices: ServiceItem[] = [
    {
      _id: 'default-1',
      name: 'Executive Haircut & Styling',
      description: 'Custom precision haircut tailored to face structure, organic shampoo, scalp massage & hot towel styling finish.',
      price: 399,
      durationMinutes: 45,
      categoryId: 'hair',
      status: 'ACTIVE',
    },
    {
      _id: 'default-2',
      name: 'Beard Sculpting & Hot Oil Spa',
      description: 'Razor edge lining, hot oil beard treatment, trimming, and luxury hydrating balm application.',
      price: 249,
      durationMinutes: 30,
      categoryId: 'beard',
      status: 'ACTIVE',
    },
    {
      _id: 'default-3',
      name: 'Full Royal Deluxe Package',
      description: 'Executive haircut, beard sculpting, charcoal facial detox mask, eyebrow trimming & neck tension massage.',
      price: 699,
      durationMinutes: 75,
      categoryId: 'package',
      status: 'ACTIVE',
    },
    {
      _id: 'default-4',
      name: 'Haircut + Beard Glow Duo',
      description: 'Complete grooming combo including custom haircut, beard trim, razor cleanup & styling.',
      price: 499,
      durationMinutes: 60,
      categoryId: 'package',
      status: 'ACTIVE',
    },
    {
      _id: 'default-5',
      name: 'Scalp Detox & Hair Spa Treatment',
      description: 'Deep root scalp cleansing, nourishing hair spa mask, warm steam infusion and head massage.',
      price: 599,
      durationMinutes: 50,
      categoryId: 'spa',
      status: 'ACTIVE',
    },
    {
      _id: 'default-6',
      name: 'Classic Hot Towel Razor Shave',
      description: 'Traditional straight razor shave with essential oils, hot lather, cold compress, and soothing aftershave balm.',
      price: 199,
      durationMinutes: 25,
      categoryId: 'beard',
      status: 'ACTIVE',
    },
  ];

  const sourceServices = services.length > 0 ? services : defaultServices;

  const categories = [
    { id: 'all', label: 'All Services' },
    { id: 'hair', label: '✂️ Haircuts & Styling' },
    { id: 'beard', label: '🪒 Beard & Shaving' },
    { id: 'package', label: '👑 Luxury Combos' },
    { id: 'spa', label: '💆 Hair Spa & Detox' },
  ];

  const filteredServices = sourceServices.filter((s) => {
    if (selectedCategory === 'all') return true;
    return s.categoryId === selectedCategory;
  });

  return (
    <section id="services" className="py-20 relative z-10">
      <div className="max-w-7xl mx-auto px-4 md:px-8">
        
        <div className="text-center max-w-3xl mx-auto space-y-4 mb-12">
          <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-purple-500/10 border border-purple-500/30 text-purple-300 text-xs font-semibold">
            <Sparkles className="w-3.5 h-3.5 text-purple-400" />
            Curated Mobile Barbering Menu
          </div>
          <h2 className="text-3xl sm:text-5xl font-extrabold font-outfit text-white">
            Doorstep Services & <span className="gradient-text">Packages</span>
          </h2>
          <p className="text-gray-400 text-sm sm:text-base">
            Handcrafted grooming experiences performed at your doorstep by top-rated mobile barber partners.
          </p>

          {/* Category Filter Tabs */}
          <div className="flex flex-wrap items-center justify-center gap-2 pt-4">
            {categories.map((cat) => (
              <button
                key={cat.id}
                onClick={() => setSelectedCategory(cat.id)}
                className={`px-4 py-2 rounded-2xl text-xs font-bold transition-all border ${
                  selectedCategory === cat.id
                    ? 'bg-purple-600 border-purple-500 text-white shadow-lg shadow-purple-500/25 scale-105'
                    : 'bg-obsidian-800/80 hover:bg-obsidian-700 text-gray-300 border-white/10 hover:border-white/20'
                }`}
              >
                {cat.label}
              </button>
            ))}
          </div>
        </div>

        {/* Services Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {filteredServices.map((service) => (
            <div
              key={service._id}
              className="glass-card glass-card-hover rounded-3xl p-6 md:p-7 flex flex-col justify-between relative group border-white/10 hover:border-purple-500/40 transition-all duration-300 shadow-xl hover:shadow-2xl hover:shadow-purple-500/10"
            >
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <div className="w-12 h-12 rounded-2xl bg-purple-600/20 border border-purple-500/30 flex items-center justify-center text-purple-400 group-hover:scale-110 group-hover:bg-purple-600 group-hover:text-white transition-all shadow-md">
                    <Scissors className="w-6 h-6" />
                  </div>
                  <span className="px-2.5 py-0.5 rounded-full bg-emerald-500/10 text-emerald-300 text-[10px] font-bold border border-emerald-500/30 flex items-center gap-1">
                    <ShieldCheck className="w-3 h-3 text-emerald-400" />
                    Doorstep Service
                  </span>
                </div>

                <div>
                  <h3 className="text-xl font-bold font-outfit text-white group-hover:text-purple-300 transition-colors">
                    {service.name}
                  </h3>
                  <p className="text-xs text-gray-400 mt-2 line-clamp-3 leading-relaxed">
                    {service.description}
                  </p>
                </div>
              </div>

              <div className="pt-6 mt-6 border-t border-white/10 space-y-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-1.5 text-xs text-gray-400 font-medium">
                    <Clock className="w-4 h-4 text-purple-400" />
                    <span>{service.durationMinutes} mins</span>
                  </div>
                  <div className="text-2xl font-extrabold font-outfit text-amber-400">
                    ₹{service.price}
                  </div>
                </div>

                <button
                  onClick={() => onSelectService(service)}
                  className="w-full py-3 rounded-2xl gradient-purple hover:opacity-95 text-white text-xs font-bold transition-all shadow-lg shadow-purple-500/25 flex items-center justify-center gap-2 group-hover:scale-[1.02]"
                >
                  <span>Book Appointment</span>
                  <ChevronRight className="w-4 h-4" />
                </button>
              </div>
            </div>
          ))}
        </div>

      </div>
    </section>
  );
};
