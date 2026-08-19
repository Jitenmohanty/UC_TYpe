import mongoose, { Document, Schema } from 'mongoose';

export interface IBarberService extends Document {
  _id: mongoose.Types.ObjectId;
  barberId: mongoose.Types.ObjectId;
  serviceId: mongoose.Types.ObjectId;
  price: number;
  durationOverride?: number; // minutes — overrides service default
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
}

const barberServiceSchema = new Schema<IBarberService>(
  {
    barberId: {
      type: Schema.Types.ObjectId,
      ref: 'BarberProfile',
      required: true,
    },
    serviceId: {
      type: Schema.Types.ObjectId,
      ref: 'Service',
      required: true,
    },
    price: { type: Number, required: true, min: 0 },
    durationOverride: { type: Number, min: 5, max: 480 },
    isActive: { type: Boolean, default: true },
  },
  {
    timestamps: true,
    toJSON: { transform: (_doc, ret) => { const r = ret as Record<string, unknown>; delete r['__v']; return ret; } },
  },
);

// Unique compound index — a barber can only have one entry per service
barberServiceSchema.index({ barberId: 1, serviceId: 1 }, { unique: true });
barberServiceSchema.index({ serviceId: 1, isActive: 1 });
barberServiceSchema.index({ barberId: 1, isActive: 1 });

export const BarberServiceModel = mongoose.model<IBarberService>('BarberService', barberServiceSchema);
