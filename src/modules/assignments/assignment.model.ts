import mongoose, { Document, Schema } from 'mongoose';
import { AssignmentStatus } from '../../common/constants/assignmentStates';
export { AssignmentStatus };

/** How this barber ended up on the booking. */
export enum AssignmentSource {
  BARBER_CLAIM = 'BARBER_CLAIM',       // barber took it from the open pool
  ADMIN_ASSIGN = 'ADMIN_ASSIGN',       // admin hand-assigned from the console
  CUSTOMER_CHOICE = 'CUSTOMER_CHOICE', // customer picked this barber at booking
}

export interface IAssignment extends Document {
  _id: mongoose.Types.ObjectId;
  bookingId: mongoose.Types.ObjectId;
  /** BarberProfile._id — never the barber's User._id. */
  barberId: mongoose.Types.ObjectId;
  status: AssignmentStatus;
  source: AssignmentSource;
  /** User._id of the admin who assigned, when source is ADMIN_ASSIGN. */
  assignedBy?: mongoose.Types.ObjectId;
  offeredAt?: Date;
  acceptedAt?: Date;
  enRouteAt?: Date;
  arrivedAt?: Date;
  startedAt?: Date;
  completedAt?: Date;
  rejectedAt?: Date;
  expiredAt?: Date;
  cancelledAt?: Date;
  cancellationReason?: string;
  cancelledBy?: mongoose.Types.ObjectId;
  /** Barber→customer distance in km at the moment of assignment, if known. */
  distanceAtAssignment?: number;
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
    source: {
      type: String,
      enum: Object.values(AssignmentSource),
      required: true,
    },
    assignedBy: { type: Schema.Types.ObjectId, ref: 'User' },
    offeredAt: { type: Date },
    acceptedAt: { type: Date },
    enRouteAt: { type: Date },
    arrivedAt: { type: Date },
    startedAt: { type: Date },
    completedAt: { type: Date },
    rejectedAt: { type: Date },
    expiredAt: { type: Date },
    cancelledAt: { type: Date },
    cancellationReason: { type: String },
    cancelledBy: { type: Schema.Types.ObjectId, ref: 'User' },
    distanceAtAssignment: { type: Number },
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
