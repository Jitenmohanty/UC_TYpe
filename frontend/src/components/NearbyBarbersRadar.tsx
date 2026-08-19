import React, { useState, useEffect } from 'react';
import type { BarberProfile } from '../types';
import { barbersApi } from '../services/api';
import { MapPin, Navigation, Star, ShieldCheck } from 'lucide-react';

interface NearbyBarbersRadarProps {
  onSelectBarber: (barber: BarberProfile) => void;
}

export const NearbyBarbersRadar: React.FC<NearbyBarbersRadarProps> = ({ onSelectBarber }) => {
  const [barbers, setBarbers] = useState<BarberProfile[]>([]);
  const [radiusKm, setRadiusKm] = useState(10);
  const [coords, setCoords] = useState<{ latitude: number; longitude: number }>({
    latitude: 40.7128,
    longitude: -74.006,
  });

  const fetchNearby = async (lat: number, lng: number, r: number) => {
    try {
      const data = await barbersApi.getNearby({ latitude: lat, longitude: lng, radiusKm: r });
      setBarbers(data);
    } catch {
      setBarbers([
        {
          _id: 'mock-1',
          userId: 'u-1',
          bio: 'Master Barber specializing in skin fades, beard sculpting & razor line-ups.',
          experienceYears: 7,
          rating: 4.9,
          totalReviews: 142,
          totalCompletedJobs: 380,
          autoAllocationEnabled: true,
          serviceRadiusKm: 15,
          distanceKm: 1.4,
          user: { _id: 'u-1', name: 'Marcus Vance', email: 'marcus@aura.com', phone: '+1234567890', role: 'BARBER' },
        },
        {
          _id: 'mock-2',
          userId: 'u-2',
          bio: 'Precision hairstylist with 10+ years experience in executive cuts.',
          experienceYears: 10,
          rating: 5.0,
          totalReviews: 210,
          totalCompletedJobs: 540,
          autoAllocationEnabled: true,
          serviceRadiusKm: 10,
          distanceKm: 2.8,
          user: { _id: 'u-2', name: 'Elena Rostova', email: 'elena@aura.com', phone: '+1987654321', role: 'BARBER' },
        },
        {
          _id: 'mock-3',
          userId: 'u-3',
          bio: 'Specialist in modern textured crops and hot towel shave rituals.',
          experienceYears: 5,
          rating: 4.8,
          totalReviews: 89,
          totalCompletedJobs: 195,
          autoAllocationEnabled: true,
          serviceRadiusKm: 12,
          distanceKm: 4.1,
          user: { _id: 'u-3', name: 'David Chen', email: 'david@aura.com', phone: '+1555444333', role: 'BARBER' },
        },
      ]);
    }
  };

  useEffect(() => {
    fetchNearby(coords.latitude, coords.longitude, radiusKm);
  }, [coords, radiusKm]);

  const handleUseMyLocation = () => {
    if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition((pos) => {
        setCoords({
          latitude: pos.coords.latitude,
          longitude: pos.coords.longitude,
        });
      });
    }
  };

  return (
    <section id="radar" className="py-20 bg-[#050507] border-y border-white/5 relative">
      <div className="max-w-7xl mx-auto px-4 md:px-8">
        
        <div className="flex flex-col md:flex-row items-start md:items-end justify-between mb-12 gap-6">
          <div className="space-y-3">
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-amber-500/10 border border-amber-500/30 text-amber-400 text-xs font-semibold">
              <MapPin className="w-3.5 h-3.5 text-amber-400" />
              Verified Local Barbers In Your Area
            </div>
            <h2 className="text-3xl sm:text-4xl font-extrabold font-outfit text-white">
              Available <span className="gradient-text">Barber Professionals</span>
            </h2>
          </div>

          <div className="flex items-center gap-3">
            <button
              onClick={handleUseMyLocation}
              className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-obsidian-800 hover:bg-obsidian-700 text-xs font-semibold text-purple-300 border border-purple-500/30 transition-all"
            >
              <Navigation className="w-4 h-4 text-purple-400" />
              Use My Current Location
            </button>

            <select
              value={radiusKm}
              onChange={(e) => setRadiusKm(Number(e.target.value))}
              className="bg-obsidian-800 text-xs font-semibold text-gray-200 px-3 py-2.5 rounded-xl border border-white/10 focus:outline-none focus:border-purple-500"
            >
              <option value={5}>Radius: 5 km</option>
              <option value={10}>Radius: 10 km</option>
              <option value={20}>Radius: 20 km</option>
            </select>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {barbers.map((barber) => (
            <div
              key={barber._id}
              className="glass-card glass-card-hover rounded-3xl p-6 border-white/10 relative flex flex-col justify-between"
            >
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="w-12 h-12 rounded-2xl gradient-purple flex items-center justify-center font-bold text-lg text-white shadow-md">
                      {barber.user?.name?.charAt(0) || 'B'}
                    </div>
                    <div>
                      <h4 className="font-bold font-outfit text-base text-white flex items-center gap-1.5">
                        {barber.user?.name || 'Barber Pro'}
                        <ShieldCheck className="w-4 h-4 text-purple-400" />
                      </h4>
                      <span className="text-xs text-gray-400 block">{barber.experienceYears} Years Exp.</span>
                    </div>
                  </div>

                  <div className="flex items-center gap-1 px-2.5 py-1 rounded-full bg-amber-500/10 border border-amber-500/30 text-amber-400 text-xs font-bold">
                    <Star className="w-3.5 h-3.5 fill-current" />
                    <span>{barber.rating}</span>
                  </div>
                </div>

                <p className="text-xs text-gray-300 line-clamp-2 leading-relaxed">
                  {barber.bio}
                </p>
              </div>

              <div className="pt-6 mt-6 border-t border-white/10 flex items-center justify-between">
                <div className="flex items-center gap-1.5 text-xs text-gray-400">
                  <MapPin className="w-4 h-4 text-purple-400" />
                  <span>{barber.distanceKm ? `${barber.distanceKm.toFixed(1)} km away` : 'Nearby'}</span>
                </div>

                <button
                  onClick={() => onSelectBarber(barber)}
                  className="px-4 py-2 rounded-xl bg-purple-600 hover:bg-purple-500 text-white text-xs font-bold transition-all shadow-md shadow-purple-600/20"
                >
                  Request Barber
                </button>
              </div>
            </div>
          ))}
        </div>

      </div>
    </section>
  );
};
