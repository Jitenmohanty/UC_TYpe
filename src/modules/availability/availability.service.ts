import { Types } from 'mongoose';
import { IBarberProfile } from '../barbers/barberProfile.model';
import { BarberLeaveModel } from './barberLeave.model';
import { assignmentRepository } from '../assignments/assignment.repository';
import {
  getDayOfWeek,
  isTimeInRange,
  buildScheduledDateTime,
  addMinutes,
  doRangesOverlap,
} from '../../common/utils/timeUtils';
import { DayOfWeek } from '../../common/types/global';

export interface SlotCheckInput {
  barberId: Types.ObjectId;
  scheduledDate: string;   // YYYY-MM-DD
  startTime: string;       // HH:mm
  durationMinutes: number;
  excludeBookingId?: Types.ObjectId;
}

export class AvailabilityService {
  /**
   * Check if a barber is working at the requested date and time
   */
  isBarberWorkingAt(profile: IBarberProfile, date: string, startTime: string): boolean {
    const dayOfWeek = this.getDayOfWeekFromDate(date);
    const daySchedule = profile.workingHours[dayOfWeek];

    if (!daySchedule?.enabled) return false;

    return isTimeInRange(startTime, daySchedule.start, daySchedule.end);
  }

  /**
   * Check if barber is on approved leave on the given date
   */
  async isBarberOnLeave(barberId: Types.ObjectId, date: string): Promise<boolean> {
    const leave = await BarberLeaveModel.findOne({
      barberId,
      startDate: { $lte: date },
      endDate: { $gte: date },
    }).exec();

    return leave !== null;
  }

  /**
   * Check if barber has a conflicting confirmed booking for the requested slot
   */
  async hasSlotConflict(input: SlotCheckInput): Promise<boolean> {
    const scheduledStart = buildScheduledDateTime(input.scheduledDate, input.startTime);
    const scheduledEnd = addMinutes(scheduledStart, input.durationMinutes);

    return assignmentRepository.hasConflict(
      input.barberId,
      scheduledStart,
      scheduledEnd,
      input.excludeBookingId,
    );
  }

  /**
   * Full availability check for a barber + slot
   */
  async isBarberAvailableForSlot(
    profile: IBarberProfile,
    date: string,
    startTime: string,
    durationMinutes: number,
    excludeBookingId?: Types.ObjectId,
  ): Promise<{ available: boolean; reason?: string }> {
    // Working hours check
    if (!this.isBarberWorkingAt(profile, date, startTime)) {
      return { available: false, reason: 'Not working at requested time' };
    }

    // Leave check
    const onLeave = await this.isBarberOnLeave(profile._id, date);
    if (onLeave) {
      return { available: false, reason: 'On leave' };
    }

    // Slot conflict check
    const hasConflict = await this.hasSlotConflict({
      barberId: profile._id,
      scheduledDate: date,
      startTime,
      durationMinutes,
      excludeBookingId,
    });

    if (hasConflict) {
      return { available: false, reason: 'Time slot already booked' };
    }

    return { available: true };
  }

  private getDayOfWeekFromDate(dateStr: string): DayOfWeek {
    const [year, month, day] = dateStr.split('-').map(Number);
    const date = new Date(Date.UTC(year ?? 0, (month ?? 1) - 1, day ?? 1));
    return getDayOfWeek(date);
  }
}

export const availabilityService = new AvailabilityService();
