import mongoose, { Document, Schema } from 'mongoose';

export interface IBarberLeave extends Document {
  _id: mongoose.Types.ObjectId;
  barberId: mongoose.Types.ObjectId;
  startDate: string;  // YYYY-MM-DD
  endDate: string;    // YYYY-MM-DD
  reason?: string;
  createdAt: Date;
}

const barberLeaveSchema = new Schema<IBarberLeave>(
  {
    barberId: { type: Schema.Types.ObjectId, ref: 'BarberProfile', required: true },
    startDate: { type: String, required: true },
    endDate: { type: String, required: true },
    reason: { type: String, maxlength: 200 },
  },
  {
    timestamps: { createdAt: true, updatedAt: false },
    toJSON: { transform: (_doc, ret) => { const r = ret as Record<string, unknown>; delete r['__v']; return ret; } },
  },
);

barberLeaveSchema.index({ barberId: 1, startDate: 1, endDate: 1 });

export const BarberLeaveModel = mongoose.model<IBarberLeave>('BarberLeave', barberLeaveSchema);
