import React from 'react';
import type { ServiceItem } from '../types';
import { Scissors, Clock, Sparkles, ChevronRight } from 'lucide-react';

interface ServiceCatalogProps {
  services: ServiceItem[];
  onSelectService: (service: ServiceItem) => void;
}

export const ServiceCatalog: React.FC<ServiceCatalogProps> = ({ services, onSelectService }) => {
  const displayServices = services.length > 0 ? services : [
    {
      _id: 'default-1',
      name: 'Executive Haircut & Styling',
      description: 'Custom precision haircut tailored to face structure, shampoo, scalp massage & hot towel finish.',
      price: 499,
      durationMinutes: 40,
      status: 'ACTIVE' as const,
    },
    {
      _id: 'default-2',
      name: 'Beard Sculpting & Hot Oil Spa',
      description: 'Razor edge lining, hot oil treatment, beard trim & luxury hydrating balm application.',
      price: 299,
      durationMinutes: 30,
      status: 'ACTIVE' as const,
    },
    {
      _id: 'default-3',
      name: 'Full Royal Deluxe Package',
      description: 'Haircut, beard sculpting, facial detox mask, eyebrow shaping & scalp rejuvenation massage.',
      price: 899,
      durationMinutes: 65,
      status: 'ACTIVE' as const,
    },
    {
      _id: 'default-4',
      name: 'Father & Son Duo Cut',
      description: 'Concurrent executive styling package for adult and child with complimentary refreshments.',
      price: 799,
      durationMinutes: 60,
      status: 'ACTIVE' as const,
    },
  ];

  return (
    <section id="services" className="py-20 relative z-10">
      <div className="max-w-7xl mx-auto px-4 md:px-8">
        
        <div className="text-center max-w-3xl mx-auto space-y-4 mb-16">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-purple-500/10 border border-purple-500/30 text-purple-300 text-xs font-semibold">
            <Sparkles className="w-3.5 h-3.5 text-purple-400" />
            Curated Barbering Catalog
          </div>
          <h2 className="text-3xl sm:text-5xl font-extrabold font-outfit text-white">
            Premium Services & <span className="gradient-text">Packages</span>
          </h2>
          <p className="text-gray-400 text-sm sm:text-base">
            Handcrafted grooming experiences performed by top-rated mobile barbers using professional-grade tools.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          {displayServices.map((service) => (
            <div
              key={service._id}
              className="glass-card glass-card-hover rounded-3xl p-6 flex flex-col justify-between relative group border-white/10"
            >
              <div className="space-y-4">
                <div className="w-12 h-12 rounded-2xl bg-purple-600/20 border border-purple-500/30 flex items-center justify-center text-purple-400 group-hover:scale-110 group-hover:bg-purple-600 group-hover:text-white transition-all">
                  <Scissors className="w-6 h-6" />
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
                  <div className="flex items-center gap-1.5 text-xs text-gray-400">
                    <Clock className="w-4 h-4 text-purple-400" />
                    <span>{service.durationMinutes} mins</span>
                  </div>
                  <div className="text-2xl font-extrabold font-outfit text-amber-400">
                    ₹{service.price}
                  </div>
                </div>

                <button
                  onClick={() => onSelectService(service)}
                  className="w-full py-3 rounded-xl bg-obsidian-800 hover:bg-purple-600 text-white text-xs font-bold transition-all border border-white/10 hover:border-purple-500 flex items-center justify-center gap-2 group-hover:shadow-lg group-hover:shadow-purple-500/20"
                >
                  <span>Select Service</span>
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
