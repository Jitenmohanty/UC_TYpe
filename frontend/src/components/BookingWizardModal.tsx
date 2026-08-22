import React, { useState, useEffect, useRef } from 'react';
import type { ServiceItem, BarberProfile, Booking } from '../types';
import { bookingApi, barbersApi, servicesApi } from '../services/api';
import { fetchLiveCoordinates, getCachedCoordinates } from '../services/location';
import { X, AlertCircle, Sparkles, UserCheck, Scissors, Calendar, Clock, MapPin, Navigation, Phone, Home, Compass, Search } from 'lucide-react';

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
  services: initialServices,
  onBookingCreated,
}) => {
  const [step, setStep] = useState<1 | 2 | 3>(1);
  const [activeServices, setActiveServices] = useState<ServiceItem[]>(initialServices);

  // Live real-time coordinates
  const initialCoords = getCachedCoordinates();
  const [latitude, setLatitude] = useState<number>(initialCoords.latitude || 20.2961);
  const [longitude, setLongitude] = useState<number>(initialCoords.longitude || 85.8245);
  const [locationLoading, setLocationLoading] = useState<boolean>(false);
  const [locationDetected, setLocationDetected] = useState<boolean>(false);
  const [formattedAddress, setFormattedAddress] = useState<string>('');
  const [contactPhone, setContactPhone] = useState<string>('+91 ');
  const [houseNumber, setHouseNumber] = useState<string>('');
  const [landmark, setLandmark] = useState<string>('');
  const [city, setCity] = useState<string>('Rajkanika, Kendrapara');
  const [postalCode, setPostalCode] = useState<string>('754220');
  const [searchPlaceQuery, setSearchPlaceQuery] = useState<string>('');
  const [searchingPlace, setSearchingPlace] = useState<boolean>(false);
  const [addressDetails, setAddressDetails] = useState<{ city?: string; state?: string; country?: string }>({});

  const lastNearbyQueryRef = useRef<string>('');

  // Keep activeServices updated from prop or fetch if empty
  useEffect(() => {
    if (initialServices && initialServices.length > 0) {
      setActiveServices(initialServices);
    } else if (isOpen) {
      servicesApi.getAll().then((list) => {
        if (list && list.length > 0) setActiveServices(list);
      }).catch(() => {});
    }
  }, [initialServices, isOpen]);

  const handleSearchPlace = async (queryToSearch?: string) => {
    const query = queryToSearch || searchPlaceQuery;
    if (!query) return;
    setSearchingPlace(true);
    try {
      const { searchAddressCoords } = await import('../services/location');
      const res = await searchAddressCoords(query);
      if (res) {
        setLatitude(res.latitude);
        setLongitude(res.longitude);
        setFormattedAddress(res.formattedAddress);
        if (res.city) setCity(res.city);
        setLocationDetected(true);
      }
    } finally {
      setSearchingPlace(false);
    }
  };

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
      void resolveAddressFromCoords(coords.latitude, coords.longitude);
    } finally {
      setLocationLoading(false);
    }
  };

  const resolveAddressFromCoords = async (lat: number, lng: number) => {
    try {
      const { reverseGeocode } = await import('../services/location');
      const addr = await reverseGeocode(lat, lng);
      setFormattedAddress(addr.formattedAddress);
      if (addr.city) setCity(addr.city);
      setAddressDetails({
        city: addr.city,
        state: addr.state,
        country: addr.country,
      });
    } catch {
      // Keep default
    }
  };

  // Fetch live GPS once when the modal opens if not detected
  useEffect(() => {
    if (!isOpen) return;
    if (!locationDetected) {
      void requestLiveLocation();
    }
  }, [isOpen]);

  // Helper to match service by ID or fuzzy-match by name/category
  const findMatchingServiceId = (serviceObj: ServiceItem | null | undefined, list: ServiceItem[]): string => {
    if (serviceObj && isValidMongoId(serviceObj._id)) {
      return serviceObj._id;
    }
    if (serviceObj?.name && list.length > 0) {
      const matchByName = list.find((s) => s.name.trim().toLowerCase() === serviceObj.name.trim().toLowerCase() && isValidMongoId(s._id));
      if (matchByName) return matchByName._id;
    }
    if (serviceObj?.categoryId && list.length > 0) {
      const matchByCat = list.find((s) => s.categoryId === serviceObj.categoryId && isValidMongoId(s._id));
      if (matchByCat) return matchByCat._id;
    }
    return list.find((s) => isValidMongoId(s._id))?._id || '';
  };

  // Initialize service & barber state on open/props change
  useEffect(() => {
    if (!isOpen) return;

    // Pick valid service dynamically
    const validService = findMatchingServiceId(selectedService, activeServices);
    if (validService) {
      setServiceId(validService);
    }

    // Pick valid barber if provided
    if (selectedBarber && isValidMongoId(selectedBarber._id)) {
      setPreferredBarberId(selectedBarber._id);
      setBarberPreference('SPECIFIC');
    } else {
      setPreferredBarberId('');
      setBarberPreference('ANY');
    }

    // Fetch nearby barbers list with query deduplication
    const queryKey = `${latitude.toFixed(4)},${longitude.toFixed(4)}`;
    if (lastNearbyQueryRef.current !== queryKey) {
      lastNearbyQueryRef.current = queryKey;
      barbersApi.getNearby({ latitude, longitude, radiusKm: 10 })
        .then((list) => {
          const validList = list.filter((b) => isValidMongoId(b._id));
          setAvailableBarbers(validList);
        })
        .catch(() => {});
    }
  }, [isOpen, selectedService, selectedBarber, activeServices, latitude, longitude]);

  // Every hook must run on every render, so this early return has to sit BELOW
  // them all. It previously sat at the top of the component, which meant the
  // hook count jumped 0 → 15 the moment the modal opened and React threw
  // "Rendered more hooks than during the previous render".
  if (!isOpen) return null;

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

    // Validate serviceId — dynamically resolve against backend activeServices list
    const finalServiceId = isValidMongoId(serviceId)
      ? serviceId
      : findMatchingServiceId(selectedService, activeServices);

    if (!finalServiceId) {
      setSearching(false);
      setLoading(false);
      setError('Please pick a service before confirming.');
      setStep(1);
      return;
    }

    // Validate preferredBarberId
    const validBarberId = isValidMongoId(preferredBarberId) ? preferredBarberId : undefined;

    // Enforce Zod rule: preferredBarberId required IF barberPreference === 'SPECIFIC'
    const finalPreference: 'ANY' | 'SPECIFIC' = (barberPreference === 'SPECIFIC' && validBarberId) ? 'SPECIFIC' : 'ANY';

    // Build comprehensive formatted address
    const constructedAddress = [
      houseNumber,
      landmark,
      formattedAddress || city,
      postalCode ? `PIN: ${postalCode}` : '',
    ]
      .filter(Boolean)
      .join(', ');

    const finalFormattedAddress = constructedAddress || formattedAddress || 'Doorstep Service Address';

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
      addressSnapshot: {
        formattedAddress: finalFormattedAddress,
        houseNumber: houseNumber || '',
        landmark: landmark || '',
        postalCode: postalCode || '',
        contactPhone: contactPhone || '',
        city: city || addressDetails.city || 'Bhubaneswar',
        state: addressDetails.state || 'Odisha',
        country: addressDetails.country || 'India',
      },
    };

    try {
      const newBooking = await bookingApi.create(payload);

      setTimeout(() => {
        setSearching(false);
        setLoading(false);
        onBookingCreated(newBooking);
      }, 1500);
    } catch (err: any) {
      setSearching(false);
      setLoading(false);
      const errMsg =
        err?.response?.data?.error?.message ||
        err?.response?.data?.message ||
        'Failed to create booking. Please check details and try again.';
      setError(errMsg);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/85 backdrop-blur-xl animate-fade-in">
      <div className="glass-card rounded-3xl w-full max-w-xl border-white/20 overflow-hidden shadow-2xl relative max-h-[92vh] flex flex-col">
        
        {/* Header */}
        <div className="px-6 py-4 border-b border-white/10 flex items-center justify-between bg-obsidian-900/80">
          <div className="flex items-center gap-2">
            <Sparkles className="w-5 h-5 text-amber-400" />
            <h3 className="text-lg font-bold font-outfit text-white">
              {searching ? 'Dispatching Your Booking...' : 'Doorstep Service & Address Details'}
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
            <div className="relative w-28 h-28 mx-auto flex items-center justify-center">
              <div className="absolute inset-0 rounded-full border-4 border-purple-500/20 border-t-purple-500 animate-spin"></div>
              <Compass className="w-12 h-12 text-amber-400 animate-pulse" />
            </div>
            <div>
              <h4 className="text-lg font-bold text-white">Connecting With Assigned Barber</h4>
              <p className="text-xs text-gray-400 max-w-sm mx-auto mt-1">
                Your GPS doorstep coordinates & contact details have been safely registered and sent.
              </p>
            </div>
          </div>
        ) : (
          <div className="p-6 overflow-y-auto space-y-6 flex-1">
            
            {/* Step Indicators */}
            <div className="grid grid-cols-3 gap-2">
              {[
                { s: 1, title: 'Service & Barber' },
                { s: 2, title: 'Date & Time' },
                { s: 3, title: 'Address & GPS' },
              ].map((item) => (
                <div
                  key={item.s}
                  onClick={() => setStep(item.s as any)}
                  className={`p-2.5 rounded-xl border text-center cursor-pointer transition-all ${
                    step === item.s
                      ? 'bg-purple-600/20 border-purple-500 text-purple-300 shadow-md font-bold'
                      : 'bg-obsidian-800/40 border-white/5 text-gray-500 hover:text-gray-300'
                  }`}
                >
                  <span className="text-[10px] block font-mono">Step {item.s}</span>
                  <span className="text-xs truncate block">{item.title}</span>
                </div>
              ))}
            </div>

            {error && (
              <div className="p-3.5 rounded-xl bg-red-500/10 border border-red-500/30 text-red-300 text-xs flex items-center gap-2">
                <AlertCircle className="w-4 h-4 flex-shrink-0" />
                <span>{error}</span>
              </div>
            )}

            {/* Step 1: Select Service & Barber */}
            {step === 1 && (
              <div className="space-y-4">
                <div>
                  <label className="block text-xs font-bold text-gray-300 uppercase tracking-wider mb-2 flex items-center gap-1.5">
                    <Scissors className="w-4 h-4 text-purple-400" />
                    Select Service
                  </label>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 max-h-48 overflow-y-auto pr-1">
                    {services.map((srv) => (
                      <div
                        key={srv._id}
                        onClick={() => setServiceId(srv._id)}
                        className={`p-3 rounded-2xl border cursor-pointer transition-all flex items-center justify-between ${
                          serviceId === srv._id
                            ? 'bg-purple-600/20 border-purple-500 text-white shadow-lg shadow-purple-500/10'
                            : 'bg-obsidian-800/60 border-white/5 text-gray-300 hover:bg-obsidian-800'
                        }`}
                      >
                        <div className="min-w-0 pr-2">
                          <h4 className="font-bold text-xs truncate">{srv.name}</h4>
                          <span className="text-[10px] text-gray-400">{srv.durationMinutes} mins</span>
                        </div>
                        <span className="text-amber-400 font-extrabold text-xs">₹{srv.price}</span>
                      </div>
                    ))}
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-bold text-gray-300 uppercase tracking-wider mb-2 flex items-center gap-1.5">
                    <UserCheck className="w-4 h-4 text-purple-400" />
                    Preferred Partner Barber
                  </label>
                  <div className="space-y-2">
                    <div
                      onClick={() => {
                        setBarberPreference('ANY');
                        setPreferredBarberId('');
                      }}
                      className={`p-3 rounded-2xl border cursor-pointer transition-all flex items-center justify-between ${
                        barberPreference === 'ANY'
                          ? 'bg-purple-600/20 border-purple-500 text-white shadow-md'
                          : 'bg-obsidian-800/60 border-white/5 text-gray-400 hover:text-gray-200'
                      }`}
                    >
                      <div className="flex items-center gap-2.5">
                        <Sparkles className="w-4 h-4 text-amber-400" />
                        <div>
                          <span className="text-xs font-bold block text-white">Assign via Salon Admin</span>
                          <span className="text-[10px] text-gray-400">Admin reviews and assigns available partner</span>
                        </div>
                      </div>
                    </div>

                    {availableBarbers.map((b) => (
                      <div
                        key={b._id}
                        onClick={() => {
                          setBarberPreference('SPECIFIC');
                          setPreferredBarberId(b._id);
                        }}
                        className={`p-3 rounded-2xl border cursor-pointer transition-all flex items-center justify-between ${
                          barberPreference === 'SPECIFIC' && preferredBarberId === b._id
                            ? 'bg-purple-600/20 border-purple-500 text-white shadow-md'
                            : 'bg-obsidian-800/60 border-white/5 text-gray-300 hover:bg-obsidian-800'
                        }`}
                      >
                        <div className="flex items-center gap-2.5">
                          <div className="w-8 h-8 rounded-xl gradient-purple flex items-center justify-center text-white text-xs font-bold">
                            {b.user?.name?.charAt(0) || 'B'}
                          </div>
                          <div>
                            <span className="text-xs font-bold block text-white">{b.user?.name || 'Partner Barber'}</span>
                            <span className="text-[10px] text-gray-400">
                              {b.rating || 4.8}★ • {b.totalCompletedJobs || 0} completed
                            </span>
                          </div>
                        </div>
                        {b.distanceKm !== undefined && (
                          <span className="text-[10px] font-mono text-purple-300">{b.distanceKm.toFixed(1)} km away</span>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            )}

            {/* Step 2: Date & Time */}
            {step === 2 && (
              <div className="space-y-4">
                <div>
                  <label className="block text-xs font-bold text-gray-300 uppercase tracking-wider mb-1 flex items-center gap-1.5">
                    <Calendar className="w-4 h-4 text-purple-400" />
                    Appointment Date
                  </label>
                  <input
                    type="date"
                    required
                    value={scheduledDate}
                    onChange={(e) => setScheduledDate(e.target.value)}
                    className="w-full glass-input px-4 py-3 rounded-2xl text-xs text-white"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-gray-300 uppercase tracking-wider mb-1 flex items-center gap-1.5">
                    <Clock className="w-4 h-4 text-purple-400" />
                    Service Start Time
                  </label>
                  <input
                    type="time"
                    required
                    value={startTime}
                    onChange={(e) => setStartTime(e.target.value)}
                    className="w-full glass-input px-4 py-3 rounded-2xl text-xs text-white"
                  />
                </div>
              </div>
            )}

            {/* Step 3: Location & Complete Doorstep Address */}
            {step === 3 && (
              <div className="space-y-4">
                
                {/* Contact Phone */}
                <div>
                  <label className="block text-[11px] font-bold text-gray-300 uppercase tracking-wider mb-1 flex items-center gap-1.5">
                    <Phone className="w-3.5 h-3.5 text-amber-400" />
                    Contact Mobile Number (For Barber Communication)
                  </label>
                  <input
                    type="tel"
                    required
                    placeholder="+91 98765 43210"
                    value={contactPhone}
                    onChange={(e) => setContactPhone(e.target.value)}
                    className="w-full glass-input px-4 py-2.5 rounded-2xl text-xs text-white font-medium placeholder-gray-500"
                  />
                </div>

                {/* Structured Doorstep Address Inputs */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="block text-[10px] font-bold text-gray-400 uppercase tracking-wider mb-1 flex items-center gap-1">
                      <Home className="w-3 h-3 text-purple-400" />
                      Flat / House / Door No. & Apartment
                    </label>
                    <input
                      type="text"
                      placeholder="e.g. Flat 402, Royal Palms"
                      value={houseNumber}
                      onChange={(e) => setHouseNumber(e.target.value)}
                      className="w-full glass-input px-3.5 py-2.5 rounded-2xl text-xs text-white placeholder-gray-500"
                    />
                  </div>

                  <div>
                    <label className="block text-[10px] font-bold text-gray-400 uppercase tracking-wider mb-1">
                      Street / Landmark / Area
                    </label>
                    <input
                      type="text"
                      placeholder="e.g. Near Infocity, Patia"
                      value={landmark}
                      onChange={(e) => setLandmark(e.target.value)}
                      className="w-full glass-input px-3.5 py-2.5 rounded-2xl text-xs text-white placeholder-gray-500"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-[10px] font-bold text-gray-400 uppercase tracking-wider mb-1">
                      City
                    </label>
                    <input
                      type="text"
                      placeholder="Bhubaneswar"
                      value={city}
                      onChange={(e) => setCity(e.target.value)}
                      className="w-full glass-input px-3.5 py-2.5 rounded-2xl text-xs text-white placeholder-gray-500"
                    />
                  </div>

                  <div>
                    <label className="block text-[10px] font-bold text-gray-400 uppercase tracking-wider mb-1">
                      PIN / Postal Code
                    </label>
                    <input
                      type="text"
                      placeholder="751024"
                      value={postalCode}
                      onChange={(e) => setPostalCode(e.target.value)}
                      className="w-full glass-input px-3.5 py-2.5 rounded-2xl text-xs text-white placeholder-gray-500"
                    />
                  </div>
                </div>

                {/* Search & Location Presets */}
                <div>
                  <label className="block text-[10px] font-bold text-gray-400 uppercase tracking-wider mb-1 flex items-center justify-between">
                    <span className="flex items-center gap-1">
                      <Search className="w-3 h-3 text-purple-400" />
                      Search City / Town / Village / Landmark
                    </span>
                    <span className="text-[10px] text-purple-300 font-normal">Fast GPS Locator</span>
                  </label>
                  <div className="flex items-center gap-2">
                    <input
                      type="text"
                      placeholder="e.g. Rajkanika, Kendrapara or Patia, Bhubaneswar"
                      value={searchPlaceQuery}
                      onChange={(e) => setSearchPlaceQuery(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') {
                          e.preventDefault();
                          void handleSearchPlace();
                        }
                      }}
                      className="flex-1 glass-input px-3.5 py-2 rounded-2xl text-xs text-white placeholder-gray-500"
                    />
                    <button
                      type="button"
                      onClick={() => void handleSearchPlace()}
                      disabled={searchingPlace}
                      className="px-4 py-2 rounded-2xl bg-purple-600 hover:bg-purple-500 text-white text-xs font-bold transition-all flex items-center gap-1 shrink-0"
                    >
                      {searchingPlace ? 'Locating...' : 'Set GPS'}
                    </button>
                  </div>

                  {/* Quick Preset Location Chips */}
                  <div className="flex flex-wrap items-center gap-1.5 mt-2">
                    <span className="text-[10px] text-gray-400 font-medium">Quick Pick:</span>
                    {[
                      { name: '📍 Rajkanika, Kendrapara', q: 'Rajkanika, Kendrapara, Odisha', pin: '754220' },
                      { name: '📍 Kendrapara Town', q: 'Kendrapara, Odisha', pin: '754211' },
                      { name: '📍 Bhubaneswar', q: 'Bhubaneswar, Odisha', pin: '751024' },
                      { name: '📍 Cuttack', q: 'Cuttack, Odisha', pin: '753001' },
                    ].map((chip) => (
                      <button
                        key={chip.name}
                        type="button"
                        onClick={() => {
                          setSearchPlaceQuery(chip.q);
                          setCity(chip.name.replace('📍 ', ''));
                          setPostalCode(chip.pin);
                          void handleSearchPlace(chip.q);
                        }}
                        className="text-[10px] px-2.5 py-1 rounded-xl bg-obsidian-800 hover:bg-purple-900/40 border border-white/10 hover:border-purple-500/40 text-gray-300 hover:text-white transition-all"
                      >
                        {chip.name}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Auto-detected GPS Coordinates & Reverse Geocoded Preview */}
                <div className="pt-2 border-t border-white/10 space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-[10px] text-gray-400 font-bold uppercase tracking-wider flex items-center gap-1">
                      <MapPin className="w-3 h-3 text-purple-400" />
                      Live GPS Sync
                    </span>
                    <button
                      type="button"
                      onClick={requestLiveLocation}
                      disabled={locationLoading}
                      className="text-[10px] text-purple-300 hover:text-white bg-purple-600/30 hover:bg-purple-600/50 px-2.5 py-1 rounded-xl border border-purple-500/40 flex items-center gap-1 transition-all"
                    >
                      <Navigation className={`w-3 h-3 text-purple-400 ${locationLoading ? 'animate-spin' : ''}`} />
                      {locationLoading ? 'Detecting Device GPS...' : 'Detect Device GPS'}
                    </button>
                  </div>

                  <div className="p-3 rounded-2xl bg-black/30 border border-white/5 text-[11px] text-gray-300 space-y-1">
                    <div className="flex items-center justify-between text-gray-400 text-[10px]">
                      <span>Coordinates: {latitude?.toFixed(4)}, {longitude?.toFixed(4)}</span>
                      <span className="text-emerald-400 font-mono">
                        {locationDetected ? '✅ Location Pinned' : '📍 Ready'}
                      </span>
                    </div>
                    {formattedAddress && (
                      <p className="text-gray-300 line-clamp-2 mt-0.5">{formattedAddress}</p>
                    )}
                  </div>
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
