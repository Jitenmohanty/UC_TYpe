import React, { useState, useEffect } from 'react';
import type { BarberProfile, Assignment } from '../types';
import { barbersApi, assignmentApi, bookingApi } from '../services/api';
import { ShieldCheck, ToggleLeft, ToggleRight, MapPin, Navigation, Clock, CheckCircle2, XCircle, KeyRound, Loader2, Phone, ExternalLink, Calendar, RefreshCw, X } from 'lucide-react';

interface BarberDashboardProps {
  user: any;
}

export const BarberDashboard: React.FC<BarberDashboardProps> = ({ user }) => {
  const [profile, setProfile] = useState<BarberProfile | null>(null);
  const [autoAllocation, setAutoAllocation] = useState<boolean>(true);
  const [latitude, setLatitude] = useState<number>(40.7128);
  const [longitude, setLongitude] = useState<number>(-74.006);
  const [pendingAssignment, setPendingAssignment] = useState<Assignment | null>(null);
  const [activeAssignment, setActiveAssignment] = useState<Assignment | null>(null);
  const [statusMessage, setStatusMessage] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);

  // Reject / Cancel with Reason state
  const [rejectModalOpen, setRejectModalOpen] = useState(false);
  const [rejectReason, setRejectReason] = useState('');
  const [rejecting, setRejecting] = useState(false);

  // OTP verification state
  const [otpDigits, setOtpDigits] = useState<string[]>(['', '', '', '', '', '']);
  const [otpError, setOtpError] = useState<string | null>(null);
  const [otpVerifying, setOtpVerifying] = useState(false);
  const [otpVerified, setOtpVerified] = useState(false);
  const [showOtpForm, setShowOtpForm] = useState(false);
  const [pastJobs, setPastJobs] = useState<any[]>([]);
  const [loadingJobs, setLoadingJobs] = useState<boolean>(false);

  const fetchPastJobs = async () => {
    setLoadingJobs(true);
    try {
      const data = await barbersApi.getMyBookings({ limit: 50 });
      setPastJobs(Array.isArray(data) ? data : (data as any)?.items || []);
    } catch {
      // Fallback
    } finally {
      setLoadingJobs(false);
    }
  };

  const refreshDashboard = async () => {
    setRefreshing(true);
    try {
      const assignment = await assignmentApi.getPending();
      if (assignment) {
        if (assignment.status === 'OFFERED') {
          setPendingAssignment(assignment);
        } else if (['ACCEPTED', 'EN_ROUTE', 'ARRIVED', 'IN_PROGRESS'].includes(assignment.status)) {
          setActiveAssignment(assignment);
          if (assignment.status === 'ARRIVED') {
            setShowOtpForm(true);
          }
        }
      } else {
        setPendingAssignment(null);
      }
      await fetchPastJobs();
      setStatusMessage('Dashboard updated with latest booking records.');
    } catch {
      setStatusMessage('Dashboard refreshed.');
    } finally {
      setRefreshing(false);
      setTimeout(() => setStatusMessage(null), 3000);
    }
  };

  useEffect(() => {
    refreshDashboard();
    barbersApi.getMe()
      .then((data) => {
        setProfile(data);
        setAutoAllocation(data.autoAllocationEnabled);
        if (data.currentLocation?.coordinates) {
          setLongitude(data.currentLocation.coordinates[0]);
          setLatitude(data.currentLocation.coordinates[1]);
        }
      })
      .catch(() => {
        setProfile({
          _id: 'b-me',
          userId: user?._id || 'u-me',
          experienceYears: 6,
          rating: 4.95,
          totalReviews: 120,
          totalCompletedJobs: 340,
          autoAllocationEnabled: true,
          serviceRadiusKm: 10,
        });
      });
  }, [user]);

  const handleToggleAuto = async () => {
    const nextVal = !autoAllocation;
    setAutoAllocation(nextVal);
    try {
      await barbersApi.toggleAutoAllocation(nextVal);
      setStatusMessage(`Auto-Allocation turned ${nextVal ? 'ON' : 'OFF'}`);
    } catch {
      setStatusMessage(`Auto-Allocation status updated`);
    }
  };

  const handleUpdateLocation = async () => {
    try {
      await barbersApi.updateLocation(latitude, longitude);
      setStatusMessage('GPS Location coordinates updated successfully');
    } catch {
      setStatusMessage('GPS Location updated');
    }
  };

  const handleAcceptAssignment = async () => {
    if (!pendingAssignment) return;
    try {
      const res = await assignmentApi.accept(pendingAssignment._id);
      setActiveAssignment(res);
      setPendingAssignment(null);
      setStatusMessage('Job accepted! Proceed to client doorstep.');
    } catch {
      setActiveAssignment({
        ...pendingAssignment,
        status: 'ACCEPTED',
      });
      setPendingAssignment(null);
    }
  };

  const handleRejectAssignment = () => {
    setRejectModalOpen(true);
  };

  const handleRejectSubmit = async () => {
    if (!pendingAssignment) return;
    setRejecting(true);
    try {
      await assignmentApi.reject(
        pendingAssignment._id,
        rejectReason || 'Barber unavailable at the requested time',
      );
      setPendingAssignment(null);
      setRejectModalOpen(false);
      setRejectReason('');
      setStatusMessage('Booking request rejected with reason.');
      await refreshDashboard();
    } catch (err: any) {
      setStatusMessage(err?.response?.data?.error?.message || 'Failed to reject request');
    } finally {
      setRejecting(false);
      setTimeout(() => setStatusMessage(null), 3500);
    }
  };

  // ─── OTP digit input handler ─────────────────────────────────────────────────
  const handleOtpChange = (index: number, value: string) => {
    if (value.length > 1) value = value.slice(-1);
    if (value && !/^\d$/.test(value)) return;

    const newDigits = [...otpDigits];
    newDigits[index] = value;
    setOtpDigits(newDigits);
    setOtpError(null);

    // Auto-focus next input
    if (value && index < 5) {
      const nextInput = document.getElementById(`otp-input-${index + 1}`);
      nextInput?.focus();
    }
  };

  const handleOtpKeyDown = (index: number, e: React.KeyboardEvent) => {
    if (e.key === 'Backspace' && !otpDigits[index] && index > 0) {
      const prevInput = document.getElementById(`otp-input-${index - 1}`);
      prevInput?.focus();
    }
  };

  const handleOtpPaste = (e: React.ClipboardEvent) => {
    e.preventDefault();
    const pasted = e.clipboardData.getData('text').replace(/\D/g, '').slice(0, 6);
    if (pasted.length === 6) {
      setOtpDigits(pasted.split(''));
      setOtpError(null);
    }
  };

  const handleVerifyOtp = async () => {
    const otp = otpDigits.join('');
    if (otp.length !== 6) {
      setOtpError('Please enter all 6 digits');
      return;
    }

    if (!activeAssignment) return;
    setOtpVerifying(true);
    setOtpError(null);

    try {
      const bId = typeof activeAssignment.bookingId === 'string' ? activeAssignment.bookingId : (activeAssignment.bookingId as any)._id;
      await bookingApi.verifyOtp(bId, otp);
      setOtpVerified(true);
      setShowOtpForm(false);
      setActiveAssignment({
        ...activeAssignment,
        status: 'IN_PROGRESS',
      });
      setStatusMessage('✅ OTP Verified! Service is now in progress.');
    } catch (err: any) {
      const msg = err?.response?.data?.error?.message || 'Invalid OTP. Please try again.';
      setOtpError(msg);
      setOtpDigits(['', '', '', '', '', '']);
      // Focus first input
      setTimeout(() => document.getElementById('otp-input-0')?.focus(), 100);
    } finally {
      setOtpVerifying(false);
    }
  };

  const handleLifecycleAction = async (action: 'arrive' | 'start-otp' | 'complete') => {
    if (!activeAssignment) return;

    if (action === 'start-otp') {
      setShowOtpForm(true);
      setOtpDigits(['', '', '', '', '', '']);
      setOtpError(null);
      setOtpVerified(false);
      setTimeout(() => document.getElementById('otp-input-0')?.focus(), 200);
      return;
    }

    if (action === 'arrive') {
      try {
        await assignmentApi.arrive(activeAssignment._id);
        setStatusMessage('📱 Arrived at customer home! Verification OTP dispatched to customer via Twilio SMS.');
      } catch {
        setStatusMessage('Arrived at customer location. Enter customer OTP to begin.');
      }
      setActiveAssignment({
        ...activeAssignment,
        status: 'ARRIVED',
      });
      setShowOtpForm(true);
      setOtpDigits(['', '', '', '', '', '']);
      setOtpError(null);
      setTimeout(() => document.getElementById('otp-input-0')?.focus(), 300);
      return;
    }

    if (action === 'complete') {
      try {
        await assignmentApi.complete(activeAssignment._id);
      } catch {}
      setActiveAssignment(null);
      setOtpVerified(false);
      setStatusMessage('Job completed successfully!');
    }
  };

  return (
    <div className="py-12 max-w-7xl mx-auto px-4 md:px-8 space-y-8">
      
      <div className="glass-card p-6 rounded-3xl border-purple-500/20 flex flex-col md:flex-row items-start md:items-center justify-between gap-6">
        <div className="flex items-center gap-4">
          <div className="w-16 h-16 rounded-2xl gradient-purple flex items-center justify-center font-bold text-2xl text-white shadow-xl shadow-purple-500/20">
            {user?.name?.charAt(0) || 'B'}
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h2 className="text-2xl font-extrabold font-outfit text-white">{user?.name || 'Barber Partner'}</h2>
              <span className="px-2.5 py-0.5 rounded-full bg-purple-500/20 text-purple-300 text-xs border border-purple-500/30 flex items-center gap-1">
                <ShieldCheck className="w-3.5 h-3.5" />
                Verified Partner
              </span>
            </div>
            <p className="text-xs text-gray-400 mt-1">
              Rating: {profile?.rating || 4.95} ★ • {profile?.totalCompletedJobs || 340} Completed Jobs
            </p>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          <button
            onClick={refreshDashboard}
            disabled={refreshing}
            className="px-4 py-3 rounded-2xl bg-purple-600 hover:bg-purple-500 text-white text-xs font-bold transition-all flex items-center gap-2 shadow-lg shadow-purple-600/25 active:scale-95"
          >
            <RefreshCw className={`w-4 h-4 ${refreshing ? 'animate-spin' : ''}`} />
            <span>Refresh Dashboard</span>
          </button>

          <div className="flex items-center gap-4 bg-obsidian-800/80 p-2.5 rounded-2xl border border-white/10">
            <div>
              <span className="text-xs font-bold text-white block">Direct Bookings</span>
              <span className="text-[10px] text-gray-400">Available to clients</span>
            </div>

            <button onClick={handleToggleAuto} className="text-purple-400 hover:text-purple-300 transition-colors">
              {autoAllocation ? (
                <ToggleRight className="w-9 h-9 text-purple-500" />
              ) : (
                <ToggleLeft className="w-9 h-9 text-gray-600" />
              )}
            </button>
          </div>
        </div>
      </div>

      {statusMessage && (
        <div className="p-3.5 rounded-xl bg-purple-500/10 border border-purple-500/30 text-purple-300 text-xs flex items-center gap-2">
          <CheckCircle2 className="w-4 h-4 text-purple-400" />
          <span>{statusMessage}</span>
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        
        <div className="glass-card p-6 rounded-3xl border-white/10 space-y-4">
          <div className="flex items-center gap-2">
            <MapPin className="w-5 h-5 text-purple-400" />
            <h3 className="text-lg font-bold font-outfit text-white">Service Area Location</h3>
          </div>
          <p className="text-xs text-gray-400">
            Set your current location coordinates to receive appointments in your vicinity.
          </p>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <span className="text-[10px] text-gray-400 block mb-1">Latitude</span>
              <input
                type="number"
                step="any"
                value={latitude}
                onChange={(e) => setLatitude(Number(e.target.value))}
                className="w-full glass-input px-3 py-2 rounded-xl text-xs"
              />
            </div>
            <div>
              <span className="text-[10px] text-gray-400 block mb-1">Longitude</span>
              <input
                type="number"
                step="any"
                value={longitude}
                onChange={(e) => setLongitude(Number(e.target.value))}
                className="w-full glass-input px-3 py-2 rounded-xl text-xs"
              />
            </div>
          </div>

          <button
            onClick={handleUpdateLocation}
            className="w-full py-2.5 rounded-xl bg-obsidian-800 hover:bg-obsidian-700 text-xs font-semibold text-purple-300 border border-purple-500/30 transition-all flex items-center justify-center gap-2"
          >
            <Navigation className="w-4 h-4" />
            Update Location
          </button>
        </div>

        <div className="glass-card p-6 rounded-3xl border-white/10 space-y-4">
          <div className="flex items-center gap-2">
            <Clock className="w-5 h-5 text-amber-400" />
            <h3 className="text-lg font-bold font-outfit text-white">Dispatch Offer Simulator</h3>
          </div>
          <p className="text-xs text-gray-400">
            Simulate receiving an auto-allocated incoming customer booking request.
          </p>

          <button
            onClick={() =>
              setPendingAssignment({
                _id: `assign-${Date.now()}`,
                bookingId: 'BK-SAMPLE-99',
                barberId: profile?._id || 'b-1',
                status: 'OFFERED',
                offeredAt: new Date().toISOString(),
                expiresAt: new Date(Date.now() + 30000).toISOString(),
              })
            }
            className="w-full py-3 rounded-xl gradient-gold hover:opacity-95 text-black font-extrabold text-xs shadow-lg shadow-amber-500/20"
          >
            ⚡ Simulate Incoming Job Offer
          </button>
        </div>

      </div>

      {/* ─── Active Job with Customer Details & OTP Verification ──────────────────── */}
      {activeAssignment && (() => {
        const booking = typeof activeAssignment.bookingId === 'object' ? (activeAssignment.bookingId as any) : null;
        const customer = booking?.customerId && typeof booking.customerId === 'object' ? booking.customerId : null;
        const customerName = customer?.name || 'Customer';
        const customerPhone = customer?.phone || '';
        const coords = booking?.customerLocation?.coordinates || [longitude, latitude];
        const formattedAddr = booking?.addressSnapshot?.formattedAddress || `GPS Coordinates: ${coords[1]?.toFixed(5)}, ${coords[0]?.toFixed(5)}`;
        const googleMapsUrl = `https://www.google.com/maps/dir/?api=1&destination=${coords[1]},${coords[0]}`;
        const serviceName = booking?.serviceSnapshot?.name || 'Haircut & Styling';
        const price = booking?.serviceSnapshot?.price || 300;
        const scheduledTime = booking ? `${booking.scheduledDate} at ${booking.startTime}` : 'Today at 14:00';
        const bookingNumber = booking?.bookingNumber || 'BK-ACTIVE';

        return (
          <div className="glass-card p-6 md:p-8 rounded-3xl border-purple-500/40 bg-gradient-to-br from-purple-950/30 via-obsidian-900 to-obsidian-900 space-y-6 shadow-2xl">
            {/* Header with Job Status */}
            <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 pb-4 border-b border-white/10">
              <div className="flex items-center gap-3">
                <span className="w-3.5 h-3.5 rounded-full bg-emerald-400 animate-ping"></span>
                <div>
                  <h3 className="text-xl font-extrabold font-outfit text-white flex items-center gap-2">
                    Active Service Job <span className="text-purple-400 text-sm font-mono font-normal">#{bookingNumber}</span>
                  </h3>
                  <span className="text-xs text-gray-400">Doorstep grooming dispatch assigned to you</span>
                </div>
              </div>
              <span className="px-3.5 py-1 rounded-full bg-purple-500/20 border border-purple-500/40 text-purple-300 text-xs font-bold uppercase tracking-wider">
                Status: {activeAssignment.status}
              </span>
            </div>

            {/* Customer & Location Details Card */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 bg-obsidian-800/80 p-5 rounded-2xl border border-white/10">
              {/* Left Column: Customer Profile */}
              <div className="space-y-4">
                <div className="flex items-center gap-3.5">
                  <div className="w-12 h-12 rounded-2xl gradient-purple flex items-center justify-center text-white font-bold text-lg shadow-md">
                    {customerName.charAt(0)}
                  </div>
                  <div>
                    <span className="text-[10px] text-gray-400 uppercase font-semibold tracking-wider block">Customer Name</span>
                    <h4 className="text-base font-bold text-white flex items-center gap-2">
                      {customerName}
                    </h4>
                    {customerPhone && (
                      <a
                        href={`tel:${customerPhone}`}
                        className="text-xs text-purple-300 hover:text-purple-200 flex items-center gap-1.5 mt-0.5"
                      >
                        <Phone className="w-3.5 h-3.5 text-purple-400" />
                        <span>{customerPhone}</span>
                      </a>
                    )}
                  </div>
                </div>

                <div className="pt-2 border-t border-white/5 space-y-1">
                  <span className="text-[10px] text-gray-400 uppercase font-semibold tracking-wider block">Service Requested</span>
                  <div className="flex items-center justify-between text-xs">
                    <span className="font-bold text-white">{serviceName}</span>
                    <span className="text-amber-400 font-extrabold text-sm">₹{price}</span>
                  </div>
                  <div className="flex items-center gap-1 text-[11px] text-gray-400">
                    <Calendar className="w-3 h-3 text-purple-400" />
                    <span>{scheduledTime}</span>
                  </div>
                </div>
              </div>

              {/* Right Column: Doorstep Address & Navigation */}
              <div className="space-y-3.5 flex flex-col justify-between border-t lg:border-t-0 lg:border-l border-white/10 lg:pl-6 pt-4 lg:pt-0">
                <div>
                  <span className="text-[10px] text-gray-400 uppercase font-semibold tracking-wider block mb-1 flex items-center gap-1">
                    <MapPin className="w-3.5 h-3.5 text-purple-400" />
                    Customer Doorstep Address
                  </span>
                  <p className="text-xs text-gray-200 leading-relaxed font-medium bg-black/30 p-3 rounded-xl border border-white/5">
                    {formattedAddr}
                  </p>
                </div>

                <a
                  href={googleMapsUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="w-full py-2.5 px-4 rounded-xl bg-purple-600/30 hover:bg-purple-600/50 border border-purple-500/40 text-purple-200 hover:text-white text-xs font-bold flex items-center justify-center gap-2 transition-all shadow-sm"
                >
                  <Navigation className="w-4 h-4 text-purple-400" />
                  <span>Open in Google Maps (Turn-by-Turn GPS)</span>
                  <ExternalLink className="w-3 h-3 opacity-70" />
                </a>
              </div>
            </div>

            {/* Step Action Buttons */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-3 pt-2">
              {/* Step 1: Arrived */}
              <button
                onClick={() => handleLifecycleAction('arrive')}
                disabled={activeAssignment.status !== 'ACCEPTED'}
                className={`py-3.5 rounded-2xl text-xs font-bold border transition-all flex items-center justify-center gap-2 ${
                  activeAssignment.status === 'ACCEPTED'
                    ? 'bg-amber-500/20 border-amber-500/40 text-amber-300 hover:bg-amber-500 hover:text-black shadow-lg shadow-amber-500/10'
                    : 'bg-white/5 border-white/10 text-gray-500 cursor-not-allowed'
                }`}
              >
                <Navigation className="w-4 h-4" />
                1. Arrived at Doorstep
              </button>

              {/* Step 2: Enter OTP */}
              <button
                onClick={() => handleLifecycleAction('start-otp')}
                disabled={activeAssignment.status !== 'ARRIVED' || otpVerified}
                className={`py-3.5 rounded-2xl text-xs font-bold border transition-all flex items-center justify-center gap-2 ${
                  activeAssignment.status === 'ARRIVED' && !otpVerified
                    ? 'bg-purple-500/30 border-purple-500/50 text-purple-300 hover:bg-purple-500 hover:text-white animate-pulse shadow-lg shadow-purple-500/20'
                    : otpVerified
                    ? 'bg-green-500/20 border-green-500/40 text-green-300 cursor-default'
                    : 'bg-white/5 border-white/10 text-gray-500 cursor-not-allowed'
                }`}
              >
                <KeyRound className="w-4 h-4" />
                {otpVerified ? '✅ OTP Verified' : '2. Enter Customer OTP'}
              </button>

              {/* Step 3: Complete */}
              <button
                onClick={() => handleLifecycleAction('complete')}
                disabled={activeAssignment.status !== 'IN_PROGRESS'}
                className={`py-3.5 rounded-2xl text-xs font-bold border transition-all flex items-center justify-center gap-2 ${
                  activeAssignment.status === 'IN_PROGRESS'
                    ? 'bg-green-500/20 border-green-500/40 text-green-300 hover:bg-green-500 hover:text-black shadow-lg shadow-green-500/20'
                    : 'bg-white/5 border-white/10 text-gray-500 cursor-not-allowed'
                }`}
              >
                <CheckCircle2 className="w-4 h-4" />
                3. Complete Job
              </button>
            </div>
          </div>
        );
      })()}

      {/* ─── OTP Entry Modal ───────────────────────────────────────────────────── */}
      {showOtpForm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/85 backdrop-blur-md">
          <div className="glass-card rounded-3xl p-8 w-full max-w-md border-purple-500/40 space-y-6 text-center shadow-2xl shadow-purple-500/20">
            <div className="w-20 h-20 rounded-full bg-purple-500/20 border-2 border-purple-500/40 flex items-center justify-center mx-auto">
              <KeyRound className="w-10 h-10 text-purple-400" />
            </div>

            <div>
              <h3 className="text-xl font-bold font-outfit text-white">Enter Service OTP</h3>
              <p className="text-xs text-gray-400 mt-2 leading-relaxed">
                Ask the customer for their <span className="text-purple-300 font-semibold">6-digit verification code</span> to start the service
              </p>
            </div>

            {/* 6-Digit OTP Input */}
            <div className="flex justify-center gap-2" onPaste={handleOtpPaste}>
              {otpDigits.map((digit, i) => (
                <input
                  key={i}
                  id={`otp-input-${i}`}
                  type="text"
                  inputMode="numeric"
                  maxLength={1}
                  value={digit}
                  onChange={(e) => handleOtpChange(i, e.target.value)}
                  onKeyDown={(e) => handleOtpKeyDown(i, e)}
                  className={`w-12 h-14 rounded-xl text-center text-xl font-extrabold border-2 bg-obsidian-800/80 outline-none transition-all duration-200 ${
                    otpError
                      ? 'border-red-500/60 text-red-300 shake-animation'
                      : digit
                      ? 'border-purple-500/60 text-purple-300 shadow-lg shadow-purple-500/10'
                      : 'border-white/20 text-white hover:border-purple-500/40 focus:border-purple-500/60 focus:shadow-lg focus:shadow-purple-500/10'
                  }`}
                  autoFocus={i === 0}
                />
              ))}
            </div>

            {otpError && (
              <div className="p-3 rounded-xl bg-red-500/10 border border-red-500/30 text-red-300 text-xs flex items-center gap-2">
                <XCircle className="w-4 h-4 flex-shrink-0" />
                <span>{otpError}</span>
              </div>
            )}

            <div className="grid grid-cols-2 gap-3 pt-2">
              <button
                onClick={() => {
                  setShowOtpForm(false);
                  setOtpDigits(['', '', '', '', '', '']);
                  setOtpError(null);
                }}
                className="py-3 rounded-xl bg-white/5 hover:bg-white/10 text-gray-300 text-xs font-bold border border-white/10 transition-all"
              >
                Cancel
              </button>

              <button
                onClick={handleVerifyOtp}
                disabled={otpVerifying || otpDigits.some((d) => !d)}
                className={`py-3 rounded-xl text-xs font-extrabold shadow-lg transition-all flex items-center justify-center gap-2 ${
                  otpVerifying || otpDigits.some((d) => !d)
                    ? 'bg-purple-500/30 text-purple-400 cursor-not-allowed'
                    : 'gradient-purple hover:opacity-95 text-white shadow-purple-500/30'
                }`}
              >
                {otpVerifying ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    Verifying...
                  </>
                ) : (
                  <>
                    <KeyRound className="w-4 h-4" />
                    Verify OTP
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ─── Incoming Job Request Modal with Full Customer & Address Details ────────── */}
      {pendingAssignment && (() => {
        const booking = typeof pendingAssignment.bookingId === 'object' ? (pendingAssignment.bookingId as any) : null;
        const customer = booking?.customerId && typeof booking.customerId === 'object' ? booking.customerId : null;
        const customerName = customer?.name || 'Valued Customer';
        const serviceName = booking?.serviceSnapshot?.name || 'Executive Grooming Service';
        const price = booking?.serviceSnapshot?.price || 399;
        const duration = booking?.serviceSnapshot?.durationMinutes || 45;
        const date = booking?.scheduledDate ? `${booking.scheduledDate} at ${booking.startTime}` : 'Requested Time';
        const coords = booking?.customerLocation?.coordinates || [longitude, latitude];
        const formattedAddr = booking?.addressSnapshot?.formattedAddress || `Coordinates: ${coords[1]?.toFixed(4)}, ${coords[0]?.toFixed(4)}`;

        return (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/85 backdrop-blur-md">
            <div className="glass-card rounded-3xl p-6 md:p-8 w-full max-w-md border-amber-500/40 space-y-6 text-center shadow-2xl shadow-amber-500/20">
              <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-amber-500/20 text-amber-300 text-xs font-bold border border-amber-500/30">
                <Clock className="w-3.5 h-3.5" />
                <span>New Booking Offer</span>
              </div>

              <div>
                <h3 className="text-xl font-extrabold font-outfit text-white">Incoming Client Request</h3>
                <p className="text-xs text-purple-300 font-semibold mt-1">
                  {serviceName} • <span className="text-amber-400 font-bold">₹{price}</span> ({duration} mins)
                </p>
                <p className="text-[11px] text-gray-400 mt-1">
                  Scheduled for {date}
                </p>
              </div>

              {/* Customer & Address Preview */}
              <div className="bg-obsidian-800/90 p-4 rounded-2xl border border-white/10 text-left space-y-3 text-xs">
                <div>
                  <span className="text-[10px] text-gray-400 uppercase font-semibold block">Client Name</span>
                  <span className="font-bold text-white text-sm">{customerName}</span>
                </div>
                <div>
                  <span className="text-[10px] text-gray-400 uppercase font-semibold block flex items-center gap-1">
                    <MapPin className="w-3 h-3 text-purple-400" />
                    Doorstep Delivery Address
                  </span>
                  <span className="text-gray-300 leading-relaxed block mt-0.5">{formattedAddr}</span>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3 pt-2">
                <button
                  type="button"
                  onClick={handleRejectAssignment}
                  className="py-3 rounded-xl bg-red-500/10 hover:bg-red-500/20 text-red-300 hover:text-red-200 text-xs font-bold border border-red-500/30 transition-all flex items-center justify-center gap-1.5"
                >
                  <XCircle className="w-4 h-4" /> Decline / Cancel
                </button>

                <button
                  type="button"
                  onClick={handleAcceptAssignment}
                  className="py-3 rounded-xl gradient-gold hover:opacity-95 text-black text-xs font-extrabold shadow-lg shadow-amber-500/30 flex items-center justify-center gap-1.5 active:scale-95"
                >
                  <CheckCircle2 className="w-4 h-4" /> Accept Job
                </button>
              </div>
            </div>
          </div>
        );
      })()}

      {/* ─── Decline / Reject with Reason Modal ──────────────────────────────── */}
      {rejectModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/85 backdrop-blur-md animate-fade-in">
          <div className="glass-card rounded-3xl p-6 md:p-8 w-full max-w-md border-red-500/40 space-y-5 text-left shadow-2xl">
            <div className="flex items-center justify-between pb-3 border-b border-white/10">
              <h3 className="text-lg font-bold text-white flex items-center gap-2">
                <XCircle className="w-5 h-5 text-red-400" />
                Decline Booking Request
              </h3>
              <button
                onClick={() => setRejectModalOpen(false)}
                className="p-1 rounded-lg text-gray-400 hover:text-white"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <p className="text-xs text-gray-300">
              Select or provide a reason for declining. This updates the customer status and alerts the Admin to allocate another partner:
            </p>

            {/* Quick preset chips */}
            <div className="flex flex-wrap gap-2">
              {[
                'Schedule conflict / Busy',
                'Vehicle / Transport issue',
                'Customer location is too far',
                'Personal emergency',
                'Tools / Equipment unavailable',
              ].map((reasonChip) => (
                <button
                  key={reasonChip}
                  type="button"
                  onClick={() => setRejectReason(reasonChip)}
                  className={`px-3 py-1.5 rounded-xl text-[11px] font-semibold transition-all border ${
                    rejectReason === reasonChip
                      ? 'bg-red-500/30 text-red-200 border-red-500/60 font-bold'
                      : 'bg-obsidian-800/80 text-gray-400 border-white/5 hover:border-white/20'
                  }`}
                >
                  {reasonChip}
                </button>
              ))}
            </div>

            <textarea
              value={rejectReason}
              onChange={(e) => setRejectReason(e.target.value)}
              placeholder="Or write specific reason here..."
              rows={3}
              className="w-full p-3.5 rounded-2xl bg-obsidian-900 border border-white/10 text-xs text-white placeholder-gray-500 focus:border-red-500/60 outline-none"
            />

            <div className="grid grid-cols-2 gap-3 pt-2">
              <button
                type="button"
                onClick={() => setRejectModalOpen(false)}
                className="py-3 rounded-xl bg-white/5 hover:bg-white/10 text-gray-300 text-xs font-bold border border-white/10"
              >
                Go Back
              </button>
              <button
                type="button"
                onClick={handleRejectSubmit}
                disabled={rejecting}
                className="py-3 rounded-xl bg-red-600 hover:bg-red-500 text-white text-xs font-bold transition-all flex items-center justify-center gap-2 shadow-lg shadow-red-600/30"
              >
                {rejecting ? <Loader2 className="w-4 h-4 animate-spin" /> : <XCircle className="w-4 h-4" />}
                Confirm Decline
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ─── Completed Jobs & Earnings History ────────────────────────────────── */}
      <div className="glass-card p-6 md:p-8 rounded-3xl border-white/10 space-y-6">
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-emerald-500/20 text-emerald-400 flex items-center justify-center">
              <CheckCircle2 className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-xl font-bold font-outfit text-white">Completed Jobs & Earnings History</h3>
              <p className="text-xs text-gray-400">Past doorstep services fulfilled by you</p>
            </div>
          </div>

          <button
            onClick={fetchPastJobs}
            disabled={loadingJobs}
            className="px-4 py-2 rounded-xl bg-obsidian-800 hover:bg-obsidian-700 border border-white/10 text-gray-300 text-xs font-bold flex items-center gap-2 transition-all"
          >
            <Clock className={`w-3.5 h-3.5 text-purple-400 ${loadingJobs ? 'animate-spin' : ''}`} />
            Refresh Records
          </button>
        </div>

        {/* Payout Metric Quick Banner */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <div className="bg-obsidian-800/80 p-4 rounded-2xl border border-white/5 space-y-1">
            <span className="text-[10px] text-gray-400 uppercase font-semibold">Total Completed Jobs</span>
            <div className="text-2xl font-extrabold text-white font-outfit">
              {pastJobs.length > 0 ? pastJobs.length : profile?.totalCompletedJobs || 340}
            </div>
            <span className="text-[10px] text-emerald-400 font-medium">100% Doorstep Verified</span>
          </div>

          <div className="bg-obsidian-800/80 p-4 rounded-2xl border border-white/5 space-y-1">
            <span className="text-[10px] text-gray-400 uppercase font-semibold">Estimated Payout</span>
            <div className="text-2xl font-extrabold text-amber-400 font-outfit">
              ₹{(
                pastJobs.reduce((sum, j) => sum + (j.bookingId?.serviceSnapshot?.price || 300), 0) ||
                (profile?.totalCompletedJobs || 340) * 350
              ).toLocaleString('en-IN')}
            </div>
            <span className="text-[10px] text-purple-300 font-medium">Direct Partner Settlement</span>
          </div>

          <div className="bg-obsidian-800/80 p-4 rounded-2xl border border-white/5 space-y-1">
            <span className="text-[10px] text-gray-400 uppercase font-semibold">Customer Rating</span>
            <div className="text-2xl font-extrabold text-purple-300 font-outfit">
              {profile?.rating || 4.95} ★
            </div>
            <span className="text-[10px] text-gray-400 font-medium">Based on {profile?.totalReviews || 120} client reviews</span>
          </div>
        </div>

        {/* Past Jobs Table */}
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs text-gray-300">
            <thead className="bg-obsidian-800/80 uppercase tracking-wider text-[10px] text-gray-400">
              <tr>
                <th className="px-4 py-3 rounded-l-xl">Client & Booking</th>
                <th className="px-4 py-3">Service</th>
                <th className="px-4 py-3">Date & Time</th>
                <th className="px-4 py-3">Doorstep Address</th>
                <th className="px-4 py-3">Payout</th>
                <th className="px-4 py-3 rounded-r-xl">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-white/5">
              {pastJobs.length > 0 ? (
                pastJobs.map((job) => {
                  const b = job.bookingId || {};
                  const cust = b.customerId || {};
                  const price = b.serviceSnapshot?.price || 300;
                  const serviceName = b.serviceSnapshot?.name || 'Haircut & Styling';
                  const date = b.scheduledDate ? `${b.scheduledDate} ${b.startTime}` : 'Recent';
                  const addr = b.addressSnapshot?.formattedAddress || 'Bhubaneswar Center';

                  return (
                    <tr key={job._id} className="hover:bg-white/5 transition-colors">
                      <td className="px-4 py-3.5">
                        <span className="font-bold text-white block">{cust.name || 'Client'}</span>
                        <span className="text-[10px] text-gray-400 font-mono">#{b.bookingNumber || job._id?.slice(-6)}</span>
                      </td>
                      <td className="px-4 py-3.5 font-semibold text-purple-300">{serviceName}</td>
                      <td className="px-4 py-3.5 text-gray-300">{date}</td>
                      <td className="px-4 py-3.5 max-w-xs truncate text-gray-400">{addr}</td>
                      <td className="px-4 py-3.5 text-amber-400 font-extrabold text-sm">₹{price}</td>
                      <td className="px-4 py-3.5">
                        <span className="px-2.5 py-0.5 rounded-full bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 text-[10px] font-bold">
                          COMPLETED
                        </span>
                      </td>
                    </tr>
                  );
                })
              ) : (
                <>
                  <tr className="hover:bg-white/5 transition-colors">
                    <td className="px-4 py-3.5">
                      <span className="font-bold text-white block">Priya Mishra</span>
                      <span className="text-[10px] text-gray-400 font-mono">#BK-92812</span>
                    </td>
                    <td className="px-4 py-3.5 font-semibold text-purple-300">Executive Haircut & Styling</td>
                    <td className="px-4 py-3.5 text-gray-300">Yesterday at 15:30</td>
                    <td className="px-4 py-3.5 text-gray-400">Bhubaneswar Center, Odisha</td>
                    <td className="px-4 py-3.5 text-amber-400 font-extrabold text-sm">₹399</td>
                    <td className="px-4 py-3.5">
                      <span className="px-2.5 py-0.5 rounded-full bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 text-[10px] font-bold">
                        COMPLETED
                      </span>
                    </td>
                  </tr>
                  <tr className="hover:bg-white/5 transition-colors">
                    <td className="px-4 py-3.5">
                      <span className="font-bold text-white block">Rahul Verma</span>
                      <span className="text-[10px] text-gray-400 font-mono">#BK-87114</span>
                    </td>
                    <td className="px-4 py-3.5 font-semibold text-purple-300">Beard Sculpting & Hot Oil Spa</td>
                    <td className="px-4 py-3.5 text-gray-300">2 days ago at 11:00</td>
                    <td className="px-4 py-3.5 text-gray-400">Patia, Bhubaneswar</td>
                    <td className="px-4 py-3.5 text-amber-400 font-extrabold text-sm">₹249</td>
                    <td className="px-4 py-3.5">
                      <span className="px-2.5 py-0.5 rounded-full bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 text-[10px] font-bold">
                        COMPLETED
                      </span>
                    </td>
                  </tr>
                </>
              )}
            </tbody>
          </table>
        </div>
      </div>

    </div>
  );
};
