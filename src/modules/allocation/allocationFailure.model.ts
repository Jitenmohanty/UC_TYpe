import mongoose, { Document, Schema } from 'mongoose';
import { AllocationFailureReason } from '../../common/constants/roles';

export interface IAllocationFailure extends Document {
  _id: mongoose.Types.ObjectId;
  bookingId: mongoose.Types.ObjectId;
  reason: AllocationFailureReason;
  requestedService: string;
  requestedLocation: {
    type: 'Point';
    coordinates: [number, number];
  };
  requestedDate: string;
  requestedTime: string;
  radiusKm: number;
  candidateCount: number;
  attemptNumber: number;
  details?: Record<string, unknown>;
  createdAt: Date;
}

const allocationFailureSchema = new Schema<IAllocationFailure>(
  {
    bookingId: { type: Schema.Types.ObjectId, ref: 'Booking', required: true },
    reason: { type: String, enum: Object.values(AllocationFailureReason), required: true },
    requestedService: { type: String, required: true },
    requestedLocation: {
      type: { type: String, enum: ['Point'], required: true },
      coordinates: { type: [Number], required: true },
    },
    requestedDate: { type: String, required: true },
    requestedTime: { type: String, required: true },
    radiusKm: { type: Number, required: true },
    candidateCount: { type: Number, default: 0 },
    attemptNumber: { type: Number, required: true },
    details: { type: Schema.Types.Mixed },
  },
  {
    timestamps: { createdAt: true, updatedAt: false },
    toJSON: { transform: (_doc, ret) => { const r = ret as Record<string, unknown>; delete r['__v']; return ret; } },
  },
);

allocationFailureSchema.index({ bookingId: 1 });
allocationFailureSchema.index({ reason: 1, createdAt: -1 });

export const AllocationFailureModel = mongoose.model<IAllocationFailure>(
  'AllocationFailure',
  allocationFailureSchema,
);
