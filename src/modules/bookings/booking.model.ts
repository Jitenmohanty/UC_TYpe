import mongoose, { Document, Schema } from 'mongoose';
import { randomBytes } from 'crypto';
import { BookingStatus } from '../../common/constants/bookingStates';
import { BarberPreference } from '../../common/constants/roles';
export { BookingStatus };

export interface IServiceSnapshot {
  name: string;
  price: number;
  durationMinutes: number;
  categoryId?: string;
}

export interface IAddressSnapshot {
  formattedAddress?: string;
  houseNumber?: string;
  landmark?: string;
  postalCode?: string;
  contactPhone?: string;
  city?: string;
  state?: string;
  country?: string;
}

export interface IBooking extends Document {
  _id: mongoose.Types.ObjectId;
  bookingNumber: string;
  customerId: mongoose.Types.ObjectId;
  serviceId: mongoose.Types.ObjectId;
  barberPreference: BarberPreference;
  preferredBarberId?: mongoose.Types.ObjectId;
  serviceSnapshot: IServiceSnapshot;
  customerLocation: {
    type: 'Point';
    coordinates: [number, number];
  };
  addressSnapshot?: IAddressSnapshot;
  scheduledDate: string;     // YYYY-MM-DD
  startTime: string;         // HH:mm
  endTime: string;           // HH:mm
  scheduledStart: Date;      // UTC timestamp
  scheduledEnd: Date;        // UTC timestamp
  timezone: string;
  status: BookingStatus;
  cancellationReason?: string;
  cancelledBy?: mongoose.Types.ObjectId;
  cancelledAt?: Date;
  // OTP verification fields
  serviceOtp?: string;           // SHA-256 hashed OTP (verified against)
  serviceOtpRaw?: string;        // Retrievable copy — the customer's in-app card
                                 // re-reads this on every poll. See README note.
  serviceOtpExpiresAt?: Date;    // OTP expiry (30 min from generation)
  serviceOtpVerifiedAt?: Date;   // When barber verified the OTP
  serviceOtpAttempts: number;    // Wrong-attempt counter (max 5)
  createdAt: Date;
  updatedAt: Date;
}

const bookingSchema = new Schema<IBooking>(
  {
    bookingNumber: {
      type: String,
      required: true,
      unique: true,
    },
    customerId: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
    serviceId: {
      type: Schema.Types.ObjectId,
      ref: 'Service',
      required: true,
    },
    barberPreference: {
      type: String,
      enum: Object.values(BarberPreference),
      default: BarberPreference.ANY,
    },
    preferredBarberId: {
      type: Schema.Types.ObjectId,
      ref: 'BarberProfile',
    },
    serviceSnapshot: {
      name: { type: String, required: true },
      price: { type: Number, required: true },
      durationMinutes: { type: Number, required: true },
      categoryId: { type: String },
    },
    customerLocation: {
      type: {
        type: String,
        enum: ['Point'],
        required: true,
      },
      coordinates: {
        type: [Number],
        required: true,
      },
    },
    addressSnapshot: {
      formattedAddress: String,
      houseNumber: String,
      landmark: String,
      postalCode: String,
      contactPhone: String,
      city: String,
      state: String,
      country: String,
    },
    scheduledDate: { type: String, required: true },
    startTime: { type: String, required: true },
    endTime: { type: String, required: true },
    scheduledStart: { type: Date, required: true },
    scheduledEnd: { type: Date, required: true },
    timezone: { type: String, required: true, default: 'UTC' },
    status: {
      type: String,
      enum: Object.values(BookingStatus),
      default: BookingStatus.PENDING,
    },
    cancellationReason: { type: String },
    cancelledBy: { type: Schema.Types.ObjectId, ref: 'User' },
    cancelledAt: { type: Date },
    // OTP verification fields
    serviceOtp: { type: String },
    serviceOtpRaw: { type: String },
    serviceOtpExpiresAt: { type: Date },
    serviceOtpVerifiedAt: { type: Date },
    serviceOtpAttempts: { type: Number, default: 0 },
  },
  {
    timestamps: true,
    toJSON: { transform: (_doc, ret) => { const r = ret as Record<string, unknown>; delete r['__v']; return ret; } },
  },
);

// ─── Indexes ──────────────────────────────────────────────────────────────────
bookingSchema.index({ customerId: 1, createdAt: -1 });
bookingSchema.index({ status: 1, scheduledStart: 1 });
bookingSchema.index({ customerId: 1, status: 1 });
bookingSchema.index({ customerLocation: '2dsphere' });

// ─── Pre-validate: generate booking number ────────────────────────────────────
// randomBytes rather than Math.random: bookingNumber carries a unique index, so
// a collision surfaces as a raw E11000 on create rather than a friendly error.
bookingSchema.pre('validate', function (this: IBooking, next) {
  if (!this.bookingNumber) {
    const ts = Date.now().toString(36).toUpperCase();
    const rand = randomBytes(4).toString('hex').toUpperCase();
    this.bookingNumber = `BK-${ts}-${rand}`;
  }
  next();
});

export const BookingModel = mongoose.model<IBooking>('Booking', bookingSchema);
