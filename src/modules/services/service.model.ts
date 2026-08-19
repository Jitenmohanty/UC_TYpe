import mongoose, { Document, Schema } from 'mongoose';
import { ServiceStatus } from '../../common/constants/roles';

export interface IService extends Document {
  _id: mongoose.Types.ObjectId;
  name: string;
  description: string;
  categoryId?: string;
  price: number;
  durationMinutes: number;
  status: ServiceStatus;
  createdAt: Date;
  updatedAt: Date;
}

const serviceSchema = new Schema<IService>(
  {
    name: { type: String, required: true, trim: true, maxlength: 100 },
    description: { type: String, required: true, maxlength: 500 },
    categoryId: { type: String, trim: true },
    price: { type: Number, required: true, min: 0 },
    durationMinutes: { type: Number, required: true, min: 5, max: 480 },
    status: {
      type: String,
      enum: Object.values(ServiceStatus),
      default: ServiceStatus.ACTIVE,
    },
  },
  {
    timestamps: true,
    toJSON: { transform: (_doc, ret) => { const r = ret as Record<string, unknown>; delete r['__v']; return ret; } },
  },
);

serviceSchema.index({ status: 1 });
serviceSchema.index({ categoryId: 1, status: 1 });
serviceSchema.index({ name: 'text', description: 'text' });

export const ServiceModel = mongoose.model<IService>('Service', serviceSchema);
