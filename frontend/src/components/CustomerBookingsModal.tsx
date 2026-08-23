import React, { useState, useEffect } from 'react';
import type { Booking } from '../types';
import { ACTIVE_STATUSES, CANCELLED_STATUSES } from '../types';
import { bookingApi, apiErrorMessage } from '../services/api';
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
  ShieldCheck,
  Sparkles,
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
      // bookingApi.getMyBookings already normalises the paginated envelope to an array.
      setBookings(await bookingApi.getMyBookings());
    } catch (err) {
      setStatusMessage(apiErrorMessage(err, 'Could not load your bookings.'));
      setTimeout(() => setStatusMessage(null), 4000);
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
    } catch (err) {
      setStatusMessage(apiErrorMessage(err, 'Failed to cancel booking'));
    } finally {
      setCancellingId(null);
      setTimeout(() => setStatusMessage(null), 3500);
    }
  };

  const filteredBookings = bookings.filter((b) => {
    if (activeTab === 'all') return true;
    if (activeTab === 'active') return ACTIVE_STATUSES.includes(b.status);
    if (activeTab === 'completed') return b.status === 'COMPLETED';
    if (activeTab === 'cancelled') return CANCELLED_STATUSES.includes(b.status);
    return true;
  });

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'COMPLETED':
        return 'bg-emerald-500/15 text-emerald-300 border-emerald-500/30';
      case 'CONFIRMED':
      case 'IN_PROGRESS':
        return 'bg-[#ff6c4c]/15 text-[#ff8a6a] border-[#ff6c4c]/30 animate-pulse';
      case 'OFFERED':
      case 'PENDING':
      case 'SEARCHING':
        return 'bg-amber-500/15 text-amber-300 border-amber-500/30';
      default:
        return 'bg-red-500/15 text-red-300 border-red-500/30';
    }
  };

  const isCancellable = (status: string) =>
    ['PENDING', 'OFFERED', 'CONFIRMED', 'SEARCHING', 'BARBER_CANCELLED', 'NO_BARBER_AVAILABLE'].includes(status);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 md:p-6 bg-black/85 backdrop-blur-xl animate-fade-in">
      <div 
        className="glass-card rounded-[32px] w-full max-w-4xl border-white/[0.12] overflow-hidden shadow-2xl relative max-h-[90vh] flex flex-col bg-[#0b0d14]/95"
        onClick={(e) => e.stopPropagation()}
      >
        
        {/* Header */}
        <div className="px-6 py-5 border-b border-white/10 flex items-center justify-between bg-[#10131d]/90">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl gradient-flow flex items-center justify-center text-white shadow-md shadow-[#ff6c4c]/20">
              <Calendar className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-lg sm:text-xl font-extrabold font-outfit text-white">
                  My Bookings & History
                </h2>
                <span className="hidden sm:inline-flex items-center gap-1 text-[10px] font-extrabold px-2 py-0.5 rounded-full bg-[#ff6c4c]/15 text-[#ff8a6a] border border-[#ff6c4c]/30">
                  <Sparkles className="w-3 h-3 text-[#ff6c4c]" />
                  AURA PASS
                </span>
              </div>
              <p className="text-xs text-gray-400 mt-0.5">
                Track live doorstep dispatches and view past grooming appointments
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={fetchBookings}
              disabled={loading}
              title="Refresh Bookings"
              className="p-2 rounded-xl bg-white/[0.04] hover:bg-white/[0.08] text-gray-300 hover:text-white border border-white/[0.08] transition-colors"
            >
              <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin text-[#ff6c4c]' : ''}`} />
            </button>
            <button
              onClick={onClose}
              className="p-2 rounded-full hover:bg-white/10 text-gray-400 hover:text-white transition-colors"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Status Toast */}
        {statusMessage && (
          <div className="p-3 bg-[#ff6c4c]/15 border-b border-[#ff6c4c]/30 text-[#ff8a6a] text-xs text-center font-bold animate-fade-in">
            {statusMessage}
          </div>
        )}

        {/* Filter Tabs */}
        <div className="p-4 sm:px-6 border-b border-white/[0.08] flex flex-wrap items-center gap-2 bg-[#0c0e17]/80">
          {[
            { id: 'all', label: 'All', count: bookings.length },
            {
              id: 'active',
              label: 'Active',
              count: bookings.filter((b) => ACTIVE_STATUSES.includes(b.status)).length,
            },
            {
              id: 'completed',
              label: 'Completed',
              count: bookings.filter((b) => b.status === 'COMPLETED').length,
            },
            {
              id: 'cancelled',
              label: 'Cancelled',
              count: bookings.filter((b) => CANCELLED_STATUSES.includes(b.status)).length,
            },
          ].map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id as any)}
              className={`px-4 py-2 rounded-xl text-xs font-bold transition-all border flex items-center gap-2 ${
                activeTab === tab.id
                  ? 'gradient-flow text-white font-extrabold shadow-md shadow-[#ff6c4c]/20 border-transparent scale-105'
                  : 'bg-[#13151f] hover:bg-[#1c202e] text-gray-300 border-white/[0.08]'
              }`}
            >
              <span>{tab.label}</span>
              <span className={`text-[10px] px-1.5 py-0.2 rounded-full ${
                activeTab === tab.id ? 'bg-white/20 text-white' : 'bg-white/[0.06] text-gray-400'
              }`}>
                {tab.count}
              </span>
            </button>
          ))}
        </div>

        {/* Bookings List */}
        <div className="p-5 sm:p-6 overflow-y-auto space-y-4 flex-1">
          {loading ? (
            <div className="py-20 text-center space-y-3">
              <RefreshCw className="w-8 h-8 text-[#ff6c4c] animate-spin mx-auto" />
              <p className="text-xs text-gray-400 font-medium">Loading your appointment records...</p>
            </div>
          ) : filteredBookings.length === 0 ? (
            <div className="py-20 text-center space-y-3">
              <div className="w-16 h-16 rounded-3xl bg-[#ff6c4c]/10 border border-[#ff6c4c]/20 flex items-center justify-center mx-auto text-[#ff6c4c]">
                <Calendar className="w-8 h-8" />
              </div>
              <h3 className="text-base font-extrabold text-white">No Bookings Found</h3>
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
                  className="rounded-3xl p-5 sm:p-6 bg-[#121520] border border-white/[0.08] hover:border-[#ff6c4c]/30 hover:bg-[#161a27] transition-all space-y-4 shadow-lg group"
                >
                  <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 pb-3 border-b border-white/5">
                    <div className="flex items-center gap-3">
                      <div className="w-11 h-11 rounded-2xl gradient-flow flex items-center justify-center text-white shadow-md shadow-[#ff6c4c]/20 shrink-0">
                        <Scissors className="w-5 h-5" />
                      </div>
                      <div>
                        <h4 className="font-extrabold font-outfit text-white text-base group-hover:text-[#ff8a6a] transition-colors">
                          {serviceName}
                        </h4>
                        <span className="text-xs text-[#ff8a6a] block font-mono font-medium">#{b.bookingNumber}</span>
                      </div>
                    </div>

                    <div className="flex items-center gap-3 self-end sm:self-auto">
                      <span className={`px-3 py-1 rounded-full text-xs font-bold border ${getStatusBadge(b.status)}`}>
                        {b.status.replace(/_/g, ' ')}
                      </span>
                      <div className="text-right">
                        <span className="text-[#ff8a6a] font-extrabold text-lg block font-outfit">₹{price}</span>
                        <span className="text-[10px] text-gray-400 block">{duration} mins</span>
                      </div>
                    </div>
                  </div>

                  {/* Appointment Time & Doorstep Address */}
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-xs text-gray-300">
                    <div className="flex items-center gap-3 bg-black/40 p-3 rounded-2xl border border-white/[0.06]">
                      <Clock className="w-4 h-4 text-[#ff6c4c] shrink-0" />
                      <div>
                        <span className="text-[10px] text-gray-400 block uppercase font-semibold tracking-wider">Scheduled Time</span>
                        <span className="font-bold text-white text-xs">{b.scheduledDate} at {b.startTime}</span>
                      </div>
                    </div>

                    <div className="flex items-center gap-3 bg-black/40 p-3 rounded-2xl border border-white/[0.06]">
                      <MapPin className="w-4 h-4 text-[#ff6c4c] shrink-0" />
                      <div className="min-w-0">
                        <span className="text-[10px] text-gray-400 block uppercase font-semibold tracking-wider">Doorstep Location</span>
                        <span className="font-semibold text-white truncate block text-xs">{address}</span>
                      </div>
                    </div>
                  </div>

                  {/* Card Footer with Actions */}
                  <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 pt-1">
                    {b.status === 'CONFIRMED' && (
                      <span className="text-[#ff8a6a] text-xs font-semibold flex items-center gap-1.5">
                        <KeyRound className="w-3.5 h-3.5 text-[#ff6c4c]" />
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
                        Cancelled by You {b.cancellationReason ? `(${b.cancellationReason})` : ''}
                      </span>
                    )}

                    {b.status === 'ADMIN_CANCELLED' && (
                      <span className="text-rose-400 text-xs font-semibold flex items-center gap-1.5">
                        <Ban className="w-3.5 h-3.5" />
                        Cancelled by Admin {b.cancellationReason ? `(${b.cancellationReason})` : ''}
                      </span>
                    )}

                    {b.status === 'BARBER_CANCELLED' && (
                      <span className="text-amber-400 text-xs font-semibold flex items-center gap-1.5">
                        <Clock className="w-3.5 h-3.5" />
                        Barber unavailable • back in the queue for another barber
                      </span>
                    )}

                    {['PENDING', 'SEARCHING', 'NO_BARBER_AVAILABLE'].includes(b.status) && (
                      <span className="text-amber-300 text-xs font-semibold flex items-center gap-1.5">
                        <Clock className="w-3.5 h-3.5" />
                        Waiting for a barber to be assigned
                      </span>
                    )}

                    {b.status === 'OFFERED' && (
                      <span className="text-amber-300 text-xs font-semibold flex items-center gap-1.5">
                        <Clock className="w-3.5 h-3.5" />
                        Sent to your chosen barber — awaiting their confirmation
                      </span>
                    )}

                    <div className="sm:ml-auto flex items-center gap-2 w-full sm:w-auto justify-end">
                      {isCancellable(b.status) && (
                        <button
                          onClick={() => handleCancelBooking(b._id)}
                          disabled={cancellingId === b._id}
                          className="px-3.5 py-2 rounded-xl bg-red-500/10 hover:bg-red-500/20 text-red-300 border border-red-500/30 text-xs font-bold transition-all active:scale-95"
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
                          className="px-4 py-2 rounded-xl gradient-flow text-white text-xs font-extrabold transition-all flex items-center gap-1.5 shadow-md shadow-[#ff6c4c]/20 hover:opacity-95 active:scale-95"
                        >
                          <span>Book Again</span>
                          <ArrowRight className="w-3.5 h-3.5" />
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              );
            })
          )}
        </div>

        {/* Modal Footer */}
        <div className="px-6 py-4 border-t border-white/10 bg-[#0c0e16] flex flex-col sm:flex-row items-center justify-between gap-3 text-xs text-gray-400">
          <div className="flex items-center gap-2 text-emerald-400 text-xs font-semibold">
            <ShieldCheck className="w-4 h-4" />
            <span>100% Sanitized Toolkits & Verified Mobile Barbers</span>
          </div>

          <div className="text-[11px] text-gray-400">
            Total Records: <strong className="text-white">{bookings.length}</strong>
          </div>
        </div>

      </div>
    </div>
  );
};

