import React, { useState, useEffect, useCallback, useRef } from 'react';
import type { Assignment, BarberProfile, Booking } from '../types';
import { barbersApi, assignmentApi, bookingApi, apiErrorMessage } from '../services/api';
import {
  ShieldCheck, ToggleLeft, ToggleRight, MapPin, Navigation, Clock, CheckCircle2,
  XCircle, KeyRound, Loader2, Phone, ExternalLink, Calendar, RefreshCw, X,
  Sparkles, Scissors, AlertCircle, Inbox,
} from 'lucide-react';

interface BarberDashboardProps {
  user: { _id?: string; name?: string } | null;
}

/** How often the dashboard re-fetches from the server. */
const POLL_INTERVAL_MS = 10000;

/** Assignment statuses where the barber is actively working the job. */
const IN_FLIGHT: Assignment['status'][] = ['ACCEPTED', 'EN_ROUTE', 'ARRIVED', 'IN_PROGRESS'];

const bookingOf = (a: Assignment | null): Booking | null =>
  a && typeof a.bookingId === 'object' ? (a.bookingId as Booking) : null;

export const BarberDashboard: React.FC<BarberDashboardProps> = ({ user }) => {
  const [profile, setProfile] = useState<BarberProfile | null>(null);
  const [acceptingBookings, setAcceptingBookings] = useState<boolean>(false);
  const [latitude, setLatitude] = useState<number>(20.2961);
  const [longitude, setLongitude] = useState<number>(85.8245);

  // Server-owned state
  const [activeAssignment, setActiveAssignment] = useState<Assignment | null>(null);
  const [openBookings, setOpenBookings] = useState<Booking[]>([]);
  const [pastJobs, setPastJobs] = useState<Assignment[]>([]);

  const [loading, setLoading] = useState<boolean>(true);
  const [refreshing, setRefreshing] = useState(false);
  const [statusMessage, setStatusMessage] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const [claimingBookingId, setClaimingBookingId] = useState<string | null>(null);
  const [busyAction, setBusyAction] = useState<string | null>(null);

  // Reject / cancel modals
  const [rejectModalOpen, setRejectModalOpen] = useState(false);
  const [rejectReason, setRejectReason] = useState('');
  const [cancelModalOpen, setCancelModalOpen] = useState(false);
  const [cancelReason, setCancelReason] = useState('');

  // OTP entry
  const [showOtpForm, setShowOtpForm] = useState(false);
  const [otpDigits, setOtpDigits] = useState<string[]>(['', '', '', '', '', '']);
  const [otpError, setOtpError] = useState<string | null>(null);
  const [otpVerifying, setOtpVerifying] = useState(false);

  const flash = useCallback((msg: string, isError = false) => {
    if (isError) {
      setErrorMessage(msg);
      setStatusMessage(null);
      setTimeout(() => setErrorMessage(null), 6000);
    } else {
      setStatusMessage(msg);
      setErrorMessage(null);
      setTimeout(() => setStatusMessage(null), 4000);
    }
  }, []);

  // ─── Data loading ───────────────────────────────────────────────────────────
  // `silent` keeps background polls from flashing spinners over the UI.
  const loadDashboard = useCallback(async (silent = false) => {
    if (!silent) setRefreshing(true);
    try {
      const [assignment, pool, jobs] = await Promise.all([
        barbersApi.getActiveAssignment(),
        barbersApi.getOpenBookings({ limit: 50 }),
        barbersApi.getMyJobs({ limit: 50 }),
      ]);

      setActiveAssignment(assignment);
      setOpenBookings(pool.data);
      setPastJobs(jobs);

      // The server decides when the OTP step is available — never local state.
      // (Previously ARRIVED lived only in the browser and vanished on refresh.)
      if (assignment?.status !== 'ARRIVED') {
        setShowOtpForm(false);
      }
    } catch (err) {
      if (!silent) flash(apiErrorMessage(err, 'Could not load your dashboard.'), true);
    } finally {
      setLoading(false);
      if (!silent) setRefreshing(false);
    }
  }, [flash]);

  const loadProfile = useCallback(async () => {
    try {
      const data = await barbersApi.getMe();
      setProfile(data);
      setAcceptingBookings(data.autoAllocationEnabled);
      if (data.currentLocation?.coordinates) {
        setLongitude(data.currentLocation.coordinates[0]);
        setLatitude(data.currentLocation.coordinates[1]);
      }
    } catch (err) {
      // No silent fake profile — the barber needs to know their profile is missing.
      flash(apiErrorMessage(err, 'Could not load your barber profile.'), true);
    }
  }, [flash]);

  useEffect(() => {
    void loadProfile();
    void loadDashboard();
  }, [loadProfile, loadDashboard]);

  // Poll so admin assignments and new customer bookings appear on their own.
  const pollRef = useRef(loadDashboard);
  pollRef.current = loadDashboard;
  useEffect(() => {
    const id = setInterval(() => void pollRef.current(true), POLL_INTERVAL_MS);
    return () => clearInterval(id);
  }, []);

  // ─── Actions ────────────────────────────────────────────────────────────────
  const runAction = async (key: string, fn: () => Promise<string>) => {
    setBusyAction(key);
    try {
      flash(await fn());
      await loadDashboard(true);
    } catch (err) {
      flash(apiErrorMessage(err, 'That action could not be completed.'), true);
      await loadDashboard(true); // resync — the server is the source of truth
    } finally {
      setBusyAction(null);
    }
  };

  const handleToggleAccepting = async () => {
    const next = !acceptingBookings;
    setAcceptingBookings(next); // optimistic
    try {
      const updated = await barbersApi.setAcceptingBookings(next);
      setAcceptingBookings(updated.autoAllocationEnabled);
      flash(next ? 'You are now visible to customers.' : 'You are hidden from new customers.');
    } catch (err) {
      setAcceptingBookings(!next); // revert
      flash(apiErrorMessage(err, 'Could not update your availability.'), true);
    }
  };

  const handleUpdateLocation = () =>
    runAction('location', async () => {
      await barbersApi.updateLocation(latitude, longitude);
      return 'Location updated.';
    });

  const handleClaim = async (booking: Booking) => {
    setClaimingBookingId(booking._id);
    try {
      await barbersApi.claimBooking(booking._id);
      flash(`Booking #${booking.bookingNumber} is yours. Customer details unlocked.`);
      await loadDashboard(true);
    } catch (err) {
      // A rival barber or an admin may have taken it a moment ago — refresh the
      // pool so the stale card disappears rather than sitting there unclaimable.
      flash(apiErrorMessage(err, 'Could not claim this booking.'), true);
      await loadDashboard(true);
    } finally {
      setClaimingBookingId(null);
    }
  };

  const handleReject = () =>
    runAction('reject', async () => {
      await assignmentApi.reject(
        activeAssignment!._id,
        rejectReason || 'Barber unavailable at the requested time',
      );
      setRejectModalOpen(false);
      setRejectReason('');
      return 'Offer declined. The booking is back in the open pool.';
    });

  const handleCancelJob = () =>
    runAction('cancel', async () => {
      await assignmentApi.cancel(
        activeAssignment!._id,
        cancelReason || 'Barber cancelled due to an emergency',
      );
      setCancelModalOpen(false);
      setCancelReason('');
      return 'Job cancelled. The booking has returned to the open pool.';
    });

  const handleVerifyOtp = async () => {
    const otp = otpDigits.join('');
    if (otp.length !== 6) {
      setOtpError('Enter all 6 digits');
      return;
    }
    const booking = bookingOf(activeAssignment);
    if (!booking) return;

    setOtpVerifying(true);
    setOtpError(null);
    try {
      await bookingApi.verifyOtp(booking._id, otp);
      setShowOtpForm(false);
      setOtpDigits(['', '', '', '', '', '']);
      flash('Code verified. The service is now in progress.');
      await loadDashboard(true);
    } catch (err) {
      setOtpError(apiErrorMessage(err, 'Incorrect code. Please try again.'));
      setOtpDigits(['', '', '', '', '', '']);
      setTimeout(() => document.getElementById('otp-input-0')?.focus(), 100);
    } finally {
      setOtpVerifying(false);
    }
  };

  // ─── OTP input handlers ─────────────────────────────────────────────────────
  const handleOtpChange = (index: number, raw: string) => {
    const value = raw.slice(-1);
    if (value && !/^\d$/.test(value)) return;
    const next = [...otpDigits];
    next[index] = value;
    setOtpDigits(next);
    setOtpError(null);
    if (value && index < 5) document.getElementById(`otp-input-${index + 1}`)?.focus();
  };

  const handleOtpKeyDown = (index: number, e: React.KeyboardEvent) => {
    if (e.key === 'Backspace' && !otpDigits[index] && index > 0) {
      document.getElementById(`otp-input-${index - 1}`)?.focus();
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

  // ─── Derived ────────────────────────────────────────────────────────────────
  const status = activeAssignment?.status;
  const hasPendingOffer = status === 'OFFERED';
  const hasLiveJob = !!status && IN_FLIGHT.includes(status);
  const completedJobs = pastJobs.filter((j) => j.status === 'COMPLETED');
  const earnings = completedJobs.reduce(
    (sum, j) => sum + (bookingOf(j)?.serviceSnapshot?.price ?? 0),
    0,
  );

  if (loading) {
    return (
      <div className="py-24 text-center space-y-3">
        <Loader2 className="w-8 h-8 text-[#ff6c4c] animate-spin mx-auto" />
        <p className="text-xs text-gray-400">Loading your dashboard…</p>
      </div>
    );
  }

  return (
    <div className="py-12 max-w-7xl mx-auto px-4 md:px-8 space-y-8">

      {/* ─── Header ──────────────────────────────────────────────────────────── */}
      <div className="glass-card p-6 rounded-3xl border-[#ff6c4c]/20 flex flex-col md:flex-row items-start md:items-center justify-between gap-6">
        <div className="flex items-center gap-4">
          <div className="w-16 h-16 rounded-2xl gradient-flow flex items-center justify-center font-bold text-2xl text-white shadow-xl shadow-[#ff6c4c]/20">
            {user?.name?.charAt(0) ?? 'B'}
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h2 className="text-2xl font-extrabold font-outfit text-white">
                {user?.name ?? 'Barber Partner'}
              </h2>
              <span className="px-2.5 py-0.5 rounded-full bg-[#ff6c4c]/20 text-[#ff8a6a] text-xs border border-[#ff6c4c]/30 flex items-center gap-1">
                <ShieldCheck className="w-3.5 h-3.5" />
                Verified Partner
              </span>
            </div>
            <p className="text-xs text-gray-400 mt-1">
              {profile
                ? `${profile.rating.toFixed(2)} ★ • ${profile.totalCompletedJobs} completed jobs • ${profile.totalReviews} reviews`
                : 'Profile unavailable'}
            </p>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          <button
            onClick={() => void loadDashboard()}
            disabled={refreshing}
            className="px-4 py-3 rounded-2xl bg-[#13151f] hover:bg-[#1b1f2e] border border-white/[0.08] text-white text-xs font-bold transition-all flex items-center gap-2 active:scale-95"
          >
            <RefreshCw className={`w-4 h-4 text-[#ff6c4c] ${refreshing ? 'animate-spin' : ''}`} />
            <span>Refresh</span>
          </button>

          <div className="flex items-center gap-4 bg-[#13151f] p-2.5 rounded-2xl border border-white/[0.08]">
            <div>
              <span className="text-xs font-bold text-white block">Accepting Bookings</span>
              <span className="text-[10px] text-gray-400">
                {acceptingBookings ? 'Visible to customers' : 'Hidden from customers'}
              </span>
            </div>
            <button
              onClick={handleToggleAccepting}
              className="text-[#ff6c4c] hover:text-[#ff8a6a] transition-colors"
              aria-label="Toggle accepting bookings"
            >
              {acceptingBookings
                ? <ToggleRight className="w-9 h-9 text-[#ff6c4c]" />
                : <ToggleLeft className="w-9 h-9 text-gray-600" />}
            </button>
          </div>
        </div>
      </div>

      {statusMessage && (
        <div className="p-3.5 rounded-xl bg-emerald-500/10 border border-emerald-500/30 text-emerald-300 text-xs flex items-center gap-2">
          <CheckCircle2 className="w-4 h-4" />
          <span>{statusMessage}</span>
        </div>
      )}
      {errorMessage && (
        <div className="p-3.5 rounded-xl bg-red-500/10 border border-red-500/30 text-red-300 text-xs flex items-center gap-2">
          <AlertCircle className="w-4 h-4 shrink-0" />
          <span>{errorMessage}</span>
        </div>
      )}

      {/* ─── Location ────────────────────────────────────────────────────────── */}
      <div className="glass-card p-6 rounded-3xl border-white/10 space-y-4 max-w-xl">
        <div className="flex items-center gap-2">
          <MapPin className="w-5 h-5 text-[#ff6c4c]" />
          <h3 className="text-lg font-bold font-outfit text-white">Service Area Location</h3>
        </div>
        <p className="text-xs text-gray-400">
          Customers searching nearby are matched against these coordinates.
        </p>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <span className="text-[10px] text-gray-400 block mb-1">Latitude</span>
            <input
              type="number" step="any" value={latitude}
              onChange={(e) => setLatitude(Number(e.target.value))}
              className="w-full glass-input px-3 py-2 rounded-xl text-xs"
            />
          </div>
          <div>
            <span className="text-[10px] text-gray-400 block mb-1">Longitude</span>
            <input
              type="number" step="any" value={longitude}
              onChange={(e) => setLongitude(Number(e.target.value))}
              className="w-full glass-input px-3 py-2 rounded-xl text-xs"
            />
          </div>
        </div>
        <button
          onClick={handleUpdateLocation}
          disabled={busyAction === 'location'}
          className="w-full py-2.5 rounded-xl bg-[#13151f] hover:bg-[#1b1f2e] text-xs font-semibold text-[#ff8a6a] border border-[#ff6c4c]/30 transition-all flex items-center justify-center gap-2"
        >
          <Navigation className="w-4 h-4" />
          {busyAction === 'location' ? 'Saving…' : 'Update Location'}
        </button>
      </div>

      {/* ─── Open pool ───────────────────────────────────────────────────────── */}
      <div className="glass-card p-6 md:p-8 rounded-3xl border-[#ff6c4c]/30 space-y-6 shadow-2xl">
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 pb-4 border-b border-white/10">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl gradient-flow flex items-center justify-center text-white shadow-lg shadow-[#ff6c4c]/20">
              <Inbox className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-xl font-extrabold font-outfit text-white">
                  Available Customer Requests
                </h3>
                <span className="px-2.5 py-0.5 rounded-full bg-[#ff6c4c]/20 text-[#ff8a6a] text-[10px] font-bold border border-[#ff6c4c]/30">
                  {openBookings.length} waiting
                </span>
              </div>
              <p className="text-xs text-gray-400 mt-0.5">
                Unassigned bookings — first to claim gets the job
              </p>
            </div>
          </div>
        </div>

        {openBookings.length === 0 ? (
          <div className="p-8 rounded-2xl bg-[#13151f]/60 border border-white/5 text-center space-y-2">
            <CheckCircle2 className="w-8 h-8 text-emerald-400 mx-auto" />
            <h4 className="font-bold text-white text-sm">No Requests Waiting</h4>
            <p className="text-xs text-gray-400">
              Every current booking has a barber. New customer requests appear here automatically.
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {openBookings.map((b) => {
              const customer = typeof b.customerId === 'object' ? b.customerId : null;
              const blocked = hasLiveJob || hasPendingOffer;
              const claiming = claimingBookingId === b._id;

              return (
                <div
                  key={b._id}
                  className="bg-[#13151f]/90 p-5 rounded-2xl border border-white/10 hover:border-[#ff6c4c]/40 transition-all space-y-4 shadow-lg flex flex-col justify-between"
                >
                  <div className="space-y-3">
                    <div className="flex items-start justify-between gap-2 pb-2 border-b border-white/5">
                      <div className="min-w-0">
                        <span className="font-bold text-white text-sm block truncate">
                          {customer?.name ?? 'Customer'}
                        </span>
                        <span className="text-[10px] text-gray-400 font-mono">#{b.bookingNumber}</span>
                      </div>
                      <div className="text-right shrink-0">
                        <span className="text-[#ff8a6a] font-extrabold text-base block">
                          ₹{b.serviceSnapshot.price}
                        </span>
                        <span className="text-[10px] text-gray-400">
                          {b.serviceSnapshot.durationMinutes} mins
                        </span>
                      </div>
                    </div>

                    <div className="space-y-1.5 text-xs">
                      <div className="font-semibold text-[#ff8a6a] flex items-center gap-1.5">
                        <Scissors className="w-3.5 h-3.5" />
                        <span>{b.serviceSnapshot.name}</span>
                      </div>
                      <div className="text-gray-400 text-[11px] flex items-center gap-1.5">
                        <Clock className="w-3.5 h-3.5 text-[#ff6c4c]" />
                        <span>{b.scheduledDate} at {b.startTime}</span>
                      </div>
                      <div className="text-gray-400 text-[11px] flex items-start gap-1.5 pt-0.5">
                        <MapPin className="w-3.5 h-3.5 text-[#ff6c4c] shrink-0 mt-0.5" />
                        <span className="line-clamp-2">
                          {b.addressSnapshot?.formattedAddress ?? 'Address shared after claiming'}
                        </span>
                      </div>
                    </div>
                  </div>

                  <button
                    onClick={() => void handleClaim(b)}
                    disabled={blocked || claiming}
                    className={`w-full py-2.5 rounded-xl text-xs font-bold transition-all flex items-center justify-center gap-2 ${
                      blocked
                        ? 'bg-white/5 text-gray-500 cursor-not-allowed border border-white/5'
                        : claiming
                          ? 'bg-[#ff6c4c]/30 text-[#ff8a6a] cursor-wait'
                          : 'gradient-flow text-white font-extrabold shadow-md shadow-[#ff6c4c]/20 active:scale-95'
                    }`}
                  >
                    <Sparkles className="w-3.5 h-3.5" />
                    <span>
                      {blocked ? 'Finish your current job first' : claiming ? 'Claiming…' : 'Accept & Claim Job'}
                    </span>
                  </button>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* ─── Pending offer (customer chose this barber) ──────────────────────── */}
      {hasPendingOffer && activeAssignment && (() => {
        const booking = bookingOf(activeAssignment);
        const customer = booking && typeof booking.customerId === 'object' ? booking.customerId : null;

        return (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/85 backdrop-blur-md">
            <div className="glass-card rounded-3xl p-6 md:p-8 w-full max-w-md border-[#ff6c4c]/40 space-y-6 text-center shadow-2xl">
              <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-[#ff6c4c]/20 text-[#ff8a6a] text-xs font-bold border border-[#ff6c4c]/30">
                <Clock className="w-3.5 h-3.5" />
                <span>Direct Booking Request</span>
              </div>

              <div>
                <h3 className="text-xl font-extrabold font-outfit text-white">
                  A customer chose you
                </h3>
                {booking && (
                  <>
                    <p className="text-xs text-[#ff8a6a] font-semibold mt-1">
                      {booking.serviceSnapshot.name} • ₹{booking.serviceSnapshot.price} ({booking.serviceSnapshot.durationMinutes} mins)
                    </p>
                    <p className="text-[11px] text-gray-400 mt-1">
                      Scheduled for {booking.scheduledDate} at {booking.startTime}
                    </p>
                  </>
                )}
              </div>

              <div className="bg-[#13151f]/90 p-4 rounded-2xl border border-white/10 text-left space-y-3 text-xs">
                <div>
                  <span className="text-[10px] text-gray-400 uppercase font-semibold block">Client</span>
                  <span className="font-bold text-white text-sm">{customer?.name ?? 'Customer'}</span>
                </div>
                <div>
                  <span className="text-[10px] text-gray-400 uppercase font-semibold flex items-center gap-1">
                    <MapPin className="w-3 h-3 text-[#ff6c4c]" />
                    Doorstep Address
                  </span>
                  <span className="text-gray-300 leading-relaxed block mt-0.5">
                    {booking?.addressSnapshot?.formattedAddress ?? 'Full address unlocks on accept'}
                  </span>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3 pt-2">
                <button
                  onClick={() => setRejectModalOpen(true)}
                  className="py-3 rounded-xl bg-red-500/10 hover:bg-red-500/20 text-red-300 text-xs font-bold border border-red-500/30 transition-all flex items-center justify-center gap-1.5"
                >
                  <XCircle className="w-4 h-4" /> Decline
                </button>
                <button
                  onClick={() => void runAction('accept', async () => {
                    await assignmentApi.accept(activeAssignment._id);
                    return 'Job accepted. Head to the customer.';
                  })}
                  disabled={busyAction === 'accept'}
                  className="py-3 rounded-xl gradient-flow text-white text-xs font-extrabold shadow-lg shadow-[#ff6c4c]/30 flex items-center justify-center gap-1.5 active:scale-95"
                >
                  {busyAction === 'accept'
                    ? <Loader2 className="w-4 h-4 animate-spin" />
                    : <CheckCircle2 className="w-4 h-4" />}
                  Accept Job
                </button>
              </div>
            </div>
          </div>
        );
      })()}

      {/* ─── Active job ──────────────────────────────────────────────────────── */}
      {hasLiveJob && activeAssignment && (() => {
        const booking = bookingOf(activeAssignment);
        const customer = booking && typeof booking.customerId === 'object' ? booking.customerId : null;
        const phone = booking?.addressSnapshot?.contactPhone ?? customer?.phone ?? '';
        const coords = booking?.customerLocation?.coordinates;
        const mapsUrl = coords
          ? `https://www.google.com/maps/dir/?api=1&destination=${coords[1]},${coords[0]}`
          : null;

        return (
          <div className="glass-card p-6 md:p-8 rounded-3xl border-[#ff6c4c]/40 space-y-6 shadow-2xl">
            <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 pb-4 border-b border-white/10">
              <div className="flex items-center gap-3">
                <span className="w-3.5 h-3.5 rounded-full bg-emerald-400 animate-pulse" />
                <div>
                  <h3 className="text-xl font-extrabold font-outfit text-white flex items-center gap-2">
                    Active Job
                    <span className="text-[#ff8a6a] text-sm font-mono font-normal">
                      #{booking?.bookingNumber}
                    </span>
                  </h3>
                  <span className="text-xs text-gray-400">
                    Customer details and doorstep navigation unlocked
                  </span>
                </div>
              </div>
              <span className="px-3.5 py-1 rounded-full bg-[#ff6c4c]/20 border border-[#ff6c4c]/40 text-[#ff8a6a] text-xs font-bold uppercase tracking-wider">
                {activeAssignment.status.replace(/_/g, ' ')}
              </span>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 bg-[#13151f]/80 p-5 rounded-2xl border border-white/10">
              <div className="space-y-4">
                <div className="flex items-center gap-3.5">
                  <div className="w-12 h-12 rounded-2xl gradient-flow flex items-center justify-center text-white font-bold text-lg shadow-md">
                    {(customer?.name ?? 'C').charAt(0)}
                  </div>
                  <div>
                    <span className="text-[10px] text-gray-400 uppercase font-semibold tracking-wider block">
                      Customer
                    </span>
                    <h4 className="text-base font-bold text-white">{customer?.name ?? 'Customer'}</h4>
                    {phone && (
                      <a
                        href={`tel:${phone.replace(/\s+/g, '')}`}
                        className="inline-flex mt-1 px-3 py-1 rounded-xl bg-[#ff6c4c]/20 hover:bg-[#ff6c4c]/40 text-[#ff8a6a] hover:text-white border border-[#ff6c4c]/40 text-xs font-bold items-center gap-1.5 transition-all"
                      >
                        <Phone className="w-3.5 h-3.5" />
                        <span>Call {phone}</span>
                      </a>
                    )}
                  </div>
                </div>

                {booking && (
                  <div className="pt-2 border-t border-white/5 space-y-1">
                    <span className="text-[10px] text-gray-400 uppercase font-semibold tracking-wider block">
                      Service
                    </span>
                    <div className="flex items-center justify-between text-xs">
                      <span className="font-bold text-white">{booking.serviceSnapshot.name}</span>
                      <span className="text-[#ff8a6a] font-extrabold text-sm">
                        ₹{booking.serviceSnapshot.price}
                      </span>
                    </div>
                    <div className="flex items-center gap-1 text-[11px] text-gray-400">
                      <Calendar className="w-3 h-3 text-[#ff6c4c]" />
                      <span>{booking.scheduledDate} at {booking.startTime}</span>
                    </div>
                  </div>
                )}
              </div>

              <div className="space-y-3.5 flex flex-col justify-between border-t lg:border-t-0 lg:border-l border-white/10 lg:pl-6 pt-4 lg:pt-0">
                <div>
                  <span className="text-[10px] text-gray-400 uppercase font-semibold tracking-wider mb-1 flex items-center gap-1">
                    <MapPin className="w-3.5 h-3.5 text-[#ff6c4c]" />
                    Doorstep Address
                  </span>
                  <div className="text-xs text-gray-200 leading-relaxed bg-black/30 p-3 rounded-xl border border-white/5 space-y-1">
                    {booking?.addressSnapshot?.houseNumber && (
                      <span className="block font-bold text-[#ff8a6a]">
                        🏠 {booking.addressSnapshot.houseNumber}
                      </span>
                    )}
                    {booking?.addressSnapshot?.landmark && (
                      <span className="block text-gray-400 text-[11px]">
                        📍 {booking.addressSnapshot.landmark}
                      </span>
                    )}
                    <p className="text-gray-300 text-[11px]">
                      {booking?.addressSnapshot?.formattedAddress
                        ?? (coords ? `GPS: ${coords[1].toFixed(5)}, ${coords[0].toFixed(5)}` : 'Address unavailable')}
                    </p>
                  </div>
                </div>

                {mapsUrl && (
                  <a
                    href={mapsUrl} target="_blank" rel="noopener noreferrer"
                    className="w-full py-2.5 px-4 rounded-xl bg-[#ff6c4c]/20 hover:bg-[#ff6c4c]/40 border border-[#ff6c4c]/40 text-[#ff8a6a] hover:text-white text-xs font-bold flex items-center justify-center gap-2 transition-all"
                  >
                    <Navigation className="w-4 h-4" />
                    <span>Open in Google Maps</span>
                    <ExternalLink className="w-3 h-3 opacity-70" />
                  </a>
                )}
              </div>
            </div>

            {/* Lifecycle steps — enabled strictly by the server-side status */}
            <div className="grid grid-cols-1 md:grid-cols-4 gap-3 pt-2">
              <button
                onClick={() => void runAction('journey', async () => {
                  await assignmentApi.startJourney(activeAssignment._id);
                  return 'Journey started.';
                })}
                disabled={status !== 'ACCEPTED' || busyAction === 'journey'}
                className={`py-3.5 rounded-2xl text-xs font-bold border transition-all flex items-center justify-center gap-2 ${
                  status === 'ACCEPTED'
                    ? 'bg-[#ff6c4c]/20 border-[#ff6c4c]/40 text-[#ff8a6a] hover:bg-[#ff6c4c] hover:text-white'
                    : 'bg-white/5 border-white/10 text-gray-500 cursor-not-allowed'
                }`}
              >
                <Navigation className="w-4 h-4" /> 1. On My Way
              </button>

              <button
                onClick={() => void runAction('arrive', async () => {
                  await assignmentApi.arrive(activeAssignment._id);
                  return 'Arrival recorded. Verification code sent to the customer.';
                })}
                disabled={!(status === 'ACCEPTED' || status === 'EN_ROUTE') || busyAction === 'arrive'}
                className={`py-3.5 rounded-2xl text-xs font-bold border transition-all flex items-center justify-center gap-2 ${
                  status === 'ACCEPTED' || status === 'EN_ROUTE'
                    ? 'bg-[#ff6c4c]/20 border-[#ff6c4c]/40 text-[#ff8a6a] hover:bg-[#ff6c4c] hover:text-white'
                    : 'bg-white/5 border-white/10 text-gray-500 cursor-not-allowed'
                }`}
              >
                <MapPin className="w-4 h-4" /> 2. Arrived
              </button>

              <button
                onClick={() => {
                  setShowOtpForm(true);
                  setOtpDigits(['', '', '', '', '', '']);
                  setOtpError(null);
                  setTimeout(() => document.getElementById('otp-input-0')?.focus(), 150);
                }}
                disabled={status !== 'ARRIVED'}
                className={`py-3.5 rounded-2xl text-xs font-bold border transition-all flex items-center justify-center gap-2 ${
                  status === 'ARRIVED'
                    ? 'bg-[#ff6c4c]/30 border-[#ff6c4c]/50 text-[#ff8a6a] hover:bg-[#ff6c4c] hover:text-white animate-pulse'
                    : status === 'IN_PROGRESS'
                      ? 'bg-emerald-500/20 border-emerald-500/40 text-emerald-300 cursor-default'
                      : 'bg-white/5 border-white/10 text-gray-500 cursor-not-allowed'
                }`}
              >
                <KeyRound className="w-4 h-4" />
                {status === 'IN_PROGRESS' ? 'Verified' : '3. Enter OTP'}
              </button>

              <button
                onClick={() => void runAction('complete', async () => {
                  await assignmentApi.complete(activeAssignment._id);
                  return 'Job completed.';
                })}
                disabled={status !== 'IN_PROGRESS' || busyAction === 'complete'}
                className={`py-3.5 rounded-2xl text-xs font-bold border transition-all flex items-center justify-center gap-2 ${
                  status === 'IN_PROGRESS'
                    ? 'bg-emerald-500/20 border-emerald-500/40 text-emerald-300 hover:bg-emerald-500 hover:text-black'
                    : 'bg-white/5 border-white/10 text-gray-500 cursor-not-allowed'
                }`}
              >
                <CheckCircle2 className="w-4 h-4" /> 4. Complete
              </button>
            </div>

            <div className="flex items-center justify-between pt-2 border-t border-white/5">
              <span className="text-[11px] text-gray-400">Emergency or transport breakdown?</span>
              <button
                onClick={() => setCancelModalOpen(true)}
                className="px-3 py-1.5 rounded-xl bg-red-500/10 hover:bg-red-500/20 text-red-300 border border-red-500/30 text-xs font-bold transition-all flex items-center gap-1.5"
              >
                <XCircle className="w-3.5 h-3.5" /> Cancel Job
              </button>
            </div>
          </div>
        );
      })()}

      {/* ─── OTP modal ───────────────────────────────────────────────────────── */}
      {showOtpForm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/85 backdrop-blur-md">
          <div className="glass-card rounded-3xl p-8 w-full max-w-md border-[#ff6c4c]/40 space-y-6 text-center shadow-2xl">
            <div className="w-20 h-20 rounded-full bg-[#ff6c4c]/20 border-2 border-[#ff6c4c]/40 flex items-center justify-center mx-auto">
              <KeyRound className="w-10 h-10 text-[#ff6c4c]" />
            </div>
            <div>
              <h3 className="text-xl font-bold font-outfit text-white">Enter Service OTP</h3>
              <p className="text-xs text-gray-400 mt-2 leading-relaxed">
                Ask the customer for their{' '}
                <span className="text-[#ff8a6a] font-semibold">6-digit verification code</span>
              </p>
            </div>

            <div className="flex justify-center gap-2" onPaste={handleOtpPaste}>
              {otpDigits.map((digit, i) => (
                <input
                  key={i}
                  id={`otp-input-${i}`}
                  type="text" inputMode="numeric" maxLength={1} value={digit}
                  onChange={(e) => handleOtpChange(i, e.target.value)}
                  onKeyDown={(e) => handleOtpKeyDown(i, e)}
                  className={`w-12 h-14 rounded-xl text-center text-xl font-extrabold border-2 bg-[#13151f] outline-none transition-all ${
                    otpError
                      ? 'border-red-500/60 text-red-300'
                      : digit
                        ? 'border-[#ff6c4c]/60 text-[#ff8a6a]'
                        : 'border-white/20 text-white focus:border-[#ff6c4c]/60'
                  }`}
                />
              ))}
            </div>

            {otpError && (
              <div className="p-3 rounded-xl bg-red-500/10 border border-red-500/30 text-red-300 text-xs flex items-center gap-2">
                <XCircle className="w-4 h-4 shrink-0" />
                <span>{otpError}</span>
              </div>
            )}

            <div className="grid grid-cols-2 gap-3 pt-2">
              <button
                onClick={() => { setShowOtpForm(false); setOtpDigits(['', '', '', '', '', '']); setOtpError(null); }}
                className="py-3 rounded-xl bg-white/5 hover:bg-white/10 text-gray-300 text-xs font-bold border border-white/10 transition-all"
              >
                Cancel
              </button>
              <button
                onClick={() => void handleVerifyOtp()}
                disabled={otpVerifying || otpDigits.some((d) => !d)}
                className={`py-3 rounded-xl text-xs font-extrabold shadow-lg transition-all flex items-center justify-center gap-2 ${
                  otpVerifying || otpDigits.some((d) => !d)
                    ? 'bg-[#ff6c4c]/30 text-[#ff8a6a]/60 cursor-not-allowed'
                    : 'gradient-flow text-white shadow-[#ff6c4c]/30'
                }`}
              >
                {otpVerifying
                  ? <><Loader2 className="w-4 h-4 animate-spin" /> Verifying…</>
                  : <><KeyRound className="w-4 h-4" /> Verify</>}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ─── Decline / cancel modals ─────────────────────────────────────────── */}
      {(rejectModalOpen || cancelModalOpen) && (() => {
        const isReject = rejectModalOpen;
        const reason = isReject ? rejectReason : cancelReason;
        const setReason = isReject ? setRejectReason : setCancelReason;
        const presets = isReject
          ? ['Schedule conflict', 'Transport issue', 'Location too far', 'Personal emergency', 'Equipment unavailable']
          : ['Transport issue', 'Medical emergency', 'Address unreachable', 'Equipment damage', 'Severe weather'];
        const busy = busyAction === (isReject ? 'reject' : 'cancel');

        return (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/85 backdrop-blur-md">
            <div className="glass-card rounded-3xl p-6 md:p-8 w-full max-w-md border-red-500/40 space-y-5 text-left shadow-2xl">
              <div className="flex items-center justify-between pb-3 border-b border-white/10">
                <h3 className="text-lg font-bold text-white flex items-center gap-2">
                  <XCircle className="w-5 h-5 text-red-400" />
                  {isReject ? 'Decline Request' : 'Cancel Accepted Job'}
                </h3>
                <button
                  onClick={() => { setRejectModalOpen(false); setCancelModalOpen(false); }}
                  className="p-1 rounded-lg text-gray-400 hover:text-white"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              <div className="p-3 rounded-2xl bg-[#ff6c4c]/10 border border-[#ff6c4c]/30 text-[#ff8a6a] text-xs leading-relaxed">
                This booking returns to the open pool so another barber — or the admin —
                can take it. The customer keeps their appointment.
              </div>

              <div className="flex flex-wrap gap-2">
                {presets.map((preset) => (
                  <button
                    key={preset}
                    onClick={() => setReason(preset)}
                    className={`px-3 py-1.5 rounded-xl text-[11px] font-semibold transition-all border ${
                      reason === preset
                        ? 'bg-red-500/30 text-red-200 border-red-500/60 font-bold'
                        : 'bg-[#13151f] text-gray-400 border-white/5 hover:border-white/20'
                    }`}
                  >
                    {preset}
                  </button>
                ))}
              </div>

              <textarea
                value={reason}
                onChange={(e) => setReason(e.target.value)}
                placeholder="Or write a specific reason…"
                rows={3}
                className="w-full p-3.5 rounded-2xl bg-[#0b0c10] border border-white/10 text-xs text-white placeholder-gray-500 focus:border-red-500/60 outline-none"
              />

              <div className="grid grid-cols-2 gap-3 pt-2">
                <button
                  onClick={() => { setRejectModalOpen(false); setCancelModalOpen(false); }}
                  className="py-3 rounded-xl bg-white/5 hover:bg-white/10 text-gray-300 text-xs font-bold border border-white/10"
                >
                  Go Back
                </button>
                <button
                  onClick={() => void (isReject ? handleReject() : handleCancelJob())}
                  disabled={busy}
                  className="py-3 rounded-xl bg-red-600 hover:bg-red-500 text-white text-xs font-bold transition-all flex items-center justify-center gap-2 shadow-lg shadow-red-600/30"
                >
                  {busy ? <Loader2 className="w-4 h-4 animate-spin" /> : <XCircle className="w-4 h-4" />}
                  Confirm
                </button>
              </div>
            </div>
          </div>
        );
      })()}

      {/* ─── History ─────────────────────────────────────────────────────────── */}
      <div className="glass-card p-6 md:p-8 rounded-3xl border-white/10 space-y-6">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-2xl bg-emerald-500/20 text-emerald-400 flex items-center justify-center">
            <CheckCircle2 className="w-5 h-5" />
          </div>
          <div>
            <h3 className="text-xl font-bold font-outfit text-white">Job History & Earnings</h3>
            <p className="text-xs text-gray-400">Doorstep services you have fulfilled</p>
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <div className="bg-[#13151f]/80 p-4 rounded-2xl border border-white/5 space-y-1">
            <span className="text-[10px] text-gray-400 uppercase font-semibold">Completed Jobs</span>
            <div className="text-2xl font-extrabold text-white font-outfit">{completedJobs.length}</div>
          </div>
          <div className="bg-[#13151f]/80 p-4 rounded-2xl border border-white/5 space-y-1">
            <span className="text-[10px] text-gray-400 uppercase font-semibold">Earnings (listed)</span>
            <div className="text-2xl font-extrabold text-[#ff8a6a] font-outfit">
              ₹{earnings.toLocaleString('en-IN')}
            </div>
          </div>
          <div className="bg-[#13151f]/80 p-4 rounded-2xl border border-white/5 space-y-1">
            <span className="text-[10px] text-gray-400 uppercase font-semibold">Rating</span>
            <div className="text-2xl font-extrabold text-white font-outfit">
              {profile ? `${profile.rating.toFixed(2)} ★` : '—'}
            </div>
            <span className="text-[10px] text-gray-400">
              {profile ? `${profile.totalReviews} reviews` : ''}
            </span>
          </div>
        </div>

        {pastJobs.length === 0 ? (
          <div className="p-8 rounded-2xl bg-[#13151f]/60 border border-white/5 text-center">
            <p className="text-xs text-gray-400">
              No jobs yet. Claim a request above to get started.
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs text-gray-300">
              <thead className="bg-[#13151f]/80 uppercase tracking-wider text-[10px] text-gray-400">
                <tr>
                  <th className="px-4 py-3 rounded-l-xl">Client & Booking</th>
                  <th className="px-4 py-3">Service</th>
                  <th className="px-4 py-3">Date & Time</th>
                  <th className="px-4 py-3">Address</th>
                  <th className="px-4 py-3">Price</th>
                  <th className="px-4 py-3 rounded-r-xl">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/5">
                {pastJobs.map((job) => {
                  const b = bookingOf(job);
                  const cust = b && typeof b.customerId === 'object' ? b.customerId : null;
                  const done = job.status === 'COMPLETED';

                  return (
                    <tr key={job._id} className="hover:bg-white/5 transition-colors">
                      <td className="px-4 py-3.5">
                        <span className="font-bold text-white block">{cust?.name ?? 'Client'}</span>
                        <span className="text-[10px] text-gray-400 font-mono">
                          #{b?.bookingNumber ?? job._id.slice(-6)}
                        </span>
                      </td>
                      <td className="px-4 py-3.5 font-semibold text-[#ff8a6a]">
                        {b?.serviceSnapshot?.name ?? '—'}
                      </td>
                      <td className="px-4 py-3.5 text-gray-300">
                        {b ? `${b.scheduledDate} ${b.startTime}` : '—'}
                      </td>
                      <td className="px-4 py-3.5 max-w-xs truncate text-gray-400">
                        {b?.addressSnapshot?.formattedAddress ?? '—'}
                      </td>
                      <td className="px-4 py-3.5 text-[#ff8a6a] font-extrabold text-sm">
                        {b ? `₹${b.serviceSnapshot.price}` : '—'}
                      </td>
                      <td className="px-4 py-3.5">
                        <span className={`px-2.5 py-0.5 rounded-full border text-[10px] font-bold ${
                          done
                            ? 'bg-emerald-500/20 text-emerald-300 border-emerald-500/30'
                            : 'bg-white/5 text-gray-400 border-white/10'
                        }`}>
                          {job.status.replace(/_/g, ' ')}
                        </span>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
};
