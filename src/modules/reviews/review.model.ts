import mongoose, { Document, Schema } from 'mongoose';

export interface IReview extends Document {
  _id: mongoose.Types.ObjectId;
  bookingId: mongoose.Types.ObjectId;
  customerId: mongoose.Types.ObjectId;
  barberId: mongoose.Types.ObjectId;
  rating: number;
  comment?: string;
  createdAt: Date;
}

const reviewSchema = new Schema<IReview>(
  {
    bookingId: {
      type: Schema.Types.ObjectId,
      ref: 'Booking',
      required: true,
      unique: true, // One review per booking
    },
    customerId: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    barberId: { type: Schema.Types.ObjectId, ref: 'BarberProfile', required: true },
    rating: { type: Number, required: true, min: 1, max: 5 },
    comment: { type: String, maxlength: 1000 },
  },
  {
    timestamps: { createdAt: true, updatedAt: false },
    toJSON: { transform: (_doc, ret) => { const r = ret as Record<string, unknown>; delete r['__v']; return ret; } },
  },
);

reviewSchema.index({ bookingId: 1 }, { unique: true });
reviewSchema.index({ barberId: 1, createdAt: -1 });
reviewSchema.index({ customerId: 1, createdAt: -1 });

export const ReviewModel = mongoose.model<IReview>('Review', reviewSchema);
