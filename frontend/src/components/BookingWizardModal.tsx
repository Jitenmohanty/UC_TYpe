import React, { useState, useEffect } from 'react';
import type { ServiceItem, BarberProfile, Booking } from '../types';
import { bookingApi, barbersApi } from '../services/api';
import { fetchLiveCoordinates, getCachedCoordinates } from '../services/location';
import { X, AlertCircle, Sparkles, UserCheck, Scissors, Calendar, Clock, MapPin, Navigation, CheckCircle2 } from 'lucide-react';

interface BookingWizardModalProps {
  isOpen: boolean;
  onClose: () => void;
  selectedService?: ServiceItem | null;
  selectedBarber?: BarberProfile | null;
  services: ServiceItem[];
  onBookingCreated: (booking: Booking) => void;
}

const isValidMongoId = (id?: string | null): id is string => {
  return typeof id === 'string' && /^[0-9a-fA-F]{24}$/.test(id);
};

export const BookingWizardModal: React.FC<BookingWizardModalProps> = ({
  isOpen,
  onClose,
  selectedService,
  selectedBarber,
  services,
  onBookingCreated,
}) => {
  if (!isOpen) return null;

  const [step, setStep] = useState<1 | 2 | 3>(1);

  // Live real-time coordinates
  const initialCoords = getCachedCoordinates();
  const [latitude, setLatitude] = useState<number>(initialCoords.latitude);
  const [longitude, setLongitude] = useState<number>(initialCoords.longitude);
  const [locationLoading, setLocationLoading] = useState<boolean>(false);
  const [locationDetected, setLocationDetected] = useState<boolean>(false);

  const [availableBarbers, setAvailableBarbers] = useState<BarberProfile[]>([]);
  const [serviceId, setServiceId] = useState<string>('');
  const [preferredBarberId, setPreferredBarberId] = useState<string>('');
  const [barberPreference, setBarberPreference] = useState<'ANY' | 'SPECIFIC'>('ANY');

  const [scheduledDate, setScheduledDate] = useState<string>(
    new Date().toISOString().split('T')[0] || '2026-10-20'
  );
  const [startTime, setStartTime] = useState<string>('14:00');

  const [loading, setLoading] = useState<boolean>(false);
  const [searching, setSearching] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);

  const requestLiveLocation = async () => {
    setLocationLoading(true);
    try {
      const coords = await fetchLiveCoordinates(true);
      setLatitude(coords.latitude);
      setLongitude(coords.longitude);
      setLocationDetected(true);
    } finally {
      setLocationLoading(false);
    }
  };

  // Automatically fetch live GPS coordinates when opening the modal or stepping to location
  useEffect(() => {
    void requestLiveLocation();
  }, [isOpen]);

  useEffect(() => {
    if (step === 3 && !locationDetected) {
      void requestLiveLocation();
    }
  }, [step]);

  // Initialize service & barber state on open/props change
  useEffect(() => {
    // Pick valid service
    const validService = selectedService && isValidMongoId(selectedService._id)
      ? selectedService._id
      : services.find((s) => isValidMongoId(s._id))?._id || '';
    setServiceId(validService);

    // Pick valid barber if provided
    if (selectedBarber && isValidMongoId(selectedBarber._id)) {
      setPreferredBarberId(selectedBarber._id);
      setBarberPreference('SPECIFIC');
    } else {
      setPreferredBarberId('');
      setBarberPreference('ANY');
    }

    // Fetch nearby barbers list based on live location
    barbersApi.getNearby({ latitude, longitude, radiusKm: 10 })
      .then((list) => {
        const validList = list.filter((b) => isValidMongoId(b._id));
        setAvailableBarbers(validList);
        if (validList.length > 0 && !selectedBarber) {
          setPreferredBarberId(validList[0]!._id);
        }
      })
      .catch(() => {});
  }, [isOpen, selectedService, selectedBarber, services, latitude, longitude]);

  const handleBookingSubmit = async () => {
    setLoading(true);
    setSearching(true);
    setError(null);

    // Request freshest live GPS coordinate right before booking submission
    let finalLat = latitude;
    let finalLng = longitude;
    try {
      const freshCoords = await fetchLiveCoordinates(true);
      finalLat = freshCoords.latitude;
      finalLng = freshCoords.longitude;
      setLatitude(finalLat);
      setLongitude(finalLng);
    } catch {
      // Fallback to currently selected coordinates
    }

    // Validate serviceId
    const finalServiceId = isValidMongoId(serviceId)
      ? serviceId
      : services.find((s) => isValidMongoId(s._id))?._id || '6a8481e6197f75be106a931e';

    // Validate preferredBarberId
    const validBarberId = isValidMongoId(preferredBarberId) ? preferredBarberId : undefined;

    // Enforce Zod rule: preferredBarberId required IF barberPreference === 'SPECIFIC'
    const finalPreference: 'ANY' | 'SPECIFIC' = (barberPreference === 'SPECIFIC' && validBarberId) ? 'SPECIFIC' : 'ANY';

    const payload = {
      serviceId: finalServiceId,
      scheduledDate,
      startTime,
      timezone: 'UTC',
      barberPreference: finalPreference,
      ...(finalPreference === 'SPECIFIC' && validBarberId ? { preferredBarberId: validBarberId } : {}),
      customerLocation: {
        latitude: Number(finalLat),
        longitude: Number(finalLng),
      },
    };

    try {
      const newBooking = await bookingApi.create(payload);

      setTimeout(() => {
        setSearching(false);
        setLoading(false);
        onBookingCreated(newBooking);
      }, 2500);
    } catch (err: any) {
      setSearching(false);
      setLoading(false);
      const errMsg =
        err?.response?.data?.error?.message ||
        err?.response?.data?.message ||
        'Failed to submit booking. Please sign in to place a booking.';
      setError(errMsg);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/85 backdrop-blur-xl animate-fade-in">
      <div className="glass-card rounded-3xl w-full max-w-xl border-white/20 overflow-hidden shadow-2xl relative">
        
        {/* Header */}
        <div className="px-6 py-4 border-b border-white/10 flex items-center justify-between bg-obsidian-900/80">
          <div className="flex items-center gap-2">
            <Sparkles className="w-5 h-5 text-amber-400" />
            <h3 className="text-lg font-bold font-outfit text-white">
              {searching ? 'Finding Available Barber...' : 'Book Your Appointment'}
            </h3>
          </div>
          {!searching && (
            <button
              onClick={onClose}
              className="p-1.5 rounded-full hover:bg-white/10 text-gray-400 hover:text-white transition-colors"
            >
              <X className="w-5 h-5" />
            </button>
          )}
        </div>

        {searching ? (
          <div className="p-12 text-center space-y-6">
            <div className="relative w-32 h-32 mx-auto flex items-center justify-center">
              <div className="absolute inset-0 rounded-full border-2 border-purple-500/30 animate-radar-ping"></div>
              <div className="absolute inset-2 rounded-full border-2 border-amber-500/30 animate-radar-ping [animation-delay:0.5s]"></div>
              <div className="w-20 h-20 rounded-full gradient-purple flex items-center justify-center text-white shadow-xl shadow-purple-500/40 animate-pulse">
                <Scissors className="w-10 h-10" />
              </div>
            </div>

            <div className="space-y-2">
              <h4 className="text-xl font-bold font-outfit text-white">Confirming Your Booking...</h4>
              <p className="text-xs text-gray-400 max-w-sm mx-auto">
                Connecting you with verified professional barbers in your area.
              </p>
            </div>
          </div>
        ) : (
          <div className="p-6 space-y-6">
            
            {error && (
              <div className="p-3.5 rounded-2xl bg-red-500/10 border border-red-500/30 text-red-300 text-xs flex items-center gap-2 animate-pulse">
                <AlertCircle className="w-4 h-4 shrink-0 text-red-400" />
                <span>{error}</span>
              </div>
            )}

            {/* Step Wizard Progress Bar */}
            <div className="flex items-center justify-between text-xs font-bold text-gray-400 border-b border-white/10 pb-4">
              <span className={step >= 1 ? 'text-purple-400 flex items-center gap-1' : ''}>
                <Scissors className="w-3.5 h-3.5" /> 1. Service & Barber
              </span>
              <span className={step >= 2 ? 'text-purple-400 flex items-center gap-1' : ''}>
                <Calendar className="w-3.5 h-3.5" /> 2. Date & Time
              </span>
              <span className={step >= 3 ? 'text-purple-400 flex items-center gap-1' : ''}>
                <MapPin className="w-3.5 h-3.5" /> 3. Service Location
              </span>
            </div>

            {/* Step 1: Service & Preference */}
            {step === 1 && (
              <div className="space-y-4">
                <div>
                  <label className="block text-xs font-bold text-gray-300 uppercase tracking-wider mb-2">
                    Select Grooming Service
                  </label>
                  <select
                    value={serviceId}
                    onChange={(e) => setServiceId(e.target.value)}
                    className="w-full glass-input px-4 py-3 rounded-2xl text-xs text-white"
                  >
                    {services.map((s) => (
                      <option key={s._id} value={s._id} className="bg-obsidian-900 text-white">
                        {s.name} (₹{s.price} • {s.durationMinutes}m)
                      </option>
                    ))}
                    {services.length === 0 && (
                      <option value="6a8481e6197f75be106a931e" className="bg-obsidian-900 text-white">
                        Executive Haircut & Styling (₹499 • 45m)
                      </option>
                    )}
                  </select>
                </div>

                <label className="block text-xs font-bold text-gray-300 uppercase tracking-wider pt-2">
                  Barber Preference
                </label>
                <div className="grid grid-cols-2 gap-3">
                  <button
                    type="button"
                    onClick={() => setBarberPreference('ANY')}
                    className={`p-3.5 rounded-2xl border text-xs font-bold flex items-center justify-center gap-2 transition-all ${
                      barberPreference === 'ANY'
                        ? 'bg-purple-600/20 border-purple-500 text-purple-300 shadow-md'
                        : 'bg-obsidian-800/50 border-white/10 text-gray-400 hover:text-white'
                    }`}
                  >
                    <UserCheck className="w-4 h-4 text-purple-400" />
                    Any Available Barber (Fastest)
                  </button>

                  <button
                    type="button"
                    onClick={() => setBarberPreference('SPECIFIC')}
                    className={`p-3.5 rounded-2xl border text-xs font-bold flex items-center justify-center gap-2 transition-all ${
                      barberPreference === 'SPECIFIC'
                        ? 'bg-amber-500/20 border-amber-500 text-amber-300 shadow-md'
                        : 'bg-obsidian-800/50 border-white/10 text-gray-400 hover:text-white'
                    }`}
                  >
                    <Scissors className="w-4 h-4 text-amber-400" />
                    Choose Specific Barber
                  </button>
                </div>

                {barberPreference === 'SPECIFIC' && (
                  <div className="pt-2 animate-fade-in">
                    <label className="block text-xs font-bold text-amber-400 uppercase tracking-wider mb-2">
                      Select Preferred Barber
                    </label>
                    <select
                      value={preferredBarberId}
                      onChange={(e) => setPreferredBarberId(e.target.value)}
                      className="w-full glass-input px-4 py-3 rounded-2xl text-xs text-white border-amber-500/40"
                    >
                      {availableBarbers.map((b) => (
                        <option key={b._id} value={b._id} className="bg-obsidian-900 text-white">
                          {b.user?.name || 'Barber Pro'} ({b.rating} ★ • {b.experienceYears}y exp)
                        </option>
                      ))}
                      {availableBarbers.length === 0 && (
                        <option value="6a8481e6197f75be106a932a" className="bg-obsidian-900 text-white">
                          Amit Kumar (4.4 ★ • ~1.2 km away)
                        </option>
                      )}
                    </select>
                  </div>
                )}
              </div>
            )}

            {/* Step 2: Date & Time */}
            {step === 2 && (
              <div className="space-y-4">
                <div>
                  <label className="block text-xs font-bold text-gray-300 uppercase tracking-wider mb-2 flex items-center gap-1.5">
                    <Calendar className="w-4 h-4 text-purple-400" />
                    Select Appointment Date
                  </label>
                  <input
                    type="date"
                    value={scheduledDate}
                    onChange={(e) => setScheduledDate(e.target.value)}
                    className="w-full glass-input px-4 py-3 rounded-2xl text-xs text-white"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-gray-300 uppercase tracking-wider mb-2 flex items-center gap-1.5">
                    <Clock className="w-4 h-4 text-purple-400" />
                    Select Start Time
                  </label>
                  <input
                    type="time"
                    value={startTime}
                    onChange={(e) => setStartTime(e.target.value)}
                    className="w-full glass-input px-4 py-3 rounded-2xl text-xs text-white"
                  />
                </div>
              </div>
            )}

            {/* Step 3: Location */}
            {step === 3 && (
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <label className="block text-xs font-bold text-gray-300 uppercase tracking-wider flex items-center gap-1.5">
                    <MapPin className="w-4 h-4 text-purple-400" />
                    Service Delivery Location Coordinates
                  </label>
                  <button
                    type="button"
                    onClick={requestLiveLocation}
                    disabled={locationLoading}
                    className="text-[11px] text-purple-300 hover:text-white bg-purple-600/30 hover:bg-purple-600/50 px-3 py-1.5 rounded-xl border border-purple-500/40 flex items-center gap-1.5 transition-all shadow-sm"
                  >
                    <Navigation className={`w-3.5 h-3.5 text-purple-400 ${locationLoading ? 'animate-spin' : ''}`} />
                    {locationLoading ? 'Detecting GPS...' : 'Detect Live GPS'}
                  </button>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <span className="text-[10px] text-gray-400 block mb-1">Latitude (Doorstep GPS)</span>
                    <input
                      type="number"
                      step="any"
                      required
                      value={latitude}
                      onChange={(e) => setLatitude(Number(e.target.value))}
                      className="w-full glass-input px-3 py-2.5 rounded-2xl text-xs text-white"
                    />
                  </div>
                  <div>
                    <span className="text-[10px] text-gray-400 block mb-1">Longitude (Doorstep GPS)</span>
                    <input
                      type="number"
                      step="any"
                      required
                      value={longitude}
                      onChange={(e) => setLongitude(Number(e.target.value))}
                      className="w-full glass-input px-3 py-2.5 rounded-2xl text-xs text-white"
                    />
                  </div>
                </div>

                <div className="p-3.5 rounded-2xl bg-purple-500/10 border border-purple-500/20 text-purple-200 text-xs flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
                    <span>Real-time GPS coordinates will be dispatched to your assigned barber.</span>
                  </div>
                  <span className="text-[10px] text-emerald-400 font-mono font-bold bg-emerald-500/10 px-2 py-0.5 rounded-lg border border-emerald-500/30">
                    Live GPS Sync
                  </span>
                </div>
              </div>
            )}

            {/* Step Navigation Controls */}
            <div className="pt-4 border-t border-white/10 flex items-center justify-between">
              {step > 1 ? (
                <button
                  type="button"
                  onClick={() => setStep((s) => (s - 1) as any)}
                  className="px-4 py-2.5 rounded-xl bg-obsidian-800 text-xs font-semibold text-gray-300 hover:text-white transition-colors"
                >
                  Back
                </button>
              ) : <div></div>}

              {step < 3 ? (
                <button
                  type="button"
                  onClick={() => setStep((s) => (s + 1) as any)}
                  className="px-6 py-2.5 rounded-xl bg-purple-600 hover:bg-purple-500 text-white text-xs font-bold transition-all shadow-md shadow-purple-600/20"
                >
                  Continue Step {step + 1}
                </button>
              ) : (
                <button
                  type="button"
                  disabled={loading}
                  onClick={handleBookingSubmit}
                  className="px-6 py-3 rounded-xl gradient-gold hover:opacity-95 text-black text-xs font-extrabold transition-all shadow-lg shadow-amber-500/25 flex items-center gap-2 hover:scale-105 active:scale-95"
                >
                  Confirm Appointment
                </button>
              )}
            </div>

          </div>
        )}

      </div>
    </div>
  );
};
