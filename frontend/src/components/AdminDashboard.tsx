import React, { useState, useEffect, useCallback, useRef } from 'react';
import {
  ShieldCheck, Users, Calendar, IndianRupee, Activity, RefreshCw, CheckCircle2,
  Clock, UserCheck, MapPin, Scissors, AlertCircle, Ban, X, Loader2, Inbox,
} from 'lucide-react';
import type { AdminStats, BarberProfile, Booking, User } from '../types';
import { UNASSIGNED_STATUSES } from '../types';
import { adminApi, apiErrorMessage } from '../services/api';

interface AdminDashboardProps {
  user: User | null;
}

const POLL_INTERVAL_MS = 10000;

const TERMINAL: Booking['status'][] = [
  'COMPLETED', 'CUSTOMER_CANCELLED', 'ADMIN_CANCELLED', 'EXPIRED',
];

const statusChip = (status: Booking['status']): string => {
  if (status === 'COMPLETED') return 'bg-emerald-500/20 text-emerald-300 border-emerald-500/30';
  if (status === 'CONFIRMED' || status === 'IN_PROGRESS') return 'bg-[#ff6c4c]/20 text-[#ff8a6a] border-[#ff6c4c]/30';
  if (TERMINAL.includes(status)) return 'bg-red-500/20 text-red-300 border-red-500/30';
  return 'bg-amber-500/20 text-amber-300 border-amber-500/30';
};

export const AdminDashboard: React.FC<AdminDashboardProps> = ({ user }) => {
  const [stats, setStats] = useState<AdminStats | null>(null);
  const [barbers, setBarbers] = useState<BarberProfile[]>([]);
  const [bookings, setBookings] = useState<Booking[]>([]);

  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [statusMessage, setStatusMessage] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const [updatingBarberId, setUpdatingBarberId] = useState<string | null>(null);
  const [chosenBarber, setChosenBarber] = useState<Record<string, string>>({});
  const [assigningBookingId, setAssigningBookingId] = useState<string | null>(null);

  const [cancelModalOpen, setCancelModalOpen] = useState(false);
  const [cancellingBookingId, setCancellingBookingId] = useState<string | null>(null);
  const [cancelReason, setCancelReason] = useState('');
  const [isCancelling, setIsCancelling] = useState(false);

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

  // ─── Load ───────────────────────────────────────────────────────────────────
  const load = useCallback(async (silent = false) => {
    if (!silent) setRefreshing(true);
    try {
      const [statsRes, barberRes, bookingRes] = await Promise.all([
        adminApi.getStats(),
        adminApi.getBarbers({ limit: 100 }),
        adminApi.getBookings({ limit: 100 }),
      ]);
      setStats(statsRes);
      setBarbers(barberRes.data);
      setBookings(bookingRes.data);
    } catch (err) {
      if (!silent) flash(apiErrorMessage(err, 'Could not load platform data.'), true);
    } finally {
      setLoading(false);
      if (!silent) setRefreshing(false);
    }
  }, [flash]);

  useEffect(() => {
    void load();
  }, [load]);

  // Poll so new customer bookings show up without a manual refresh.
  const pollRef = useRef(load);
  pollRef.current = load;
  useEffect(() => {
    const id = setInterval(() => {
      if (!document.hidden) {
        void pollRef.current(true);
      }
    }, POLL_INTERVAL_MS);

    const handleVisibilityChange = () => {
      if (!document.hidden) {
        void pollRef.current(true);
      }
    };
    document.addEventListener('visibilitychange', handleVisibilityChange);

    return () => {
      clearInterval(id);
      document.removeEventListener('visibilitychange', handleVisibilityChange);
    };
  }, []);

  // ─── Actions ────────────────────────────────────────────────────────────────
  const handleToggleBarberStatus = async (barberId: string, currentStatus: string) => {
    const next = currentStatus === 'ACTIVE' ? 'INACTIVE' : 'ACTIVE';
    setUpdatingBarberId(barberId);
    try {
      await adminApi.updateBarberStatus(barberId, next);
      flash(`Barber set to ${next}.`);
      await load(true);
    } catch (err) {
      flash(apiErrorMessage(err, 'Could not update barber status.'), true);
    } finally {
      setUpdatingBarberId(null);
    }
  };

  const handleAssign = async (bookingId: string) => {
    const barberId = chosenBarber[bookingId];
    if (!barberId) {
      flash('Choose a barber from the dropdown first.', true);
      return;
    }
    setAssigningBookingId(bookingId);
    try {
      await adminApi.assignBarber(bookingId, barberId);
      flash('Barber assigned. The booking is confirmed and the customer has their code.');
      setChosenBarber((prev) => {
        const next = { ...prev };
        delete next[bookingId];
        return next;
      });
      await load(true);
    } catch (err) {
      // Surfaces real conflicts now: already claimed, slot clash, barber inactive.
      flash(apiErrorMessage(err, 'Could not assign this barber.'), true);
      await load(true);
    } finally {
      setAssigningBookingId(null);
    }
  };

  const handleCancelSubmit = async () => {
    if (!cancellingBookingId) return;
    setIsCancelling(true);
    try {
      await adminApi.cancelBooking(cancellingBookingId, cancelReason || 'Cancelled by administrator');
      flash('Booking cancelled. The customer has been notified.');
      setCancelModalOpen(false);
      setCancellingBookingId(null);
      setCancelReason('');
      await load(true);
    } catch (err) {
      flash(apiErrorMessage(err, 'Could not cancel this booking.'), true);
    } finally {
      setIsCancelling(false);
    }
  };

  // ─── Derived ────────────────────────────────────────────────────────────────
  const awaiting = bookings.filter((b) => UNASSIGNED_STATUSES.includes(b.status));
  const assignableBarbers = barbers.filter((b) => (b.status ?? 'ACTIVE') === 'ACTIVE');

  if (loading) {
    return (
      <div className="py-24 text-center space-y-3">
        <Loader2 className="w-8 h-8 text-[#ff6c4c] animate-spin mx-auto" />
        <p className="text-xs text-gray-400">Loading platform data…</p>
      </div>
    );
  }

  return (
    <div className="py-12 max-w-7xl mx-auto px-4 md:px-8 space-y-8">

      {/* ─── Header ──────────────────────────────────────────────────────────── */}
      <div className="glass-card p-6 rounded-3xl border-[#ff6c4c]/30 flex flex-col md:flex-row items-start md:items-center justify-between gap-6 shadow-2xl">
        <div className="flex items-center gap-4">
          <div className="w-16 h-16 rounded-2xl gradient-flow flex items-center justify-center text-white font-extrabold text-2xl shadow-xl shadow-[#ff6c4c]/20">
            👑
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h2 className="text-2xl font-extrabold font-outfit text-white">Administrator Portal</h2>
              <span className="px-2.5 py-0.5 rounded-full bg-[#ff6c4c]/20 text-[#ff8a6a] text-xs font-bold border border-[#ff6c4c]/40 flex items-center gap-1">
                <ShieldCheck className="w-3.5 h-3.5" />
                {user?.email ?? 'admin'}
              </span>
            </div>
            <p className="text-xs text-gray-400 mt-1">
              Booking oversight and manual barber allocation
            </p>
          </div>
        </div>

        <button
          onClick={() => void load()}
          disabled={refreshing}
          className="px-4 py-2.5 rounded-xl bg-[#13151f] hover:bg-[#1b1f2e] border border-white/[0.08] text-gray-200 text-xs font-bold flex items-center gap-2 transition-all"
        >
          <RefreshCw className={`w-3.5 h-3.5 text-[#ff6c4c] ${refreshing ? 'animate-spin' : ''}`} />
          Refresh
        </button>
      </div>

      {statusMessage && (
        <div className="p-3.5 rounded-xl bg-emerald-500/10 border border-emerald-500/30 text-emerald-300 text-xs flex items-center gap-2">
          <CheckCircle2 className="w-4 h-4 shrink-0" />
          <span>{statusMessage}</span>
        </div>
      )}
      {errorMessage && (
        <div className="p-3.5 rounded-xl bg-red-500/10 border border-red-500/30 text-red-300 text-xs flex items-center gap-2">
          <AlertCircle className="w-4 h-4 shrink-0" />
          <span>{errorMessage}</span>
        </div>
      )}

      {/* ─── Metric tiles — all real figures from GET /admin/stats ────────────── */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
        <div className="glass-card p-6 rounded-3xl border-white/10 space-y-3">
          <div className="flex items-center justify-between">
            <span className="text-xs text-gray-400 font-semibold uppercase tracking-wider">Completed Revenue</span>
            <div className="w-10 h-10 rounded-xl bg-[#ff6c4c]/20 text-[#ff8a6a] flex items-center justify-center">
              <IndianRupee className="w-5 h-5" />
            </div>
          </div>
          <div className="text-3xl font-extrabold font-outfit text-white">
            ₹{(stats?.completedRevenue ?? 0).toLocaleString('en-IN')}
          </div>
          <span className="text-[10px] text-gray-400">
            From {stats?.completedBookings ?? 0} completed bookings
          </span>
        </div>

        <div className="glass-card p-6 rounded-3xl border-white/10 space-y-3">
          <div className="flex items-center justify-between">
            <span className="text-xs text-gray-400 font-semibold uppercase tracking-wider">Registered Barbers</span>
            <div className="w-10 h-10 rounded-xl bg-[#ff6c4c]/20 text-[#ff8a6a] flex items-center justify-center">
              <Users className="w-5 h-5" />
            </div>
          </div>
          <div className="text-3xl font-extrabold font-outfit text-white">{stats?.totalBarbers ?? 0}</div>
          <span className="text-[10px] text-gray-400">{assignableBarbers.length} active and assignable</span>
        </div>

        <div className="glass-card p-6 rounded-3xl border-white/10 space-y-3">
          <div className="flex items-center justify-between">
            <span className="text-xs text-gray-400 font-semibold uppercase tracking-wider">Total Bookings</span>
            <div className="w-10 h-10 rounded-xl bg-[#ff6c4c]/20 text-[#ff8a6a] flex items-center justify-center">
              <Calendar className="w-5 h-5" />
            </div>
          </div>
          <div className="text-3xl font-extrabold font-outfit text-white">{stats?.totalBookings ?? 0}</div>
          <span className="text-[10px] text-gray-400">
            {stats?.completionRate ?? 0}% completion rate
          </span>
        </div>

        <div className="glass-card p-6 rounded-3xl border-white/10 space-y-3">
          <div className="flex items-center justify-between">
            <span className="text-xs text-gray-400 font-semibold uppercase tracking-wider">Awaiting Assignment</span>
            <div className="w-10 h-10 rounded-xl bg-amber-500/20 text-amber-400 flex items-center justify-center">
              <Inbox className="w-5 h-5" />
            </div>
          </div>
          <div className="text-3xl font-extrabold font-outfit text-white">
            {stats?.awaitingAssignment ?? 0}
          </div>
          <span className="text-[10px] text-gray-400">
            {stats?.inProgress ?? 0} in progress • {stats?.confirmed ?? 0} confirmed
          </span>
        </div>
      </div>

      {/* ─── Manual allocation console ───────────────────────────────────────── */}
      <div className="glass-card p-6 md:p-8 rounded-3xl border-[#ff6c4c]/30 space-y-6 shadow-2xl">
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-[#ff6c4c]/20 border border-[#ff6c4c]/30 text-[#ff8a6a] flex items-center justify-center">
              <UserCheck className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-xl font-bold font-outfit text-white">Manual Barber Allocation</h3>
              <p className="text-xs text-gray-400">
                Assign a barber directly. Barbers can also claim these from their own dashboard.
              </p>
            </div>
          </div>

          <span className={`px-3 py-1 rounded-full text-xs font-bold border ${
            awaiting.length > 0
              ? 'bg-amber-500/20 text-amber-300 border-amber-500/40'
              : 'bg-emerald-500/20 text-emerald-300 border-emerald-500/40'
          }`}>
            {awaiting.length} awaiting
          </span>
        </div>

        {awaiting.length === 0 ? (
          <div className="p-8 rounded-2xl bg-[#13151f]/60 border border-white/5 text-center space-y-2">
            <CheckCircle2 className="w-8 h-8 text-emerald-400 mx-auto" />
            <h4 className="font-bold text-white text-sm">All Bookings Assigned</h4>
            <p className="text-xs text-gray-400">No customer requests are waiting for a barber.</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {awaiting.map((b) => {
              const customer = typeof b.customerId === 'object' ? b.customerId : null;
              const choice = chosenBarber[b._id] ?? '';

              return (
                <div
                  key={b._id}
                  className="bg-[#13151f]/90 p-5 rounded-2xl border border-white/10 space-y-4 shadow-lg hover:border-[#ff6c4c]/40 transition-all"
                >
                  <div className="flex items-start justify-between gap-3 pb-3 border-b border-white/5">
                    <div className="min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="font-bold text-white text-sm truncate">
                          {customer?.name ?? 'Customer'}
                        </span>
                        <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-white/5 text-gray-400 shrink-0">
                          #{b.bookingNumber}
                        </span>
                      </div>
                      {customer?.phone && (
                        <span className="text-[11px] text-gray-400 block mt-0.5">📞 {customer.phone}</span>
                      )}
                    </div>
                    <div className="text-right shrink-0">
                      <span className="text-[#ff8a6a] font-extrabold text-sm block">
                        ₹{b.serviceSnapshot.price}
                      </span>
                      <span className="px-2 py-0.5 rounded-full bg-amber-500/20 text-amber-300 text-[9px] font-bold border border-amber-500/30">
                        {b.status}
                      </span>
                    </div>
                  </div>

                  <div className="space-y-1.5 text-xs">
                    <div className="flex items-center gap-1.5 text-[#ff8a6a] font-semibold">
                      <Scissors className="w-3.5 h-3.5" />
                      <span>{b.serviceSnapshot.name}</span>
                    </div>
                    <div className="flex items-center gap-1.5 text-gray-400 text-[11px]">
                      <Clock className="w-3.5 h-3.5 text-[#ff6c4c]" />
                      <span>{b.scheduledDate} at {b.startTime}</span>
                    </div>
                    <div className="flex items-start gap-1.5 text-gray-400 text-[11px] pt-1">
                      <MapPin className="w-3.5 h-3.5 text-[#ff6c4c] shrink-0 mt-0.5" />
                      <span className="line-clamp-2">
                        {b.addressSnapshot?.formattedAddress ?? 'No address on file'}
                      </span>
                    </div>
                    {b.cancellationReason && (
                      <div className="p-2 rounded-xl bg-red-500/10 border border-red-500/30 text-red-300 text-[11px] flex items-start gap-1.5">
                        <AlertCircle className="w-3.5 h-3.5 shrink-0 mt-0.5" />
                        <span>Previous barber declined: {b.cancellationReason}</span>
                      </div>
                    )}
                  </div>

                  <div className="pt-2 flex flex-col sm:flex-row items-stretch gap-2">
                    <select
                      value={choice}
                      onChange={(e) => setChosenBarber({ ...chosenBarber, [b._id]: e.target.value })}
                      className="w-full sm:flex-1 p-2.5 rounded-xl bg-[#0b0c10] border border-white/10 text-xs text-white outline-none focus:border-[#ff6c4c]"
                    >
                      <option value="">— Choose barber —</option>
                      {assignableBarbers.map((barber) => (
                        <option key={barber._id} value={barber._id}>
                          {barber.user?.name ?? 'Barber'} ({barber.rating.toFixed(1)}★ • {barber.totalCompletedJobs} jobs)
                        </option>
                      ))}
                    </select>

                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => void handleAssign(b._id)}
                        disabled={assigningBookingId === b._id || !choice}
                        className={`flex-1 sm:flex-initial px-4 py-2.5 rounded-xl text-xs font-bold transition-all flex items-center justify-center gap-1.5 shadow-md ${
                          assigningBookingId === b._id || !choice
                            ? 'bg-white/10 text-gray-500 cursor-not-allowed'
                            : 'gradient-flow text-white shadow-[#ff6c4c]/20 active:scale-95'
                        }`}
                      >
                        {assigningBookingId === b._id
                          ? <Loader2 className="w-3.5 h-3.5 animate-spin" />
                          : <UserCheck className="w-3.5 h-3.5" />}
                        <span>{assigningBookingId === b._id ? 'Assigning…' : 'Assign'}</span>
                      </button>

                      <button
                        onClick={() => {
                          setCancellingBookingId(b._id);
                          setCancelReason('Cancelled by administrator');
                          setCancelModalOpen(true);
                        }}
                        className="px-3 py-2.5 rounded-xl bg-red-500/10 hover:bg-red-500/20 text-red-300 border border-red-500/30 text-xs font-bold transition-all flex items-center gap-1 shrink-0"
                      >
                        <Ban className="w-3.5 h-3.5" />
                        <span>Cancel</span>
                      </button>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* ─── Barber network ─────────────────────────────────────────────────── */}
      <div className="glass-card p-6 rounded-3xl border-white/10 space-y-6">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Activity className="w-5 h-5 text-[#ff6c4c]" />
            <h3 className="text-lg font-bold font-outfit text-white">Barber Partner Network</h3>
          </div>
          <span className="text-xs text-gray-400">{barbers.length} registered</span>
        </div>

        {barbers.length === 0 ? (
          <div className="p-8 rounded-2xl bg-[#13151f]/60 border border-white/5 text-center">
            <p className="text-xs text-gray-400">
              No barber profiles yet. Register a barber, or run <code className="text-[#ff8a6a]">npm run seed</code>.
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs text-gray-300">
              <thead className="bg-[#13151f]/80 uppercase tracking-wider text-[10px] text-gray-400">
                <tr>
                  <th className="px-4 py-3 rounded-l-xl">Barber</th>
                  <th className="px-4 py-3">Rating</th>
                  <th className="px-4 py-3">Accepting</th>
                  <th className="px-4 py-3">Radius</th>
                  <th className="px-4 py-3">Completed</th>
                  <th className="px-4 py-3 rounded-r-xl">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/5">
                {barbers.map((b) => (
                  <tr key={b._id} className="hover:bg-white/5 transition-colors">
                    <td className="px-4 py-3.5">
                      <div className="flex items-center gap-2">
                        <div className="w-7 h-7 rounded-lg gradient-flow flex items-center justify-center text-white text-xs shrink-0">
                          {b.user?.name?.charAt(0) ?? 'B'}
                        </div>
                        <div className="min-w-0">
                          <span className="font-bold text-white block truncate">
                            {b.user?.name ?? 'Barber'}
                          </span>
                          <span className="text-[10px] text-gray-400 block truncate">
                            {b.user?.email ?? b.user?.phone ?? ''}
                          </span>
                        </div>
                      </div>
                    </td>
                    <td className="px-4 py-3.5 text-[#ff8a6a] font-bold">{b.rating.toFixed(1)} ★</td>
                    <td className="px-4 py-3.5">
                      <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold border ${
                        b.autoAllocationEnabled
                          ? 'bg-emerald-500/20 text-emerald-300 border-emerald-500/30'
                          : 'bg-white/5 text-gray-400 border-white/10'
                      }`}>
                        {b.autoAllocationEnabled ? 'YES' : 'NO'}
                      </span>
                    </td>
                    <td className="px-4 py-3.5">{b.serviceRadiusKm} KM</td>
                    <td className="px-4 py-3.5 text-gray-200 font-semibold">{b.totalCompletedJobs}</td>
                    <td className="px-4 py-3.5">
                      <button
                        onClick={() => void handleToggleBarberStatus(b._id, b.status ?? 'ACTIVE')}
                        disabled={updatingBarberId === b._id}
                        className={`px-3 py-1 rounded-full text-[10px] font-bold transition-all border ${
                          (b.status ?? 'ACTIVE') === 'ACTIVE'
                            ? 'bg-emerald-500/20 text-emerald-300 border-emerald-500/30 hover:bg-emerald-500/30'
                            : 'bg-red-500/20 text-red-300 border-red-500/30 hover:bg-red-500/30'
                        }`}
                      >
                        {updatingBarberId === b._id ? 'Updating…' : (b.status ?? 'ACTIVE')}
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* ─── All bookings ───────────────────────────────────────────────────── */}
      <div className="glass-card p-6 rounded-3xl border-white/10 space-y-6">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Clock className="w-5 h-5 text-[#ff6c4c]" />
            <h3 className="text-lg font-bold font-outfit text-white">All Bookings</h3>
          </div>
          <span className="text-xs text-gray-400">{bookings.length} shown</span>
        </div>

        {bookings.length === 0 ? (
          <div className="p-8 rounded-2xl bg-[#13151f]/60 border border-white/5 text-center">
            <p className="text-xs text-gray-400">No bookings yet.</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs text-gray-300">
              <thead className="bg-[#13151f]/80 uppercase tracking-wider text-[10px] text-gray-400">
                <tr>
                  <th className="px-4 py-3 rounded-l-xl">Booking</th>
                  <th className="px-4 py-3">Customer</th>
                  <th className="px-4 py-3">Service</th>
                  <th className="px-4 py-3">Scheduled</th>
                  <th className="px-4 py-3">Price</th>
                  <th className="px-4 py-3">Status</th>
                  <th className="px-4 py-3 rounded-r-xl text-right">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/5">
                {bookings.map((bk) => {
                  const customer = typeof bk.customerId === 'object' ? bk.customerId : null;
                  return (
                    <tr key={bk._id} className="hover:bg-white/5 transition-colors">
                      <td className="px-4 py-3.5 font-bold text-white font-mono text-[11px]">
                        {bk.bookingNumber}
                      </td>
                      <td className="px-4 py-3.5 text-gray-300">{customer?.name ?? '—'}</td>
                      <td className="px-4 py-3.5 text-[#ff8a6a]">{bk.serviceSnapshot.name}</td>
                      <td className="px-4 py-3.5 text-gray-300">
                        {bk.scheduledDate} at {bk.startTime}
                      </td>
                      <td className="px-4 py-3.5 text-[#ff8a6a] font-bold">
                        ₹{bk.serviceSnapshot.price}
                      </td>
                      <td className="px-4 py-3.5">
                        <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold border ${statusChip(bk.status)}`}>
                          {bk.status}
                        </span>
                      </td>
                      <td className="px-4 py-3.5 text-right">
                        {!TERMINAL.includes(bk.status) ? (
                          <button
                            onClick={() => {
                              setCancellingBookingId(bk._id);
                              setCancelReason('Cancelled by administrator');
                              setCancelModalOpen(true);
                            }}
                            className="px-2.5 py-1 rounded-lg bg-red-500/10 hover:bg-red-500/20 text-red-300 border border-red-500/30 text-[11px] font-bold transition-all"
                          >
                            Cancel
                          </button>
                        ) : (
                          <span className="text-[10px] text-gray-500">—</span>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* ─── Cancel modal ───────────────────────────────────────────────────── */}
      {cancelModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/85 backdrop-blur-md">
          <div className="glass-card rounded-3xl p-6 md:p-8 w-full max-w-md border-red-500/40 space-y-5 shadow-2xl">
            <div className="flex items-center justify-between pb-3 border-b border-white/10">
              <h3 className="text-lg font-bold text-white flex items-center gap-2">
                <Ban className="w-5 h-5 text-red-400" />
                Cancel Booking
              </h3>
              <button
                onClick={() => setCancelModalOpen(false)}
                className="p-1 rounded-lg text-gray-400 hover:text-white"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <p className="text-xs text-gray-300">
              The customer — and the assigned barber, if any — will be notified that an
              administrator cancelled this booking.
            </p>

            <textarea
              value={cancelReason}
              onChange={(e) => setCancelReason(e.target.value)}
              placeholder="e.g. Unserviceable location / duplicate booking"
              rows={3}
              className="w-full p-3.5 rounded-2xl bg-[#0b0c10] border border-white/10 text-xs text-white placeholder-gray-500 focus:border-red-500/60 outline-none"
            />

            <div className="grid grid-cols-2 gap-3 pt-2">
              <button
                onClick={() => setCancelModalOpen(false)}
                className="py-3 rounded-xl bg-white/5 hover:bg-white/10 text-gray-300 text-xs font-bold border border-white/10"
              >
                Keep Booking
              </button>
              <button
                onClick={() => void handleCancelSubmit()}
                disabled={isCancelling}
                className="py-3 rounded-xl bg-red-600 hover:bg-red-500 text-white text-xs font-bold transition-all flex items-center justify-center gap-2 shadow-lg shadow-red-600/30"
              >
                {isCancelling ? <Loader2 className="w-4 h-4 animate-spin" /> : <Ban className="w-4 h-4" />}
                Confirm Cancel
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
