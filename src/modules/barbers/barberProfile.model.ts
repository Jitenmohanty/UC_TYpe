import mongoose, { Document, Schema } from 'mongoose';
import { BarberStatus } from '../../common/constants/roles';
import { WorkingHours } from '../../common/types/global';

export interface IBarberProfile extends Document {
  _id: mongoose.Types.ObjectId;
  userId: mongoose.Types.ObjectId;
  bio?: string;
  experienceYears: number;
  rating: number;
  totalReviews: number;
  totalCompletedJobs: number;
  totalAccepted: number;
  totalOffered: number;
  totalCancellations: number;
  autoAllocationEnabled: boolean;
  serviceRadiusKm: number;
  currentLocation?: {
    type: 'Point';
    coordinates: [number, number];
  };
  locationUpdatedAt?: Date;
  workingHours: WorkingHours;
  status: BarberStatus;
  createdAt: Date;
  updatedAt: Date;
}

const workingDaySchema = new Schema(
  {
    enabled: { type: Boolean, default: false },
    start: { type: String, default: '09:00' },
    end: { type: String, default: '18:00' },
    breaks: [
      {
        start: { type: String },
        end: { type: String },
      },
    ],
  },
  { _id: false },
);

const barberProfileSchema = new Schema<IBarberProfile>(
  {
    userId: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      unique: true,
    },
    bio: { type: String, maxlength: 500 },
    experienceYears: { type: Number, default: 0, min: 0 },
    rating: { type: Number, default: 0, min: 0, max: 5 },
    totalReviews: { type: Number, default: 0 },
    totalCompletedJobs: { type: Number, default: 0 },
    totalAccepted: { type: Number, default: 0 },
    totalOffered: { type: Number, default: 0 },
    totalCancellations: { type: Number, default: 0 },
    autoAllocationEnabled: { type: Boolean, default: false },
    serviceRadiusKm: { type: Number, default: 5, min: 1, max: 50 },
    currentLocation: {
      type: {
        type: String,
        enum: ['Point'],
      },
      coordinates: {
        type: [Number],
        validate: {
          validator: (v: number[]) =>
            v.length === 2 && v[0] >= -180 && v[0] <= 180 && (v[1] ?? 0) >= -90 && (v[1] ?? 0) <= 90,
          message: 'Invalid GeoJSON coordinates',
        },
      },
    },
    locationUpdatedAt: { type: Date },
    workingHours: {
      monday: { type: workingDaySchema, default: () => ({ enabled: false, start: '09:00', end: '18:00' }) },
      tuesday: { type: workingDaySchema, default: () => ({ enabled: false, start: '09:00', end: '18:00' }) },
      wednesday: { type: workingDaySchema, default: () => ({ enabled: false, start: '09:00', end: '18:00' }) },
      thursday: { type: workingDaySchema, default: () => ({ enabled: false, start: '09:00', end: '18:00' }) },
      friday: { type: workingDaySchema, default: () => ({ enabled: false, start: '09:00', end: '18:00' }) },
      saturday: { type: workingDaySchema, default: () => ({ enabled: false, start: '09:00', end: '18:00' }) },
      sunday: { type: workingDaySchema, default: () => ({ enabled: false, start: '09:00', end: '18:00' }) },
    },
    status: {
      type: String,
      enum: Object.values(BarberStatus),
      default: BarberStatus.PENDING_APPROVAL,
    },
  },
  {
    timestamps: true,
    toJSON: { virtuals: true, transform: (_doc, ret) => { const r = ret as Record<string, unknown>; delete r['__v']; return ret; } },
  },
);

// ─── Indexes ──────────────────────────────────────────────────────────────────
barberProfileSchema.index({ currentLocation: '2dsphere' }, { sparse: true });
barberProfileSchema.index({ status: 1, autoAllocationEnabled: 1 });
barberProfileSchema.index({ userId: 1 }, { unique: true });

// ─── Virtual: acceptance rate ─────────────────────────────────────────────────
barberProfileSchema.virtual('acceptanceRate').get(function (this: IBarberProfile) {
  if (!this.totalOffered) return 0;
  return parseFloat(((this.totalAccepted / this.totalOffered) * 100).toFixed(2));
});

barberProfileSchema.virtual('completionRate').get(function (this: IBarberProfile) {
  if (!this.totalAccepted) return 0;
  return parseFloat(((this.totalCompletedJobs / this.totalAccepted) * 100).toFixed(2));
});

export const BarberProfileModel = mongoose.model<IBarberProfile>('BarberProfile', barberProfileSchema);
