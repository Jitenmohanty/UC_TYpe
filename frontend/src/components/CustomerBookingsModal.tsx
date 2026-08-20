import React, { useState, useEffect } from 'react';
import type { Booking } from '../types';
import { bookingApi } from '../services/api';
import {
  X,
  Calendar,
  Clock,
  MapPin,
  CheckCircle2,
  Scissors,
  RefreshCw,
  KeyRound,
  Ban,
  ArrowRight,
} from 'lucide-react';

interface CustomerBookingsModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSelectRebook?: (serviceId: string) => void;
}

export const CustomerBookingsModal: React.FC<CustomerBookingsModalProps> = ({
  isOpen,
  onClose,
  onSelectRebook,
}) => {
  const [bookings, setBookings] = useState<Booking[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [activeTab, setActiveTab] = useState<'all' | 'active' | 'completed' | 'cancelled'>('all');
  const [cancellingId, setCancellingId] = useState<string | null>(null);
  const [statusMessage, setStatusMessage] = useState<string | null>(null);

  const fetchBookings = async () => {
    setLoading(true);
    try {
      const data = await bookingApi.getMyBookings();
      setBookings(Array.isArray(data) ? data : (data as any)?.items || []);
    } catch {
      // Fallback
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (isOpen) {
      void fetchBookings();
    }
  }, [isOpen]);

  if (!isOpen) return null;

  const handleCancelBooking = async (bookingId: string) => {
    if (!confirm('Are you sure you want to cancel this booking?')) return;
    setCancellingId(bookingId);
    try {
      await bookingApi.cancel(bookingId, 'Customer requested cancellation from portal');
      setStatusMessage('Booking cancelled successfully.');
      await fetchBookings();
    } catch (err: any) {
      const msg = err?.response?.data?.error?.message || 'Failed to cancel booking';
      setStatusMessage(msg);
    } finally {
      setCancellingId(null);
      setTimeout(() => setStatusMessage(null), 3500);
    }
  };

  const filteredBookings = bookings.filter((b) => {
    if (activeTab === 'all') return true;
    if (activeTab === 'active') {
      return ['PENDING', 'SEARCHING', 'OFFERED', 'CONFIRMED', 'ASSIGNED', 'ACCEPTED', 'EN_ROUTE', 'ARRIVED', 'IN_PROGRESS'].includes(b.status);
    }
    if (activeTab === 'completed') {
      return b.status === 'COMPLETED';
    }
    if (activeTab === 'cancelled') {
      return ['CUSTOMER_CANCELLED', 'BARBER_CANCELLED', 'EXPIRED', 'NO_BARBER_AVAILABLE', 'ADMIN_CANCELLED', 'SYSTEM_CANCELLED'].includes(b.status);
    }
    return true;
  });

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'COMPLETED':
        return 'bg-emerald-500/20 text-emerald-300 border-emerald-500/40';
      case 'CONFIRMED':
      case 'ACCEPTED':
      case 'IN_PROGRESS':
        return 'bg-purple-500/20 text-purple-300 border-purple-500/40 animate-pulse';
      case 'SEARCHING':
      case 'OFFERED':
      case 'PENDING':
        return 'bg-amber-500/20 text-amber-300 border-amber-500/40';
      default:
        return 'bg-red-500/20 text-red-300 border-red-500/40';
    }
  };

  const isCancellable = (status: string) => {
    return ['PENDING', 'SEARCHING', 'OFFERED', 'CONFIRMED', 'ACCEPTED'].includes(status);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/85 backdrop-blur-xl animate-fade-in">
      <div className="glass-card rounded-3xl w-full max-w-3xl border-purple-500/30 overflow-hidden shadow-2xl flex flex-col max-h-[90vh]">
        
        {/* Header */}
        <div className="p-6 border-b border-white/10 flex items-center justify-between bg-obsidian-900/60">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-purple-600/20 border border-purple-500/30 flex items-center justify-center text-purple-400">
              <Calendar className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-xl font-bold font-outfit text-white">My Bookings & History</h2>
              <p className="text-xs text-gray-400">Track active dispatches and view past doorstep services</p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={fetchBookings}
              disabled={loading}
              title="Refresh Bookings"
              className="p-2 rounded-xl bg-obsidian-800 hover:bg-obsidian-700 text-gray-300 border border-white/10 transition-colors"
            >
              <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin text-purple-400' : ''}`} />
            </button>
            <button
              onClick={onClose}
              className="p-2 rounded-xl bg-obsidian-800 hover:bg-obsidian-700 text-gray-400 hover:text-white border border-white/10 transition-colors"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Status Toast */}
        {statusMessage && (
          <div className="p-3 bg-purple-950/80 border-b border-purple-500/30 text-purple-300 text-xs text-center font-bold">
            {statusMessage}
          </div>
        )}

        {/* Filter Tabs */}
        <div className="p-4 border-b border-white/5 flex flex-wrap items-center gap-2 bg-obsidian-950/40">
          {[
            { id: 'all', label: `All (${bookings.length})` },
            {
              id: 'active',
              label: `Active & In-Progress (${
                bookings.filter((b) =>
                  ['PENDING', 'SEARCHING', 'OFFERED', 'CONFIRMED', 'ASSIGNED', 'ACCEPTED', 'EN_ROUTE', 'ARRIVED', 'IN_PROGRESS'].includes(b.status)
                ).length
              })`,
            },
            {
              id: 'completed',
              label: `Completed (${bookings.filter((b) => b.status === 'COMPLETED').length})`,
            },
            {
              id: 'cancelled',
              label: `Cancelled (${
                bookings.filter((b) =>
                  ['CUSTOMER_CANCELLED', 'BARBER_CANCELLED', 'EXPIRED', 'NO_BARBER_AVAILABLE', 'ADMIN_CANCELLED', 'SYSTEM_CANCELLED'].includes(b.status)
                ).length
              })`,
            },
          ].map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id as any)}
              className={`px-3.5 py-1.5 rounded-xl text-xs font-bold transition-all border ${
                activeTab === tab.id
                  ? 'bg-purple-600 border-purple-500 text-white shadow-md'
                  : 'bg-obsidian-800/60 hover:bg-obsidian-800 text-gray-400 hover:text-gray-200 border-white/5'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>

        {/* Bookings List */}
        <div className="p-6 overflow-y-auto space-y-4 flex-1">
          {loading ? (
            <div className="py-16 text-center space-y-3">
              <RefreshCw className="w-8 h-8 text-purple-400 animate-spin mx-auto" />
              <p className="text-xs text-gray-400">Loading your appointment records...</p>
            </div>
          ) : filteredBookings.length === 0 ? (
            <div className="py-16 text-center space-y-3">
              <div className="w-16 h-16 rounded-3xl bg-purple-500/10 border border-purple-500/20 flex items-center justify-center mx-auto text-purple-400">
                <Calendar className="w-8 h-8" />
              </div>
              <h3 className="text-base font-bold text-white">No Bookings Found</h3>
              <p className="text-xs text-gray-400 max-w-sm mx-auto">
                You do not have any bookings in this filter category yet.
              </p>
            </div>
          ) : (
            filteredBookings.map((b) => {
              const serviceName = b.serviceSnapshot?.name || 'Grooming Service';
              const price = b.serviceSnapshot?.price || 0;
              const duration = b.serviceSnapshot?.durationMinutes || 45;
              const address = b.addressSnapshot?.formattedAddress || 'Doorstep Service Address';

              return (
                <div
                  key={b._id}
                  className="glass-card p-5 rounded-2xl border-white/10 hover:border-purple-500/30 transition-all space-y-4 bg-obsidian-800/40"
                >
                  <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 pb-3 border-b border-white/5">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-xl gradient-purple flex items-center justify-center text-white">
                        <Scissors className="w-5 h-5" />
                      </div>
                      <div>
                        <h4 className="font-bold text-white text-base">{serviceName}</h4>
                        <span className="text-xs text-gray-400 block font-mono">#{b.bookingNumber}</span>
                      </div>
                    </div>

                    <div className="flex items-center gap-3">
                      <span className={`px-3 py-1 rounded-full text-xs font-bold border ${getStatusBadge(b.status)}`}>
                        {b.status}
                      </span>
                      <div className="text-right">
                        <span className="text-amber-400 font-extrabold text-base block">₹{price}</span>
                        <span className="text-[10px] text-gray-400 block">{duration} mins</span>
                      </div>
                    </div>
                  </div>

                  {/* Appointment Time & Doorstep Address */}
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-xs text-gray-300">
                    <div className="flex items-center gap-2 bg-black/20 p-2.5 rounded-xl border border-white/5">
                      <Clock className="w-4 h-4 text-purple-400 shrink-0" />
                      <div>
                        <span className="text-[10px] text-gray-400 block">Scheduled Time</span>
                        <span className="font-semibold text-white">{b.scheduledDate} at {b.startTime}</span>
                      </div>
                    </div>

                    <div className="flex items-center gap-2 bg-black/20 p-2.5 rounded-xl border border-white/5">
                      <MapPin className="w-4 h-4 text-purple-400 shrink-0" />
                      <div className="min-w-0">
                        <span className="text-[10px] text-gray-400 block">Doorstep Location</span>
                        <span className="font-semibold text-white truncate block">{address}</span>
                      </div>
                    </div>
                  </div>

                  {/* Card Footer with Actions */}
                  <div className="flex items-center justify-between pt-1">
                    {b.status === 'CONFIRMED' && (
                      <span className="text-amber-300 text-xs font-semibold flex items-center gap-1.5">
                        <KeyRound className="w-3.5 h-3.5" />
                        Verification code active on home screen
                      </span>
                    )}

                    {b.status === 'COMPLETED' && (
                      <span className="text-emerald-400 text-xs font-semibold flex items-center gap-1.5">
                        <CheckCircle2 className="w-3.5 h-3.5" />
                        Service Completed & Verified
                      </span>
                    )}

                    {b.status === 'CUSTOMER_CANCELLED' && (
                      <span className="text-red-400 text-xs font-semibold flex items-center gap-1.5">
                        <Ban className="w-3.5 h-3.5" />
                        Cancelled by You
                      </span>
                    )}

                    <div className="ml-auto flex items-center gap-2">
                      {isCancellable(b.status) && (
                        <button
                          onClick={() => handleCancelBooking(b._id)}
                          disabled={cancellingId === b._id}
                          className="px-3 py-1.5 rounded-xl bg-red-500/10 hover:bg-red-500/20 text-red-300 border border-red-500/30 text-xs font-bold transition-all"
                        >
                          {cancellingId === b._id ? 'Cancelling...' : 'Cancel Booking'}
                        </button>
                      )}

                      {b.status === 'COMPLETED' && onSelectRebook && (
                        <button
                          onClick={() => {
                            const sId = typeof b.serviceId === 'string' ? b.serviceId : (b.serviceId as any)?._id;
                            if (sId) onSelectRebook(sId);
                            onClose();
                          }}
                          className="px-3.5 py-1.5 rounded-xl gradient-purple text-white text-xs font-bold transition-all flex items-center gap-1 shadow-md hover:scale-105"
                        >
                          <span>Book Again</span>
                          <ArrowRight className="w-3 h-3" />
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              );
            })
          )}
        </div>

      </div>
    </div>
  );
};
