import { Types } from 'mongoose';
import { ReviewModel, IReview } from './review.model';

export class ReviewRepository {
  async create(data: Partial<IReview>): Promise<IReview> {
    return ReviewModel.create(data);
  }

  async findByBooking(bookingId: Types.ObjectId | string): Promise<IReview | null> {
    return ReviewModel.findOne({ bookingId }).exec();
  }

  async findByBarber(barberId: Types.ObjectId | string, limit = 20): Promise<IReview[]> {
    return ReviewModel.find({ barberId })
      .sort({ createdAt: -1 })
      .limit(limit)
      .populate('customerId', 'name profileImage')
      .exec();
  }

  async getBarberAverageRating(
    barberId: Types.ObjectId | string,
  ): Promise<{ avg: number; count: number }> {
    const result = await ReviewModel.aggregate([
      { $match: { barberId: new Types.ObjectId(barberId.toString()) } },
      {
        $group: {
          _id: null,
          avg: { $avg: '$rating' },
          count: { $sum: 1 },
        },
      },
    ]).exec();

    return result[0] ?? { avg: 0, count: 0 };
  }
}

export const reviewRepository = new ReviewRepository();
