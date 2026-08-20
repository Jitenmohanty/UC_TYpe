import { useState, useEffect } from 'react';
import { Navbar } from './components/Navbar';
import { Hero } from './components/Hero';
import { ServiceCatalog } from './components/ServiceCatalog';
import { NearbyBarbersRadar } from './components/NearbyBarbersRadar';
import { BookingWizardModal } from './components/BookingWizardModal';
import { CustomerBookingsModal } from './components/CustomerBookingsModal';
import { BarberDashboard } from './components/BarberDashboard';
import { AdminDashboard } from './components/AdminDashboard';
import { AuthModal } from './components/AuthModal';
import type { User, ServiceItem, BarberProfile, Booking } from './types';
import { authApi, servicesApi, bookingApi } from './services/api';
import { Sparkles, Calendar, KeyRound, Copy, CheckCircle2, Clock, ShieldCheck, MessageSquare, RefreshCw } from 'lucide-react';

export function App() {
  const [user, setUser] = useState<User | null>(null);
  const [activeView, setActiveView] = useState<'customer' | 'barber' | 'admin'>('customer');
  const [services, setServices] = useState<ServiceItem[]>([]);
  const [activeBooking, setActiveBooking] = useState<Booking | null>(null);

  const [isAuthOpen, setIsAuthOpen] = useState(false);
  const [authPromptMessage, setAuthPromptMessage] = useState<string | null>(null);
  const [isBookingOpen, setIsBookingOpen] = useState(false);
  const [isHistoryOpen, setIsHistoryOpen] = useState(false);
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

    servicesApi.getAll()
      .then((sList) => setServices(sList))
      .catch(() => {});
  }, []);

  // Fetch OTP when active booking becomes CONFIRMED
  useEffect(() => {
    if (activeBooking?.status === 'CONFIRMED' && activeBooking._id) {
      bookingApi.getOtp(activeBooking._id)
        .then((data) => {
          setCustomerOtp(data.otp);
          setOtpExpiresAt(data.expiresAt);
        })
        .catch(() => {
          // OTP not available yet
        });
    } else {
      setCustomerOtp(null);
      setOtpExpiresAt(null);
    }
  }, [activeBooking?.status, activeBooking?._id]);

  // OTP countdown timer
  useEffect(() => {
    if (!otpExpiresAt) { setOtpTimeLeft(0); return; }
    const updateTimer = () => {
      const remaining = Math.max(0, Math.floor((new Date(otpExpiresAt).getTime() - Date.now()) / 1000));
      setOtpTimeLeft(remaining);
    };
    updateTimer();
    const interval = setInterval(updateTimer, 1000);
    return () => clearInterval(interval);
  }, [otpExpiresAt]);

  const handleCopyOtp = async () => {
    if (!customerOtp) return;
    try {
      await navigator.clipboard.writeText(customerOtp);
      setOtpCopied(true);
      setTimeout(() => setOtpCopied(false), 2000);
    } catch {
      // fallback
    }
  };

  const handleResendOtp = async () => {
    if (!activeBooking?._id || resendingSms) return;
    setResendingSms(true);
    try {
      const data = await bookingApi.resendOtp(activeBooking._id);
      setCustomerOtp(data.otp);
      setOtpExpiresAt(data.expiresAt);
      setToastMessage('📱 New OTP dispatched via Twilio SMS & updated in app!');
    } catch (err: any) {
      setToastMessage(err?.response?.data?.error?.message || 'Failed to resend SMS.');
    } finally {
      setResendingSms(false);
      setTimeout(() => setToastMessage(null), 4000);
    }
  };

  const handleAuthSuccess = (u: User, token: string) => {
    setUser(u);
    localStorage.setItem('accessToken', token);
    if (u.role === 'ADMIN') {
      setActiveView('admin');
    } else if (u.role === 'BARBER') {
      setActiveView('barber');
    } else {
      setActiveView('customer');
    }
    setToastMessage(`Welcome back, ${u.name}! Logged in as ${u.role}.`);
    setTimeout(() => setToastMessage(null), 4000);
  };

  const handleLogout = () => {
    authApi.logout().catch(() => {});
    setUser(null);
    localStorage.removeItem('accessToken');
    setActiveView('customer');
    setToastMessage('Logged out successfully.');
    setTimeout(() => setToastMessage(null), 3000);
  };

  const handleBookingCreated = (b: Booking) => {
    setActiveBooking(b);
    setIsBookingOpen(false);
    setToastMessage(`Booking #${b.bookingNumber} created & auto-allocated!`);
    setTimeout(() => setToastMessage(null), 5000);
  };

  const formatCountdown = (seconds: number) => {
    const m = Math.floor(seconds / 60);
    const s = seconds % 60;
    return `${m}:${s.toString().padStart(2, '0')}`;
  };

  return (
    <div className="min-h-screen bg-[#070709] text-gray-100 flex flex-col selection:bg-purple-600 selection:text-white">
      
      {toastMessage && (
        <div className="fixed top-20 right-6 z-50 glass-card px-5 py-3 rounded-2xl border-purple-500/40 text-purple-300 text-xs font-bold shadow-2xl flex items-center gap-2 animate-bounce-short">
          <Sparkles className="w-4 h-4 text-amber-400" />
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
                {/* Active Booking Status Bar */}
                <div className="glass-card p-4 rounded-2xl border-purple-500/30 bg-purple-950/20 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
                  <div className="flex items-center gap-3">
                    <Calendar className="w-5 h-5 text-purple-400" />
                    <div>
                      <span className="text-xs font-bold text-white block">Active Booking: #{activeBooking.bookingNumber}</span>
                      <span className="text-[10px] text-gray-400">Scheduled for {activeBooking.scheduledDate} at {activeBooking.startTime}</span>
                    </div>
                  </div>

                  <div className="flex items-center gap-3">
                    <button
                      onClick={() => setIsHistoryOpen(true)}
                      className="text-xs text-purple-300 hover:text-white underline font-medium"
                    >
                      View All My Bookings
                    </button>
                    <span className="px-3 py-1 rounded-full bg-purple-500/20 text-purple-300 text-xs font-bold border border-purple-500/30">
                      Status: {activeBooking.status}
                    </span>
                  </div>
                </div>

                {/* ─── OTP Display Card (Customer) ────────────────────────────────── */}
                {activeBooking.status === 'CONFIRMED' && customerOtp && (
                  <div className="glass-card p-6 rounded-2xl border-amber-500/30 bg-gradient-to-br from-amber-950/30 via-purple-950/20 to-obsidian-900">
                    <div className="flex flex-col md:flex-row items-center gap-6">
                      {/* Icon + Header */}
                      <div className="flex flex-col items-center gap-3 flex-shrink-0">
                        <div className="w-16 h-16 rounded-full bg-amber-500/20 border-2 border-amber-500/40 flex items-center justify-center">
                          <KeyRound className="w-8 h-8 text-amber-400" />
                        </div>
                        <div className="flex items-center gap-1 text-[10px] text-amber-300/70">
                          <ShieldCheck className="w-3 h-3" />
                          <span>Secure Verification</span>
                        </div>
                      </div>

                      {/* OTP Display */}
                      <div className="flex-1 text-center md:text-left space-y-3">
                        <div>
                          <h3 className="text-sm font-bold font-outfit text-white">Your Service Verification Code</h3>
                          <p className="text-[10px] text-gray-400 mt-0.5">
                            Share this code with your barber when they arrive to start the service
                          </p>
                        </div>

                        <div className="flex flex-wrap items-center justify-center md:justify-start gap-3">
                          {/* Large OTP Digits */}
                          <div className="flex gap-1.5">
                            {customerOtp.split('').map((digit, i) => (
                              <div
                                key={i}
                                className="w-11 h-14 rounded-xl bg-obsidian-800/80 border-2 border-amber-500/40 flex items-center justify-center text-2xl font-extrabold text-amber-300 shadow-lg shadow-amber-500/10"
                              >
                                {digit}
                              </div>
                            ))}
                          </div>

                          {/* Action Buttons */}
                          <div className="flex items-center gap-2">
                            {/* Copy Button */}
                            <button
                              onClick={handleCopyOtp}
                              className={`p-2.5 rounded-xl border transition-all ${
                                otpCopied
                                  ? 'bg-green-500/20 border-green-500/40 text-green-300'
                                  : 'bg-white/5 border-white/10 text-gray-400 hover:border-amber-500/40 hover:text-amber-300'
                              }`}
                              title="Copy OTP"
                            >
                              {otpCopied ? <CheckCircle2 className="w-5 h-5" /> : <Copy className="w-5 h-5" />}
                            </button>

                            {/* Resend via Twilio SMS Button */}
                            <button
                              onClick={handleResendOtp}
                              disabled={resendingSms}
                              className="px-3 py-2.5 rounded-xl bg-purple-500/10 border border-purple-500/30 text-purple-300 hover:bg-purple-500/20 text-xs font-semibold flex items-center gap-1.5 transition-all"
                              title="Resend OTP via Twilio SMS"
                            >
                              <RefreshCw className={`w-3.5 h-3.5 ${resendingSms ? 'animate-spin' : ''}`} />
                              <span>{resendingSms ? 'Sending SMS...' : 'Resend SMS'}</span>
                            </button>
                          </div>
                        </div>

                        {/* Twilio SMS Dispatch Inform Flow Banner */}
                        <div className="flex items-center gap-2 text-[11px] text-purple-300/80 bg-purple-950/40 px-3 py-1.5 rounded-xl border border-purple-500/20 w-fit">
                          <MessageSquare className="w-3.5 h-3.5 text-purple-400" />
                          <span>Dispatched via <strong>Twilio SMS</strong> to your registered mobile number</span>
                        </div>

                        {/* Timer */}
                        {otpTimeLeft > 0 && (
                          <div className="flex items-center gap-1.5 text-[10px] text-gray-400">
                            <Clock className="w-3 h-3" />
                            <span>Expires in <span className="text-amber-300 font-bold">{formatCountdown(otpTimeLeft)}</span></span>
                          </div>
                        )}
                        {otpTimeLeft <= 0 && otpExpiresAt && (
                          <div className="flex items-center gap-1.5 text-[10px] text-red-400">
                            <Clock className="w-3 h-3" />
                            <span>OTP expired — click Resend SMS to get a new code</span>
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                )}
              </div>
            )}

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
            />

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

      <footer className="py-12 border-t border-white/10 bg-[#050507] mt-auto">
        <div className="max-w-7xl mx-auto px-4 md:px-8 flex flex-col md:flex-row items-center justify-between gap-4 text-xs text-gray-500">
          <div>
            © 2026 AURA Studio Inc. All rights reserved. Luxury Mobile Salon & Barber Booking.
          </div>
          <div className="flex items-center gap-6">
            <a href="#" className="hover:text-purple-400 transition-colors">Privacy Policy</a>
            <a href="#" className="hover:text-purple-400 transition-colors">Terms of Service</a>
            <a href="#" className="hover:text-purple-400 transition-colors">Partner Portal</a>
          </div>
        </div>
      </footer>

    </div>
  );
}

export default App;
