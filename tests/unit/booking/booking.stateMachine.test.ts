import { describe, it, expect, beforeEach, vi } from 'vitest';
import { BookingStateMachine } from '../../../src/modules/bookings/booking.stateMachine';
import { BookingStatus } from '../../../src/common/constants/bookingStates';
import { BookingStateError } from '../../../src/common/errors/AppError';

// Mock the repository
vi.mock('../../../src/modules/bookings/booking.repository', () => ({
  bookingRepository: {
    compareAndSetStatus: vi.fn().mockResolvedValue({ status: 'CONFIRMED' }),
  },
}));

describe('BookingStateMachine', () => {
  let machine: BookingStateMachine;

  beforeEach(() => {
    machine = new BookingStateMachine();
  });

  describe('the manual-assignment happy path', () => {
    it('allows PENDING → CONFIRMED (barber claims, or admin assigns)', () => {
      expect(machine.canTransition(BookingStatus.PENDING, BookingStatus.CONFIRMED)).toBe(true);
    });

    it('allows PENDING → OFFERED (customer picked a specific barber)', () => {
      expect(machine.canTransition(BookingStatus.PENDING, BookingStatus.OFFERED)).toBe(true);
    });

    it('allows OFFERED → CONFIRMED (that barber accepted)', () => {
      expect(machine.canTransition(BookingStatus.OFFERED, BookingStatus.CONFIRMED)).toBe(true);
    });

    it('allows CONFIRMED → IN_PROGRESS (OTP verified)', () => {
      expect(machine.canTransition(BookingStatus.CONFIRMED, BookingStatus.IN_PROGRESS)).toBe(true);
    });

    it('allows IN_PROGRESS → COMPLETED', () => {
      expect(machine.canTransition(BookingStatus.IN_PROGRESS, BookingStatus.COMPLETED)).toBe(true);
    });
  });

  describe('returning a booking to the open pool', () => {
    it('allows OFFERED → PENDING when the chosen barber declines', () => {
      expect(machine.canTransition(BookingStatus.OFFERED, BookingStatus.PENDING)).toBe(true);
    });

    it('allows CONFIRMED → BARBER_CANCELLED when the barber backs out', () => {
      expect(machine.canTransition(BookingStatus.CONFIRMED, BookingStatus.BARBER_CANCELLED)).toBe(true);
    });

    it('allows BARBER_CANCELLED → PENDING so another barber can take it', () => {
      expect(machine.canTransition(BookingStatus.BARBER_CANCELLED, BookingStatus.PENDING)).toBe(true);
    });

    it('does NOT send a cancelled booking straight back to CONFIRMED', () => {
      expect(machine.canTransition(BookingStatus.BARBER_CANCELLED, BookingStatus.CONFIRMED)).toBe(false);
    });
  });

  describe('terminal statuses', () => {
    it.each([
      BookingStatus.COMPLETED,
      BookingStatus.CUSTOMER_CANCELLED,
      BookingStatus.ADMIN_CANCELLED,
      BookingStatus.EXPIRED,
    ])('%s permits no further transition', (terminal) => {
      Object.values(BookingStatus).forEach((next) => {
        expect(machine.canTransition(terminal, next as BookingStatus)).toBe(false);
      });
    });
  });

  describe('step-skipping is rejected', () => {
    it('PENDING → COMPLETED', () => {
      expect(machine.canTransition(BookingStatus.PENDING, BookingStatus.COMPLETED)).toBe(false);
    });

    it('PENDING → IN_PROGRESS (must be CONFIRMED first)', () => {
      expect(machine.canTransition(BookingStatus.PENDING, BookingStatus.IN_PROGRESS)).toBe(false);
    });

    it('OFFERED → IN_PROGRESS', () => {
      expect(machine.canTransition(BookingStatus.OFFERED, BookingStatus.IN_PROGRESS)).toBe(false);
    });
  });

  describe('cancellation by customer', () => {
    it.each([BookingStatus.PENDING, BookingStatus.OFFERED, BookingStatus.CONFIRMED])(
      'is allowed from %s',
      (from) => {
        expect(machine.canTransition(from, BookingStatus.CUSTOMER_CANCELLED)).toBe(true);
      },
    );

    it('is not allowed from COMPLETED', () => {
      expect(machine.canTransition(BookingStatus.COMPLETED, BookingStatus.CUSTOMER_CANCELLED)).toBe(false);
    });

    it('is not allowed from IN_PROGRESS — the barber is already on site', () => {
      expect(machine.canTransition(BookingStatus.IN_PROGRESS, BookingStatus.CUSTOMER_CANCELLED)).toBe(false);
    });
  });

  describe('admin cancellation', () => {
    it.each([
      BookingStatus.PENDING,
      BookingStatus.OFFERED,
      BookingStatus.CONFIRMED,
      BookingStatus.IN_PROGRESS,
    ])('is allowed from %s', (from) => {
      expect(machine.canTransition(from, BookingStatus.ADMIN_CANCELLED)).toBe(true);
    });
  });

  describe('legacy auto-allocation rows', () => {
    it('SEARCHING can be pulled back into the pool', () => {
      expect(machine.canTransition(BookingStatus.SEARCHING, BookingStatus.PENDING)).toBe(true);
    });

    it('NO_BARBER_AVAILABLE can be pulled back into the pool', () => {
      expect(machine.canTransition(BookingStatus.NO_BARBER_AVAILABLE, BookingStatus.PENDING)).toBe(true);
    });
  });

  describe('assertTransition', () => {
    it('throws BookingStateError for an invalid transition', () => {
      expect(() =>
        machine.assertTransition(BookingStatus.COMPLETED, BookingStatus.CONFIRMED),
      ).toThrow(BookingStateError);
    });

    it('does not throw for a valid transition', () => {
      expect(() =>
        machine.assertTransition(BookingStatus.PENDING, BookingStatus.CONFIRMED),
      ).not.toThrow();
    });
  });
});
