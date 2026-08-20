import React, { useState, useEffect } from 'react';
import type { BarberProfile } from '../types';
import { barbersApi } from '../services/api';
import { fetchLiveCoordinates, getCachedCoordinates } from '../services/location';
import { MapPin, Navigation, Star, CheckCircle2, Clock, Sparkles } from 'lucide-react';

interface NearbyBarbersRadarProps {
  onSelectBarber: (barber: BarberProfile) => void;
}

export const NearbyBarbersRadar: React.FC<NearbyBarbersRadarProps> = ({ onSelectBarber }) => {
  const [barbers, setBarbers] = useState<BarberProfile[]>([]);
  const [radiusKm, setRadiusKm] = useState(10);
  const [coords, setCoords] = useState<{ latitude: number; longitude: number }>(getCachedCoordinates());
  const [locationLoading, setLocationLoading] = useState(false);

  const defaultBarbers: BarberProfile[] = [
    {
      _id: 'b-1',
      userId: 'u-1',
      experienceYears: 7,
      rating: 4.95,
      totalReviews: 142,
      totalCompletedJobs: 480,
      autoAllocationEnabled: true,
      serviceRadiusKm: 12,
      bio: 'Master barber specialized in precision skin fades, beard sculpting, and luxury hot towel treatments. 7+ years salon experience.',
      user: {
        _id: 'u-1',
        name: 'Amit Kumar',
        email: 'amit@barber.com',
        phone: '+91 98765 11223',
        role: 'BARBER',
      },
      distanceKm: 1.2,
    },
    {
      _id: 'b-2',
      userId: 'u-2',
      experienceYears: 5,
      rating: 4.91,
      totalReviews: 98,
      totalCompletedJobs: 320,
      autoAllocationEnabled: true,
      serviceRadiusKm: 10,
      bio: 'Expert in modern texture cuts, beard styling, and organic hair spa therapies. Punctual doorstep service guaranteed.',
      user: {
        _id: 'u-2',
        name: 'Ravi Sharma',
        email: 'ravi@barber.com',
        phone: '+91 98123 44556',
        role: 'BARBER',
      },
      distanceKm: 2.7,
    },
    {
      _id: 'b-3',
      userId: 'u-3',
      experienceYears: 8,
      rating: 4.98,
      totalReviews: 215,
      totalCompletedJobs: 710,
      autoAllocationEnabled: true,
      serviceRadiusKm: 15,
      bio: 'Celebrity stylist & luxury package specialist. Expert in charcoal facial detox, royal grooming packages, and scissor finish.',
      user: {
        _id: 'u-3',
        name: 'Suresh Panda',
        email: 'suresh@barber.com',
        phone: '+91 94370 77889',
        role: 'BARBER',
      },
      distanceKm: 4.3,
    },
  ];

  const fetchNearby = async (lat: number, lng: number, r: number) => {
    try {
      const data = await barbersApi.getNearby({ latitude: lat, longitude: lng, radiusKm: r });
      if (Array.isArray(data) && data.length > 0) {
        setBarbers(data);
      } else {
        setBarbers(defaultBarbers);
      }
    } catch {
      setBarbers(defaultBarbers);
    }
  };

  useEffect(() => {
    fetchLiveCoordinates(true).then((live) => {
      setCoords(live);
      fetchNearby(live.latitude, live.longitude, radiusKm);
    });
  }, []);

  useEffect(() => {
    fetchNearby(coords.latitude, coords.longitude, radiusKm);
  }, [coords, radiusKm]);

  const handleUseMyLocation = async () => {
    setLocationLoading(true);
    try {
      const live = await fetchLiveCoordinates(true);
      setCoords(live);
    } finally {
      setLocationLoading(false);
    }
  };

  const displayBarbers = barbers.length > 0 ? barbers : defaultBarbers;

  return (
    <section id="radar" className="py-20 bg-[#090a0e] border-y border-white/[0.06] relative">
      <div className="max-w-7xl mx-auto px-4 md:px-8">
        
        {/* Section Header */}
        <div className="flex flex-col md:flex-row items-start md:items-end justify-between mb-12 gap-6">
          <div className="space-y-3">
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-[#ff6c4c]/10 border border-[#ff6c4c]/30 text-[#ff8a6a] text-xs font-bold">
              <MapPin className="w-3.5 h-3.5 text-[#ff6c4c]" />
              <span>Verified Mobile Barbers Active in Your Vicinity</span>
            </div>
            <h2 className="text-3xl sm:text-4xl font-extrabold font-outfit text-white">
              Nearby Barber <span className="gradient-text-flow font-editorial italic font-normal">Partners</span>
            </h2>
            <p className="text-xs sm:text-sm text-gray-400 font-normal">
              Select your preferred partner or allow automated dispatch to match the fastest available professional.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-3">
            <button
              onClick={handleUseMyLocation}
              disabled={locationLoading}
              className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-[#13151f] hover:bg-[#1b1f2e] text-xs font-bold text-gray-200 border border-white/[0.08] transition-all shadow-md active:scale-95"
            >
              <Navigation className={`w-4 h-4 text-[#ff6c4c] ${locationLoading ? 'animate-spin' : ''}`} />
              <span>{locationLoading ? 'Locating GPS...' : 'Sync GPS Location'}</span>
            </button>

            <select
              value={radiusKm}
              onChange={(e) => setRadiusKm(Number(e.target.value))}
              className="bg-[#13151f] text-xs font-bold text-gray-200 px-3.5 py-2.5 rounded-xl border border-white/[0.08] focus:outline-none focus:border-[#ff6c4c] shadow-md"
            >
              <option value={5}>Radius: 5 km</option>
              <option value={10}>Radius: 10 km</option>
              <option value={20}>Radius: 20 km</option>
            </select>
          </div>
        </div>

        {/* Barbers Grid */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {displayBarbers.map((barber) => {
            const distance = barber.distanceKm ?? 1.8;
            const etaMins = Math.max(10, Math.round(distance * 6 + 5));

            return (
              <div
                key={barber._id}
                className="glass-card glass-card-hover rounded-3xl p-6 border-white/[0.08] relative flex flex-col justify-between hover:border-[#ff6c4c]/40 shadow-xl"
              >
                <div className="space-y-4">
                  {/* Top Bar */}
                  <div className="flex items-start justify-between">
                    <div className="flex items-center gap-3.5">
                      <div className="relative">
                        <div className="w-12 h-12 rounded-2xl gradient-flow text-white flex items-center justify-center font-extrabold text-base shadow-md">
                          {barber.user?.name?.charAt(0) || 'B'}
                        </div>
                        <span className="absolute -bottom-1 -right-1 w-3.5 h-3.5 rounded-full bg-emerald-500 border-2 border-[#0d1017]"></span>
                      </div>

                      <div>
                        <h4 className="font-extrabold font-outfit text-base text-white flex items-center gap-1.5">
                          {barber.user?.name || 'Partner Barber'}
                          <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
                        </h4>
                        <span className="text-[11px] text-gray-400 font-medium block">
                          {barber.experienceYears}+ Years Experience • {barber.totalCompletedJobs || 300}+ cuts
                        </span>
                      </div>
                    </div>

                    <div className="flex items-center gap-1 px-2.5 py-1 rounded-full bg-[#ff6c4c]/10 border border-[#ff6c4c]/30 text-[#ff8a6a] text-xs font-bold">
                      <Star className="w-3 h-3 fill-[#ff6c4c] text-[#ff6c4c]" />
                      <span>{barber.rating || 4.9}</span>
                    </div>
                  </div>

                  {/* Bio */}
                  <p className="text-xs text-gray-300 line-clamp-2 leading-relaxed font-normal">
                    {barber.bio || 'Verified professional mobile barber equipped with sterilized grooming kit and organic styling products.'}
                  </p>

                  {/* Feature Tags */}
                  <div className="flex flex-wrap gap-1.5 pt-1">
                    <span className="text-[10px] font-bold px-2 py-0.5 rounded-md bg-white/[0.04] text-gray-300 border border-white/[0.06]">
                      ✓ Skin Fades
                    </span>
                    <span className="text-[10px] font-bold px-2 py-0.5 rounded-md bg-white/[0.04] text-gray-300 border border-white/[0.06]">
                      ✓ Beard Sculpt
                    </span>
                    <span className="text-[10px] font-bold px-2 py-0.5 rounded-md bg-white/[0.04] text-gray-300 border border-white/[0.06]">
                      ✓ Hot Towel
                    </span>
                  </div>
                </div>

                {/* Bottom Stats & CTA */}
                <div className="pt-5 mt-5 border-t border-white/[0.08] flex items-center justify-between">
                  <div>
                    <div className="flex items-center gap-1 text-xs text-emerald-400 font-bold">
                      <Clock className="w-3.5 h-3.5" />
                      <span>~{etaMins} mins away</span>
                    </div>
                    <span className="text-[10px] text-gray-400 block mt-0.5">
                      📍 {distance.toFixed(1)} km distance
                    </span>
                  </div>

                  <button
                    onClick={() => onSelectBarber(barber)}
                    className="px-4 py-2.5 rounded-xl gradient-flow hover:opacity-95 text-white font-extrabold text-xs transition-all shadow-md shadow-[#ff6c4c]/20 active:scale-95 flex items-center gap-1.5"
                  >
                    <Sparkles className="w-3.5 h-3.5" />
                    <span>Select Partner</span>
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
