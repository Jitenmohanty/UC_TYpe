import { Router } from 'express';
import { authenticate } from '../../common/middleware/authenticate';
import { requireRole } from '../../common/middleware/requireRole';
import { asyncHandler } from '../../common/utils/asyncHandler';
import { sendSuccess, sendCreated } from '../../common/utils/response';
import { ReviewModel } from './review.model';
import { BookingModel } from '../bookings/booking.model';
import { BarberProfileModel } from '../barbers/barberProfile.model';
import { AssignmentModel } from '../assignments/assignment.model';
import { NotFoundError, ConflictError, ForbiddenError } from '../../common/errors/AppError';
import { BookingStatus } from '../../common/constants/bookingStates';
import { UserRole } from '../../common/constants/roles';
import { validate } from '../../common/middleware/validate';
import { z } from 'zod';

export const reviewRoutes = Router();

const createReviewSchema = z.object({
  bookingId: z.string().regex(/^[0-9a-fA-F]{24}$/),
  rating: z.number().min(1).max(5).int(),
  comment: z.string().max(1000).optional(),
});

reviewRoutes.post(
  '/',
  authenticate,
  requireRole(UserRole.CUSTOMER),
  validate({ body: createReviewSchema }),
  asyncHandler(async (req, res) => {
    const { bookingId, rating, comment } = req.body as z.infer<typeof createReviewSchema>;
    const customerId = req.user!.userId;

    const booking = await BookingModel.findById(bookingId).exec();
    if (!booking) throw new NotFoundError('Booking');

    if (booking.customerId.toString() !== customerId.toString()) {
      throw new ForbiddenError('This is not your booking');
    }

    if (booking.status !== BookingStatus.COMPLETED) {
      throw new ConflictError('Can only review completed bookings', 'BOOKING_NOT_COMPLETED');
    }

    // Find accepted assignment to get barberId
    const assignment = await AssignmentModel.findOne({
      bookingId,
      status: 'COMPLETED',
    }).exec();
    if (!assignment) throw new NotFoundError('Completed assignment');

    const existing = await ReviewModel.findOne({ bookingId }).exec();
    if (existing) throw new ConflictError('Review already submitted', 'REVIEW_ALREADY_EXISTS');

    const review = await ReviewModel.create({
      bookingId,
      customerId,
      barberId: assignment.barberId,
      rating,
      comment,
    });

    // Update barber average rating
    const reviews = await ReviewModel.find({ barberId: assignment.barberId }).exec();
    const avgRating = reviews.reduce((sum, r) => sum + r.rating, 0) / reviews.length;
    await BarberProfileModel.findOneAndUpdate(
      { $or: [{ _id: assignment.barberId }, { userId: assignment.barberId }] },
      {
        $set: { rating: parseFloat(avgRating.toFixed(2)), totalReviews: reviews.length },
      },
    ).exec();

    sendCreated(res, review, 'Review submitted');
  }),
);

reviewRoutes.get(
  '/barber/:barberId',
  asyncHandler(async (req, res) => {
    const reviews = await ReviewModel.find({ barberId: req.params['barberId'] })
      .sort({ createdAt: -1 })
      .limit(20)
      .populate('customerId', 'name profileImage')
      .exec();
    sendSuccess(res, reviews);
  }),
);
