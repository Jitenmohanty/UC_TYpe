import { z } from 'zod';

export const createBookingSchema = z.object({
  serviceId: z.string().regex(/^[0-9a-fA-F]{24}$/, 'Invalid service ID'),
  scheduledDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Date must be YYYY-MM-DD'),
  startTime: z.string().regex(/^\d{2}:\d{2}$/, 'Time must be HH:mm'),
  timezone: z.string().default('UTC'),
  barberPreference: z.enum(['ANY', 'SPECIFIC']).default('ANY'),
  preferredBarberId: z.string().regex(/^[0-9a-fA-F]{24}$/).optional(),
  customerLocation: z.object({
    latitude: z.number().min(-90).max(90),
    longitude: z.number().min(-180).max(180),
  }),
  addressSnapshot: z.object({
    formattedAddress: z.string().optional(),
    houseNumber: z.string().optional(),
    landmark: z.string().optional(),
    postalCode: z.string().optional(),
    contactPhone: z.string().optional(),
    city: z.string().optional(),
    state: z.string().optional(),
    country: z.string().optional(),
  }).optional(),
}).refine(
  (data) => {
    if (data.barberPreference === 'SPECIFIC' && !data.preferredBarberId) {
      return false;
    }
    return true;
  },
  { message: 'preferredBarberId is required when barberPreference is SPECIFIC', path: ['preferredBarberId'] },
);

export const cancelBookingSchema = z.object({
  reason: z.string().max(500).optional(),
});

export const bookingQuerySchema = z.object({
  status: z.string().optional(),
  page: z.coerce.number().min(1).default(1),
  limit: z.coerce.number().min(1).max(100).default(20),
});

export type CreateBookingInput = z.infer<typeof createBookingSchema>;
export type CancelBookingInput = z.infer<typeof cancelBookingSchema>;
