import { useState, useEffect } from 'react';
import { Navbar } from './components/Navbar';
import { Hero } from './components/Hero';
import { BentoFeatures } from './components/BentoFeatures';
import { HowItWorksFlow } from './components/HowItWorksFlow';
import { ServiceCatalog } from './components/ServiceCatalog';
import { NearbyBarbersRadar } from './components/NearbyBarbersRadar';
import { TestimonialsMarquee } from './components/TestimonialsMarquee';
import { FAQSection } from './components/FAQSection';
import { WisprFloatingBar } from './components/WisprFloatingBar';
import { BookingWizardModal } from './components/BookingWizardModal';
import { CustomerBookingsModal } from './components/CustomerBookingsModal';
import { BarberDashboard } from './components/BarberDashboard';
import { AdminDashboard } from './components/AdminDashboard';
import { AuthModal } from './components/AuthModal';
import { ServicesListModal } from './components/ServicesListModal';
import type { User, ServiceItem, BarberProfile, Booking } from './types';
import { authApi, servicesApi, bookingApi } from './services/api';
import { Sparkles, Calendar, KeyRound, Copy, CheckCircle2, Clock, ShieldCheck, RefreshCw } from 'lucide-react';

export function App() {
  const [user, setUser] = useState<User | null>(null);
  const [activeView, setActiveView] = useState<'customer' | 'barber' | 'admin'>('customer');
  const [services, setServices] = useState<ServiceItem[]>([]);
  const [activeBooking, setActiveBooking] = useState<Booking | null>(null);

  const [isAuthOpen, setIsAuthOpen] = useState(false);
  const [authPromptMessage, setAuthPromptMessage] = useState<string | null>(null);
  const [isBookingOpen, setIsBookingOpen] = useState(false);
  const [isHistoryOpen, setIsHistoryOpen] = useState(false);
  const [isServicesListOpen, setIsServicesListOpen] = useState(false);
  const [selectedService, setSelectedService] = useState<ServiceItem | null>(null);
  const [selectedBarber, setSelectedBarber] = useState<BarberProfile | null>(null);
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  // OTP display state (for customer)
  const [customerOtp, setCustomerOtp] = useState<string | null>(null);
  const [otpExpiresAt, setOtpExpiresAt] = useState<string | null>(null);
  const [otpCopied, setOtpCopied] = useState(false);
  const [otpTimeLeft, setOtpTimeLeft] = useState<number>(0);
  const [resendingSms, setResendingSms] = useState(false);

  // Listen for global auth:required 401 interception events
  useEffect(() => {
    const handleAuthRequired = (e: Event) => {
      const customEvt = e as CustomEvent<{ message?: string }>;
      setUser(null);
      setAuthPromptMessage(customEvt.detail?.message || 'Please sign in to continue.');
      setIsAuthOpen(true);
      setIsBookingOpen(false);
    };

    window.addEventListener('auth:required', handleAuthRequired);
    return () => window.removeEventListener('auth:required', handleAuthRequired);
  }, []);

  useEffect(() => {
    const token = localStorage.getItem('accessToken');
    if (token) {
      authApi.getMe()
        .then((u) => {
          setUser(u);
          if (u.role === 'ADMIN') {
            setActiveView('admin');
          }
        })
        .catch(() => localStorage.removeItem('accessToken'));
    }

    servicesApi.getAll().then(setServices).catch(() => {});
  }, []);

  // Poll for active booking and OTP for customer
  useEffect(() => {
    if (!user || user.role !== 'CUSTOMER') {
      setActiveBooking(null);
      setCustomerOtp(null);
      return;
    }

    const checkActiveBooking = async () => {
      try {
        const bookings = await bookingApi.getMyBookings();
        const active = bookings.find((b: Booking) => 
          ['PENDING', 'CONFIRMED', 'IN_PROGRESS', 'SEARCHING', 'BARBER_CANCELLED', 'ADMIN_CANCELLED'].includes(b.status)
        );
        setActiveBooking(active || null);

        // If active confirmed booking, fetch OTP details for customer
        if (active && (active.status === 'CONFIRMED' || active.status === 'IN_PROGRESS')) {
          try {
            const otpData = await bookingApi.getOtp(active._id);
            if (otpData?.otp) {
              setCustomerOtp(otpData.otp);
              setOtpExpiresAt(otpData.expiresAt);
            }
          } catch {
            // OTP might not be generated yet
          }
        } else {
          setCustomerOtp(null);
          setOtpExpiresAt(null);
        }
      } catch {
        // Silently handle
      }
    };

    checkActiveBooking();
    const interval = setInterval(checkActiveBooking, 5000);
    return () => clearInterval(interval);
  }, [user]);

  // Countdown timer for OTP expiry
  useEffect(() => {
    if (!otpExpiresAt) {
      setOtpTimeLeft(0);
      return;
    }

    const updateTimer = () => {
      const diff = Math.max(0, Math.floor((new Date(otpExpiresAt).getTime() - Date.now()) / 1000));
      setOtpTimeLeft(diff);
    };

    updateTimer();
    const timer = setInterval(updateTimer, 1000);
    return () => clearInterval(timer);
  }, [otpExpiresAt]);

  const handleCopyOtp = () => {
    if (customerOtp) {
      navigator.clipboard.writeText(customerOtp);
      setOtpCopied(true);
      setTimeout(() => setOtpCopied(false), 2000);
    }
  };

  const handleResendOtp = async () => {
    if (!activeBooking) return;
    setResendingSms(true);
    try {
      const res = await bookingApi.resendOtp(activeBooking._id);
      if (res?.otp) {
        setCustomerOtp(res.otp);
        setOtpExpiresAt(res.expiresAt);
      }
      setToastMessage('✅ New verification code sent via Twilio SMS');
      setTimeout(() => setToastMessage(null), 4000);
    } catch {
      setToastMessage('Failed to resend SMS. Please try again.');
      setTimeout(() => setToastMessage(null), 4000);
    } finally {
      setResendingSms(false);
    }
  };

  const handleLogout = () => {
    authApi.logout().catch(() => {});
    localStorage.removeItem('accessToken');
    setUser(null);
    setActiveView('customer');
    setActiveBooking(null);
    setCustomerOtp(null);
  };

  const handleAuthSuccess = (authUser: User, token: string) => {
    // Save token to localStorage so axios interceptor can attach it to API requests
    localStorage.setItem('accessToken', token);
    setUser(authUser);
    if (authUser.role === 'ADMIN') {
      setActiveView('admin');
    } else if (authUser.role === 'BARBER') {
      setActiveView('barber');
    }
  };

  const handleBookingCreated = (newBooking: Booking) => {
    setActiveBooking(newBooking);
    setIsBookingOpen(false);
    setToastMessage(`🎉 Appointment #${newBooking.bookingNumber} created successfully!`);
    setTimeout(() => setToastMessage(null), 4000);
  };

  const formatCountdown = (seconds: number) => {
    const m = Math.floor(seconds / 60);
    const s = seconds % 60;
    return `${m}:${s < 10 ? '0' : ''}${s}`;
  };

  return (
    <div className="min-h-screen bg-[#0b0c10] text-slate-100 flex flex-col selection:bg-[#ff6c4c] selection:text-white font-sans relative overflow-x-hidden pb-20">
      
      {/* Toast Notification */}
      {toastMessage && (
        <div className="fixed top-20 right-6 z-50 glass-card px-5 py-3.5 rounded-2xl border-[#ff6c4c]/40 text-[#ff8a6a] text-xs font-bold shadow-2xl flex items-center gap-2.5 animate-bounce-short">
          <Sparkles className="w-4 h-4 text-[#ff6c4c]" />
          <span>{toastMessage}</span>
        </div>
      )}

      <Navbar
        user={user}
        onOpenAuth={() => setIsAuthOpen(true)}
        onOpenBooking={() => {
          setSelectedService(null);
          setSelectedBarber(null);
          setIsBookingOpen(true);
        }}
        onOpenMyBookings={() => setIsHistoryOpen(true)}
        onOpenServices={() => setIsServicesListOpen(true)}
        onLogout={handleLogout}
        activeView={activeView}
        setActiveView={setActiveView}
      />

      <main className="flex-1">
        {activeView === 'admin' ? (
          <AdminDashboard user={user} />
        ) : activeView === 'barber' ? (
          <BarberDashboard user={user} />
        ) : (
          <>
            {activeBooking && (
              <div className="max-w-7xl mx-auto px-4 md:px-8 pt-6 space-y-4">
                {/* Active Booking Live Tracking Card */}
                <div className="glass-card p-5 rounded-3xl border-[#ff6c4c]/30 bg-gradient-to-r from-[#ff6c4c]/10 via-[#10131d] to-[#10131d] flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 shadow-xl">
                  <div className="flex items-center gap-3.5">
                    <div className="w-10 h-10 rounded-2xl gradient-flow text-white flex items-center justify-center font-extrabold shadow-md">
                      <Calendar className="w-5 h-5" />
                    </div>
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="text-xs font-extrabold text-white">Active Doorstep Booking</span>
                        <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-white/10 text-[#ff8a6a] font-bold">
                          #{activeBooking.bookingNumber}
                        </span>
                      </div>
                      <span className="text-[11px] text-gray-400 font-medium block mt-0.5">
                        Scheduled for {activeBooking.scheduledDate} at {activeBooking.startTime}
                      </span>
                    </div>
                  </div>

                  <div className="flex flex-wrap items-center gap-3">
                    <button
                      onClick={() => setIsHistoryOpen(true)}
                      className="text-xs text-[#ff6c4c] hover:text-[#ff8a6a] underline font-bold"
                    >
                      View All My Bookings
                    </button>
                    <span className={`px-3.5 py-1.5 rounded-full text-xs font-bold border ${
                      activeBooking.status === 'CONFIRMED'
                        ? 'bg-emerald-500/20 text-emerald-300 border-emerald-500/40'
                        : activeBooking.status === 'IN_PROGRESS'
                        ? 'bg-[#ff6c4c]/20 text-[#ff8a6a] border-[#ff6c4c]/40 animate-pulse'
                        : activeBooking.status === 'ADMIN_CANCELLED'
                        ? 'bg-rose-500/20 text-rose-300 border-rose-500/40'
                        : activeBooking.status === 'BARBER_CANCELLED' || activeBooking.status === 'SEARCHING'
                        ? 'bg-amber-500/20 text-amber-300 border-amber-500/40'
                        : 'bg-[#ff6c4c]/20 text-[#ff8a6a] border-[#ff6c4c]/30'
                    }`}>
                      {activeBooking.status === 'ADMIN_CANCELLED'
                        ? `Cancelled by Admin ${activeBooking.cancellationReason ? `(${activeBooking.cancellationReason})` : ''}`
                        : activeBooking.status === 'BARBER_CANCELLED'
                        ? 'Reallocating nearby partner...'
                        : activeBooking.status === 'SEARCHING'
                        ? 'Searching nearby barbers...'
                        : `Status: ${activeBooking.status}`}
                    </span>
                  </div>
                </div>

                {/* ─── OTP Display Card (Customer) ────────────────────────────────── */}
                {activeBooking.status === 'CONFIRMED' && customerOtp && (
                  <div className="glass-card p-6 sm:p-8 rounded-3xl border-[#ff6c4c]/40 bg-gradient-to-br from-[#ff6c4c]/15 via-[#10131d] to-[#10131d] shadow-2xl">
                    <div className="flex flex-col md:flex-row items-center gap-6">
                      {/* Icon + Header */}
                      <div className="flex flex-col items-center gap-3 flex-shrink-0">
                        <div className="w-16 h-16 rounded-2xl gradient-flow text-white flex items-center justify-center shadow-lg shadow-[#ff6c4c]/20">
                          <KeyRound className="w-8 h-8" />
                        </div>
                        <div className="flex items-center gap-1 text-[10px] text-[#ff8a6a] font-bold">
                          <ShieldCheck className="w-3.5 h-3.5 text-[#ff6c4c]" />
                          <span>Sterile Verification</span>
                        </div>
                      </div>

                      {/* OTP Display */}
                      <div className="flex-1 text-center md:text-left space-y-3">
                        <div>
                          <h3 className="text-base font-extrabold font-outfit text-white">Your Doorstep Service OTP</h3>
                          <p className="text-xs text-gray-400 mt-0.5">
                            Share this secure 6-digit code with your barber upon arrival to initiate your service
                          </p>
                        </div>

                        <div className="flex flex-wrap items-center justify-center md:justify-start gap-3">
                          {/* Large OTP Digits */}
                          <div className="flex gap-2">
                            {customerOtp.split('').map((digit, i) => (
                              <div
                                key={i}
                                className="w-10 h-12 rounded-xl bg-white/[0.06] border border-[#ff6c4c]/40 text-[#ff8a6a] font-extrabold text-xl font-mono flex items-center justify-center shadow-inner"
                              >
                                {digit}
                              </div>
                            ))}
                          </div>

                          {/* Copy Button */}
                          <button
                            onClick={handleCopyOtp}
                            className="flex items-center gap-1.5 px-4 py-2.5 rounded-xl bg-[#13151f] hover:bg-[#1b1f2e] border border-white/[0.08] text-xs font-bold text-gray-200 transition-all active:scale-95"
                          >
                            {otpCopied ? (
                              <>
                                <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                                <span className="text-emerald-400">Copied!</span>
                              </>
                            ) : (
                              <>
                                <Copy className="w-4 h-4 text-[#ff6c4c]" />
                                <span>Copy Code</span>
                              </>
                            )}
                          </button>

                          {/* Resend Twilio SMS Button */}
                          <button
                            onClick={handleResendOtp}
                            disabled={resendingSms}
                            className="flex items-center gap-1.5 px-4 py-2.5 rounded-xl gradient-flow text-white hover:opacity-95 text-xs font-extrabold transition-all shadow-md shadow-[#ff6c4c]/20 active:scale-95 disabled:opacity-50"
                          >
                            <RefreshCw className={`w-4 h-4 ${resendingSms ? 'animate-spin' : ''}`} />
                            <span>{resendingSms ? 'Sending SMS...' : 'Resend Twilio SMS'}</span>
                          </button>
                        </div>

                        {/* Twilio SMS Dispatch indicator */}
                        <div className="flex items-center justify-center md:justify-start gap-1.5 text-[11px] text-emerald-400 font-semibold pt-1">
                          <CheckCircle2 className="w-3.5 h-3.5" />
                          <span>Dispatched via <strong>Twilio SMS</strong> to your registered phone</span>
                        </div>

                        {/* Timer */}
                        {otpTimeLeft > 0 && (
                          <div className="flex items-center justify-center md:justify-start gap-1.5 text-xs text-gray-400">
                            <Clock className="w-3.5 h-3.5 text-[#ff6c4c]" />
                            <span>Expires in <span className="text-[#ff8a6a] font-extrabold">{formatCountdown(otpTimeLeft)}</span></span>
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* 1. Wispr Flow Editorial Hero */}
            <Hero
              onOpenBooking={() => {
                if (!user) {
                  setAuthPromptMessage('Please sign in or register to book your grooming appointment.');
                  setIsAuthOpen(true);
                  return;
                }
                setSelectedService(null);
                setSelectedBarber(null);
                setIsBookingOpen(true);
              }}
              onOpenServices={() => setIsServicesListOpen(true)}
            />

            {/* 2. Wispr Flow Bento Features Grid */}
            <BentoFeatures />

            {/* 3. Wispr Flow 3-Step Journey */}
            <HowItWorksFlow />

            {/* 4. Curated Service Catalog */}
            <ServiceCatalog
              services={services}
              onSelectService={(service) => {
                if (!user) {
                  setAuthPromptMessage(`Please sign in to book ${service.name}.`);
                  setIsAuthOpen(true);
                  return;
                }
                setSelectedService(service);
                setSelectedBarber(null);
                setIsBookingOpen(true);
              }}
            />

            {/* 5. Live Barber Radar */}
            <NearbyBarbersRadar
              onSelectBarber={(barber) => {
                if (!user) {
                  setAuthPromptMessage(`Please sign in to select and book with this partner barber.`);
                  setIsAuthOpen(true);
                  return;
                }
                setSelectedBarber(barber);
                setSelectedService(null);
                setIsBookingOpen(true);
              }}
            />

            {/* 6. Testimonials & Home Visits */}
            <TestimonialsMarquee />

            {/* 7. Frequently Asked Questions Accordion */}
            <FAQSection />

            {/* 8. Fixed Bottom Wispr Flow Dispatch Bar */}
            <WisprFloatingBar
              onOpenBooking={() => {
                if (!user) {
                  setAuthPromptMessage('Please sign in to book an appointment.');
                  setIsAuthOpen(true);
                  return;
                }
                setSelectedService(null);
                setSelectedBarber(null);
                setIsBookingOpen(true);
              }}
              onSelectService={(service) => {
                if (!user) {
                  setAuthPromptMessage(`Please sign in to book ${service.name}.`);
                  setIsAuthOpen(true);
                  return;
                }
                setSelectedService(service);
                setSelectedBarber(null);
                setIsBookingOpen(true);
              }}
              services={services}
            />
          </>
        )}
      </main>

      <BookingWizardModal
        isOpen={isBookingOpen}
        onClose={() => setIsBookingOpen(false)}
        selectedService={selectedService}
        selectedBarber={selectedBarber}
        services={services}
        onBookingCreated={handleBookingCreated}
      />

      <CustomerBookingsModal
        isOpen={isHistoryOpen}
        onClose={() => setIsHistoryOpen(false)}
        onSelectRebook={(serviceId) => {
          const s = services.find((srv) => srv._id === serviceId);
          if (s) {
            setSelectedService(s);
            setSelectedBarber(null);
            setIsBookingOpen(true);
          }
        }}
      />

      <AuthModal
        isOpen={isAuthOpen}
        onClose={() => {
          setIsAuthOpen(false);
          setAuthPromptMessage(null);
        }}
        onSuccess={handleAuthSuccess}
        initialMessage={authPromptMessage}
      />

      <ServicesListModal
        isOpen={isServicesListOpen}
        onClose={() => setIsServicesListOpen(false)}
        services={services}
        onSelectService={(service) => {
          if (!user) {
            setAuthPromptMessage(`Please sign in to book ${service.name}.`);
            setIsAuthOpen(true);
            return;
          }
          setSelectedService(service);
          setSelectedBarber(null);
          setIsBookingOpen(true);
        }}
        onNavigateToCatalogSection={() => {
          setActiveView('customer');
          setTimeout(() => {
            const el = document.getElementById('services');
            if (el) {
              el.scrollIntoView({ behavior: 'smooth' });
            }
          }, 60);
        }}
      />

      {/* Luxury Footer */}
      <footer className="py-16 border-t border-white/[0.08] bg-[#07080c] mt-auto text-xs text-gray-400">
        <div className="max-w-7xl mx-auto px-4 md:px-8 space-y-8">
          <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-6 pb-8 border-b border-white/[0.06]">
            <div>
              <div className="flex items-center gap-2">
                <span className="text-xl font-extrabold font-outfit text-white">AURA FLOW</span>
                <span className="text-[10px] font-extrabold px-2 py-0.5 rounded-full bg-[#ff6c4c]/15 text-[#ff8a6a] border border-[#ff6c4c]/30">
                  DOORSTEP SALON
                </span>
              </div>
              <p className="text-xs text-gray-400 mt-1">
                Luxury mobile barbering and grooming experiences delivered to your doorstep in Brahmapur & Bhubaneswar.
              </p>
            </div>

            <div className="flex flex-wrap items-center gap-4 text-xs font-semibold text-gray-300">
              <span className="flex items-center gap-1.5 text-emerald-400">
                <CheckCircle2 className="w-4 h-4" /> 100% Sanitized Toolkits
              </span>
              <span className="flex items-center gap-1.5 text-[#ff8a6a]">
                <ShieldCheck className="w-4 h-4 text-[#ff6c4c]" /> Background-Verified Pros
              </span>
            </div>
          </div>

          <div className="flex flex-col sm:flex-row items-center justify-between gap-4 text-[11px] text-gray-500">
            <div>
              © 2026 AURA Flow Technologies Inc. All rights reserved.
            </div>
            <div className="flex items-center gap-6">
              <a href="#" className="hover:text-[#ff6c4c] transition-colors">Privacy Policy</a>
              <a href="#" className="hover:text-[#ff6c4c] transition-colors">Terms of Service</a>
              <a href="#" className="hover:text-[#ff6c4c] transition-colors">Partner With Us</a>
            </div>
          </div>
        </div>
      </footer>

    </div>
  );
}

export default App;
