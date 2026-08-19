import { describe, it, expect, beforeEach, vi } from 'vitest';
import { BookingStateMachine } from '../../../src/modules/bookings/booking.stateMachine';
import { BookingStatus } from '../../../src/common/constants/bookingStates';
import { BookingStateError } from '../../../src/common/errors/AppError';

// Mock the repository
vi.mock('../../../src/modules/bookings/booking.repository', () => ({
  bookingRepository: {
    updateStatus: vi.fn().mockResolvedValue({ status: 'CONFIRMED' }),
  },
}));

describe('BookingStateMachine', () => {
  let machine: BookingStateMachine;

  beforeEach(() => {
    machine = new BookingStateMachine();
  });

  describe('canTransition', () => {
    it('should allow PENDING → SEARCHING', () => {
      expect(machine.canTransition(BookingStatus.PENDING, BookingStatus.SEARCHING)).toBe(true);
    });

    it('should allow SEARCHING → OFFERED', () => {
      expect(machine.canTransition(BookingStatus.SEARCHING, BookingStatus.OFFERED)).toBe(true);
    });

    it('should allow OFFERED → CONFIRMED', () => {
      expect(machine.canTransition(BookingStatus.OFFERED, BookingStatus.CONFIRMED)).toBe(true);
    });

    it('should allow CONFIRMED → IN_PROGRESS', () => {
      expect(machine.canTransition(BookingStatus.CONFIRMED, BookingStatus.IN_PROGRESS)).toBe(true);
    });

    it('should allow IN_PROGRESS → COMPLETED', () => {
      expect(machine.canTransition(BookingStatus.IN_PROGRESS, BookingStatus.COMPLETED)).toBe(true);
    });

    it('should allow CONFIRMED → BARBER_CANCELLED', () => {
      expect(machine.canTransition(BookingStatus.CONFIRMED, BookingStatus.BARBER_CANCELLED)).toBe(true);
    });

    it('should allow BARBER_CANCELLED → SEARCHING', () => {
      expect(machine.canTransition(BookingStatus.BARBER_CANCELLED, BookingStatus.SEARCHING)).toBe(true);
    });

    it('should NOT allow COMPLETED → any status', () => {
      Object.values(BookingStatus).forEach((status) => {
        expect(machine.canTransition(BookingStatus.COMPLETED, status as BookingStatus)).toBe(false);
      });
    });

    it('should NOT allow CUSTOMER_CANCELLED → any status', () => {
      Object.values(BookingStatus).forEach((status) => {
        expect(machine.canTransition(BookingStatus.CUSTOMER_CANCELLED, status as BookingStatus)).toBe(false);
      });
    });

    it('should NOT allow PENDING → COMPLETED (skip steps)', () => {
      expect(machine.canTransition(BookingStatus.PENDING, BookingStatus.COMPLETED)).toBe(false);
    });

    it('should NOT allow SEARCHING → CONFIRMED (skip OFFERED)', () => {
      expect(machine.canTransition(BookingStatus.SEARCHING, BookingStatus.CONFIRMED)).toBe(false);
    });
  });

  describe('assertTransition', () => {
    it('should throw BookingStateError for invalid transition', () => {
      expect(() => machine.assertTransition(BookingStatus.COMPLETED, BookingStatus.CONFIRMED))
        .toThrow(BookingStateError);
    });

    it('should not throw for valid transition', () => {
      expect(() => machine.assertTransition(BookingStatus.PENDING, BookingStatus.SEARCHING))
        .not.toThrow();
    });
  });

  describe('cancellation by customer', () => {
    it('should allow customer cancel from SEARCHING', () => {
      expect(machine.canTransition(BookingStatus.SEARCHING, BookingStatus.CUSTOMER_CANCELLED)).toBe(true);
    });

    it('should allow customer cancel from OFFERED', () => {
      expect(machine.canTransition(BookingStatus.OFFERED, BookingStatus.CUSTOMER_CANCELLED)).toBe(true);
    });

    it('should allow customer cancel from CONFIRMED', () => {
      expect(machine.canTransition(BookingStatus.CONFIRMED, BookingStatus.CUSTOMER_CANCELLED)).toBe(true);
    });

    it('should NOT allow customer cancel from COMPLETED', () => {
      expect(machine.canTransition(BookingStatus.COMPLETED, BookingStatus.CUSTOMER_CANCELLED)).toBe(false);
    });
  });
});
