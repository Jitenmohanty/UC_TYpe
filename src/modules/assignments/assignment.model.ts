import mongoose, { Document, Schema } from 'mongoose';
import { AssignmentStatus } from '../../common/constants/assignmentStates';
export { AssignmentStatus };

export interface IAssignment extends Document {
  _id: mongoose.Types.ObjectId;
  bookingId: mongoose.Types.ObjectId;
  barberId: mongoose.Types.ObjectId;
  status: AssignmentStatus;
  allocationAttempt: number;
  offeredAt?: Date;
  acceptedAt?: Date;
  rejectedAt?: Date;
  expiredAt?: Date;
  cancelledAt?: Date;
  cancellationReason?: string;
  cancelledBy?: mongoose.Types.ObjectId;
  distanceAtAllocation?: number; // km
  allocationScore?: number;
  expirationJobId?: string; // BullMQ job ID for cancellation
  createdAt: Date;
  updatedAt: Date;
}

const assignmentSchema = new Schema<IAssignment>(
  {
    bookingId: {
      type: Schema.Types.ObjectId,
      ref: 'Booking',
      required: true,
    },
    barberId: {
      type: Schema.Types.ObjectId,
      ref: 'BarberProfile',
      required: true,
    },
    status: {
      type: String,
      enum: Object.values(AssignmentStatus),
      default: AssignmentStatus.OFFERED,
    },
    allocationAttempt: { type: Number, required: true, default: 1 },
    offeredAt: { type: Date },
    acceptedAt: { type: Date },
    rejectedAt: { type: Date },
    expiredAt: { type: Date },
    cancelledAt: { type: Date },
    cancellationReason: { type: String },
    cancelledBy: { type: Schema.Types.ObjectId, ref: 'User' },
    distanceAtAllocation: { type: Number },
    allocationScore: { type: Number },
    expirationJobId: { type: String },
  },
  {
    timestamps: true,
    toJSON: { transform: (_doc, ret) => { const r = ret as Record<string, unknown>; delete r['__v']; return ret; } },
  },
);

// ─── Indexes ──────────────────────────────────────────────────────────────────
assignmentSchema.index({ bookingId: 1, status: 1 });
assignmentSchema.index({ barberId: 1, status: 1 });
assignmentSchema.index({ barberId: 1, createdAt: -1 });

export const AssignmentModel = mongoose.model<IAssignment>('Assignment', assignmentSchema);
