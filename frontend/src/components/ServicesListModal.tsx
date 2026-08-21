import React, { useState } from 'react';
import type { ServiceItem } from '../types';
import { 
  X, 
  Sparkles,
  Clock, 
  Star, 
  ShieldCheck, 
  CheckCircle2, 
  Zap, 
  Scissors, 
  Search,
  Package,
  ArrowRight
} from 'lucide-react';

interface ServicesListModalProps {
  isOpen: boolean;
  onClose: () => void;
  services: ServiceItem[];
  onSelectService: (service: ServiceItem) => void;
  onNavigateToCatalogSection?: () => void;
}

export const ServicesListModal: React.FC<ServicesListModalProps> = ({
  isOpen,
  onClose,
  services,
  onSelectService,
  onNavigateToCatalogSection,
}) => {
  if (!isOpen) return null;

  const [selectedCategory, setSelectedCategory] = useState<string>('all');
  const [searchQuery, setSearchQuery] = useState<string>('');

  const defaultServices: (ServiceItem & { originalPrice?: number; discount?: string; rating?: number; reviewCount?: number; inclusions?: string[]; isPackage?: boolean })[] = [
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
      isPackage: true,
      status: 'ACTIVE',
      rating: 4.98,
      reviewCount: 890,
      inclusions: ['Haircut + Beard Styling', 'Charcoal De-Tan Facial', 'Head & Neck Tension Massage'],
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
      isPackage: true,
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
    { id: 'all', label: 'All Services & Packages' },
    { id: 'package', label: '👑 Luxury Packages' },
    { id: 'hair', label: '✂️ Haircuts & Styling' },
    { id: 'beard', label: '🪒 Beard & Shaving' },
    { id: 'spa', label: '💆 Hair Spa & Facials' },
  ];

  const filteredServices = sourceServices.filter((s) => {
    // Category match
    const categoryMatch = selectedCategory === 'all' || s.categoryId === selectedCategory;
    
    // Search query match
    const query = searchQuery.trim().toLowerCase();
    const searchMatch = !query || 
      s.name.toLowerCase().includes(query) || 
      s.description.toLowerCase().includes(query) ||
      (s.categoryId && s.categoryId.toLowerCase().includes(query));

    return categoryMatch && searchMatch;
  });

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 md:p-6 bg-black/85 backdrop-blur-xl animate-fade-in">
      <div 
        className="glass-card rounded-[32px] w-full max-w-4xl border-white/20 overflow-hidden shadow-2xl relative max-h-[90vh] flex flex-col bg-[#0b0d14]/95"
        onClick={(e) => e.stopPropagation()}
      >
        
        {/* Modal Header */}
        <div className="px-6 py-5 border-b border-white/10 flex items-center justify-between bg-[#10131d]/90">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl gradient-flow flex items-center justify-center text-white font-extrabold shadow-md shadow-[#ff6c4c]/20">
              <Scissors className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-lg sm:text-xl font-extrabold font-outfit text-white">
                  Doorstep Services & Packages
                </h3>
                <span className="hidden sm:inline-flex items-center gap-1 text-[10px] font-extrabold px-2 py-0.5 rounded-full bg-[#ff6c4c]/15 text-[#ff8a6a] border border-[#ff6c4c]/30">
                  <Sparkles className="w-3 h-3 text-[#ff6c4c]" />
                  LIVE MENU
                </span>
              </div>
              <p className="text-xs text-gray-400 mt-0.5">
                Premium grooming and combo packages delivered directly to your home
              </p>
            </div>
          </div>

          <button
            onClick={onClose}
            title="Close"
            className="p-2 rounded-full hover:bg-white/10 text-gray-400 hover:text-white transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Search & Category Filter Controls */}
        <div className="p-5 sm:px-6 border-b border-white/[0.08] bg-[#0c0e17]/80 space-y-3.5">
          {/* Search Bar */}
          <div className="relative">
            <Search className="w-4 h-4 text-gray-400 absolute left-4 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              placeholder="Search service, beard spa, haircut, combo package..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-11 pr-4 py-2.5 rounded-2xl bg-white/[0.04] border border-white/[0.1] text-xs sm:text-sm text-white placeholder-gray-500 focus:outline-none focus:border-[#ff6c4c]/60 transition-colors"
            />
            {searchQuery && (
              <button
                onClick={() => setSearchQuery('')}
                className="absolute right-3.5 top-1/2 -translate-y-1/2 text-xs text-gray-400 hover:text-white"
              >
                Clear
              </button>
            )}
          </div>

          {/* Category Filter Pills */}
          <div className="flex items-center gap-2 overflow-x-auto pb-1 no-scrollbar">
            {categories.map((cat) => {
              const count = cat.id === 'all' 
                ? sourceServices.length 
                : sourceServices.filter(s => s.categoryId === cat.id).length;

              return (
                <button
                  key={cat.id}
                  onClick={() => setSelectedCategory(cat.id)}
                  className={`px-3.5 py-1.5 rounded-xl text-xs font-bold whitespace-nowrap transition-all border flex items-center gap-1.5 ${
                    selectedCategory === cat.id
                      ? 'gradient-flow text-white font-extrabold shadow-md shadow-[#ff6c4c]/20 border-transparent scale-105'
                      : 'bg-[#13151f] hover:bg-[#1c202e] text-gray-300 border-white/[0.08]'
                  }`}
                >
                  <span>{cat.label}</span>
                  <span className={`text-[10px] px-1.5 py-0.2 rounded-full ${
                    selectedCategory === cat.id ? 'bg-white/20 text-white' : 'bg-white/[0.06] text-gray-400'
                  }`}>
                    {count}
                  </span>
                </button>
              );
            })}
          </div>
        </div>

        {/* Services & Packages List */}
        <div className="p-5 sm:p-6 overflow-y-auto flex-1 space-y-4">
          {filteredServices.length === 0 ? (
            <div className="py-16 text-center space-y-3">
              <div className="w-14 h-14 rounded-2xl bg-white/[0.04] border border-white/[0.08] flex items-center justify-center mx-auto text-gray-400">
                <Search className="w-6 h-6" />
              </div>
              <p className="text-sm font-bold text-white">No services found matching "{searchQuery}"</p>
              <p className="text-xs text-gray-400">Try searching for a different keyword or reset filters.</p>
              <button
                onClick={() => {
                  setSelectedCategory('all');
                  setSearchQuery('');
                }}
                className="px-4 py-2 rounded-xl gradient-flow text-white text-xs font-bold"
              >
                Reset All Filters
              </button>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {filteredServices.map((service, index) => {
                const extra = defaultServices[index % defaultServices.length];
                const originalPrice = (service as any).originalPrice || extra.originalPrice || Math.round(service.price * 1.45);
                const discount = (service as any).discount || extra.discount || '30% OFF';
                const rating = (service as any).rating || extra.rating || 4.93;
                const reviewCount = (service as any).reviewCount || extra.reviewCount || 350;
                const inclusions = (service as any).inclusions || extra.inclusions || ['Single-use cape', 'Sanitized blades', 'Organic styling'];
                const isPackage = service.categoryId === 'package' || (service as any).isPackage;

                return (
                  <div
                    key={service._id}
                    className={`rounded-3xl p-5 sm:p-6 flex flex-col justify-between relative group border transition-all duration-200 ${
                      isPackage 
                        ? 'bg-gradient-to-br from-[#ff6c4c]/10 via-[#121520] to-[#121520] border-[#ff6c4c]/30 shadow-lg hover:border-[#ff6c4c]/60' 
                        : 'bg-[#121520] border-white/[0.08] hover:border-[#ff6c4c]/40 hover:bg-[#161a27]'
                    }`}
                  >
                    <div className="space-y-3">
                      {/* Badges Row */}
                      <div className="flex items-center justify-between gap-2">
                        {isPackage ? (
                          <span className="px-2.5 py-0.5 rounded-full gradient-flow text-white text-[10px] font-extrabold flex items-center gap-1 shadow-sm">
                            <Package className="w-3 h-3" />
                            👑 LUXURY PACKAGE
                          </span>
                        ) : (
                          <span className="px-2.5 py-0.5 rounded-full bg-white/[0.06] text-gray-300 text-[10px] font-bold border border-white/[0.08]">
                            {service.categoryId?.toUpperCase() || 'SERVICE'}
                          </span>
                        )}

                        <div className="flex items-center gap-1 text-[11px] font-bold text-[#ff8a6a]">
                          <Star className="w-3.5 h-3.5 fill-[#ff6c4c] text-[#ff6c4c]" />
                          <span>{rating}</span>
                          <span className="text-gray-400 font-normal text-[10px]">({reviewCount})</span>
                        </div>
                      </div>

                      {/* Title & Description */}
                      <div>
                        <h4 className="text-base font-extrabold font-outfit text-white group-hover:text-[#ff8a6a] transition-colors">
                          {service.name}
                        </h4>
                        <p className="text-xs text-gray-400 mt-1 line-clamp-2 leading-relaxed">
                          {service.description}
                        </p>
                      </div>

                      {/* Inclusions */}
                      <div className="pt-2 space-y-1 border-t border-white/[0.06]">
                        {inclusions.slice(0, 3).map((inc: string, i: number) => (
                          <div key={i} className="flex items-center gap-1.5 text-[11px] text-gray-300">
                            <CheckCircle2 className="w-3 h-3 text-[#ff6c4c] shrink-0" />
                            <span className="truncate">{inc}</span>
                          </div>
                        ))}
                      </div>
                    </div>

                    {/* Price & CTA */}
                    <div className="pt-4 mt-4 border-t border-white/[0.08] flex items-center justify-between gap-3">
                      <div>
                        <div className="flex items-baseline gap-1.5">
                          <span className="text-xl font-extrabold text-white font-outfit">
                            ₹{service.price}
                          </span>
                          <span className="text-xs text-gray-500 line-through">
                            ₹{originalPrice}
                          </span>
                          <span className="text-[9px] font-extrabold px-1.5 py-0.5 rounded bg-emerald-500/15 text-emerald-400 border border-emerald-500/30">
                            {discount}
                          </span>
                        </div>
                        <div className="flex items-center gap-1 text-[10px] text-gray-400 mt-0.5">
                          <Clock className="w-3 h-3 text-[#ff6c4c]" />
                          <span>{service.durationMinutes} mins</span>
                        </div>
                      </div>

                      <button
                        onClick={() => {
                          onSelectService(service);
                          onClose();
                        }}
                        className="px-4 py-2.5 rounded-xl gradient-flow hover:opacity-95 text-white font-extrabold text-xs shadow-md shadow-[#ff6c4c]/20 transition-all flex items-center gap-1.5 active:scale-95 shrink-0"
                      >
                        <Zap className="w-3.5 h-3.5 fill-current" />
                        <span>Book Service</span>
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Modal Footer */}
        <div className="px-6 py-4 border-t border-white/10 bg-[#0c0e16] flex flex-col sm:flex-row items-center justify-between gap-3 text-xs text-gray-400">
          <div className="flex items-center gap-2 text-emerald-400 text-xs font-semibold">
            <ShieldCheck className="w-4 h-4" />
            <span>100% Sanitized Toolkits & Verified Mobile Barbers</span>
          </div>

          {onNavigateToCatalogSection && (
            <button
              onClick={() => {
                onClose();
                onNavigateToCatalogSection();
              }}
              className="text-xs text-[#ff8a6a] hover:text-white font-bold flex items-center gap-1 transition-colors"
            >
              <span>View Full Catalog Page</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </button>
          )}
        </div>

      </div>
    </div>
  );
};
