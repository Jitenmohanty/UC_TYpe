import { DayOfWeek, WorkingHours } from '../types/global';

/**
 * Get the day of week key from a Date object (in given timezone)
 */
export function getDayOfWeek(date: Date, timezone?: string): DayOfWeek {
  const dayNames: DayOfWeek[] = [
    'sunday',
    'monday',
    'tuesday',
    'wednesday',
    'thursday',
    'friday',
    'saturday',
  ];

  if (timezone) {
    const formatter = new Intl.DateTimeFormat('en-US', {
      weekday: 'long',
      timeZone: timezone,
    });
    const dayName = formatter.format(date).toLowerCase() as DayOfWeek;
    return dayName;
  }

  return dayNames[date.getUTCDay()];
}

/**
 * Parse "HH:mm" string to minutes from midnight
 */
export function timeToMinutes(time: string): number {
  const [hours, minutes] = time.split(':').map(Number);
  return (hours ?? 0) * 60 + (minutes ?? 0);
}

/**
 * Check if a given time (HH:mm) falls within a time range
 */
export function isTimeInRange(time: string, start: string, end: string): boolean {
  const t = timeToMinutes(time);
  const s = timeToMinutes(start);
  const e = timeToMinutes(end);
  return t >= s && t < e;
}

/**
 * Build a Date from a date string (YYYY-MM-DD) and time string (HH:mm)
 * in UTC
 */
export function buildScheduledDateTime(date: string, time: string): Date {
  const [year, month, day] = date.split('-').map(Number);
  const [hour, minute] = time.split(':').map(Number);
  return new Date(
    Date.UTC(year ?? 0, (month ?? 1) - 1, day ?? 1, hour ?? 0, minute ?? 0, 0, 0),
  );
}

/**
 * Add minutes to a Date
 */
export function addMinutes(date: Date, minutes: number): Date {
  return new Date(date.getTime() + minutes * 60 * 1000);
}

/**
 * Check if two time ranges overlap
 * All times are JS Date objects (UTC)
 */
export function doRangesOverlap(
  start1: Date,
  end1: Date,
  start2: Date,
  end2: Date,
): boolean {
  return start1 < end2 && end1 > start2;
}

/**
 * Check if location is fresh given a max age in minutes
 */
export function isLocationFresh(locationUpdatedAt: Date, maxAgeMinutes: number): boolean {
  const ageMs = Date.now() - locationUpdatedAt.getTime();
  const ageMins = ageMs / (1000 * 60);
  return ageMins <= maxAgeMinutes;
}

/**
 * Format date as YYYY-MM-DD string
 */
export function formatDate(date: Date): string {
  return date.toISOString().split('T')[0] ?? '';
}

export function formatTime(date: Date): string {
  return date.toISOString().split('T')[1]?.substring(0, 5) ?? '';
}
