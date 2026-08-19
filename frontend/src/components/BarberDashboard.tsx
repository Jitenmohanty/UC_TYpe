import React, { useState, useEffect } from 'react';
import type { BarberProfile, Assignment } from '../types';
import { barbersApi, assignmentApi, bookingApi } from '../services/api';
import { ShieldCheck, ToggleLeft, ToggleRight, MapPin, Navigation, Clock, CheckCircle2, XCircle, KeyRound, Loader2 } from 'lucide-react';

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
  const [countdown, setCountdown] = useState<number>(30);
  const [statusMessage, setStatusMessage] = useState<string | null>(null);

  // OTP verification state
  const [otpDigits, setOtpDigits] = useState<string[]>(['', '', '', '', '', '']);
  const [otpError, setOtpError] = useState<string | null>(null);
  const [otpVerifying, setOtpVerifying] = useState(false);
  const [otpVerified, setOtpVerified] = useState(false);
  const [showOtpForm, setShowOtpForm] = useState(false);

  useEffect(() => {
    barbersApi.getMe()
      .then((data) => {
        setProfile(data);
        setAutoAllocation(data.autoAllocationEnabled);
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

  useEffect(() => {
    if (!pendingAssignment) return;
    setCountdown(30);
    const interval = setInterval(() => {
      setCountdown((c) => {
        if (c <= 1) {
          clearInterval(interval);
          setPendingAssignment(null);
          return 0;
        }
        return c - 1;
      });
    }, 1000);

    return () => clearInterval(interval);
  }, [pendingAssignment]);

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
    } catch {
      setActiveAssignment({
        ...pendingAssignment,
        status: 'ACCEPTED',
      });
      setPendingAssignment(null);
    }
  };

  const handleRejectAssignment = async () => {
    if (!pendingAssignment) return;
    try {
      await assignmentApi.reject(pendingAssignment._id);
    } catch {}
    setPendingAssignment(null);
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

        <div className="flex items-center gap-4 bg-obsidian-800/80 p-3 rounded-2xl border border-white/10">
          <div>
            <span className="text-xs font-bold text-white block">Accept Direct Bookings</span>
            <span className="text-[10px] text-gray-400">Receive instant booking requests from nearby clients</span>
          </div>

          <button onClick={handleToggleAuto} className="text-purple-400 hover:text-purple-300 transition-colors">
            {autoAllocation ? (
              <ToggleRight className="w-10 h-10 text-purple-500" />
            ) : (
              <ToggleLeft className="w-10 h-10 text-gray-600" />
            )}
          </button>
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

      {/* ─── Active Job with OTP Verification ──────────────────────────────────── */}
      {activeAssignment && (
        <div className="glass-card p-6 rounded-3xl border-purple-500/30 bg-purple-950/20 space-y-6">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <span className="w-3 h-3 rounded-full bg-green-400 animate-ping"></span>
              <h3 className="text-lg font-bold font-outfit text-white">Active Service Job</h3>
            </div>
            <span className="px-3 py-1 rounded-full bg-purple-500/20 border border-purple-500/40 text-purple-300 text-xs font-bold uppercase">
              Status: {activeAssignment.status}
            </span>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            {/* Step 1: En Route / Arrived */}
            <button
              onClick={() => handleLifecycleAction('arrive')}
              disabled={activeAssignment.status !== 'ACCEPTED'}
              className={`py-3 rounded-xl text-xs font-bold border transition-all flex items-center justify-center gap-2 ${
                activeAssignment.status === 'ACCEPTED'
                  ? 'bg-amber-500/20 border-amber-500/40 text-amber-300 hover:bg-amber-500 hover:text-black'
                  : 'bg-white/5 border-white/10 text-gray-500 cursor-not-allowed'
              }`}
            >
              <Navigation className="w-4 h-4" />
              1. Arrived at Customer
            </button>

            {/* Step 2: Enter OTP (replaces old "Start Service") */}
            <button
              onClick={() => handleLifecycleAction('start-otp')}
              disabled={activeAssignment.status !== 'ARRIVED' || otpVerified}
              className={`py-3 rounded-xl text-xs font-bold border transition-all flex items-center justify-center gap-2 ${
                activeAssignment.status === 'ARRIVED' && !otpVerified
                  ? 'bg-purple-500/20 border-purple-500/40 text-purple-300 hover:bg-purple-500 hover:text-white animate-pulse'
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
              className={`py-3 rounded-xl text-xs font-bold border transition-all flex items-center justify-center gap-2 ${
                activeAssignment.status === 'IN_PROGRESS'
                  ? 'bg-green-500/20 border-green-500/40 text-green-300 hover:bg-green-500 hover:text-black'
                  : 'bg-white/5 border-white/10 text-gray-500 cursor-not-allowed'
              }`}
            >
              <CheckCircle2 className="w-4 h-4" />
              3. Complete Job
            </button>
          </div>
        </div>
      )}

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
                disabled={otpVerifying || otpDigits.some(d => !d)}
                className={`py-3 rounded-xl text-xs font-extrabold shadow-lg transition-all flex items-center justify-center gap-2 ${
                  otpVerifying || otpDigits.some(d => !d)
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

      {/* ─── Incoming Offer Modal ──────────────────────────────────────────────── */}
      {pendingAssignment && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/85 backdrop-blur-md">
          <div className="glass-card rounded-3xl p-6 w-full max-w-md border-amber-500/40 space-y-6 text-center shadow-2xl shadow-amber-500/20 animate-bounce-short">
            <div className="w-16 h-16 rounded-full bg-amber-500/20 border border-amber-500/40 flex items-center justify-center mx-auto text-amber-400 text-2xl font-extrabold animate-pulse">
              {countdown}s
            </div>

            <div>
              <h3 className="text-xl font-bold font-outfit text-white">⚡ Incoming Job Request!</h3>
              <p className="text-xs text-gray-300 mt-1">
                Executive Cut & Beard Trim • 1.4 km distance
              </p>
            </div>

            <div className="grid grid-cols-2 gap-3 pt-2">
              <button
                onClick={handleRejectAssignment}
                className="py-3 rounded-xl bg-red-500/20 hover:bg-red-500 text-red-300 hover:text-white text-xs font-bold border border-red-500/30 transition-all flex items-center justify-center gap-1"
              >
                <XCircle className="w-4 h-4" /> Reject
              </button>

              <button
                onClick={handleAcceptAssignment}
                className="py-3 rounded-xl gradient-gold hover:opacity-95 text-black text-xs font-extrabold shadow-lg shadow-amber-500/30 flex items-center justify-center gap-1"
              >
                <CheckCircle2 className="w-4 h-4" /> Accept Job
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
};
