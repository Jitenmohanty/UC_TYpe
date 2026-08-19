import { Types } from 'mongoose';
import { ServiceModel, IService } from './service.model';
import { ServiceStatus } from '../../common/constants/roles';
import { buildPaginatedResult, getSkip } from '../../common/utils/pagination';
import { PaginationQuery } from '../../common/types/global';

export class ServiceRepository {
  async findById(id: Types.ObjectId | string): Promise<IService | null> {
    return ServiceModel.findById(id).exec();
  }

  async findActive(pagination?: PaginationQuery) {
    const { page = 1, limit = 50 } = pagination ?? {};
    const skip = getSkip(page, limit);

    const [data, total] = await Promise.all([
      ServiceModel.find({ status: ServiceStatus.ACTIVE }).sort({ name: 1 }).skip(skip).limit(limit).exec(),
      ServiceModel.countDocuments({ status: ServiceStatus.ACTIVE }).exec(),
    ]);

    return buildPaginatedResult(data, total, page, limit);
  }

  async create(data: Partial<IService>): Promise<IService> {
    return ServiceModel.create(data);
  }

  async updateById(id: Types.ObjectId | string, data: Partial<IService>): Promise<IService | null> {
    return ServiceModel.findByIdAndUpdate(id, { $set: data }, { new: true }).exec();
  }
}

export const serviceRepository = new ServiceRepository();
