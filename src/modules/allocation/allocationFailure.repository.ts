import { Types } from 'mongoose';
import { AllocationFailureModel, IAllocationFailure } from './allocationFailure.model';
import { AllocationFailureReason } from '../../common/constants/roles';

export class AllocationFailureRepository {
  async create(data: Partial<IAllocationFailure>): Promise<IAllocationFailure> {
    return AllocationFailureModel.create(data);
  }

  async findByBookingId(bookingId: Types.ObjectId | string): Promise<IAllocationFailure[]> {
    return AllocationFailureModel.find({ bookingId }).sort({ createdAt: 1 }).exec();
  }

  async findAll(filter: Record<string, unknown>, page: number, limit: number) {
    const skip = (page - 1) * limit;
    const [data, total] = await Promise.all([
      AllocationFailureModel.find(filter)
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit)
        .populate('bookingId', 'bookingNumber customerId')
        .exec(),
      AllocationFailureModel.countDocuments(filter).exec(),
    ]);
    return { data, total };
  }
}

export const allocationFailureRepository = new AllocationFailureRepository();
