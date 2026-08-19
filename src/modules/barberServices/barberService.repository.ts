import { Types } from 'mongoose';
import { BarberServiceModel, IBarberService } from './barberService.model';

export class BarberServiceRepository {
  async findByBarber(barberId: Types.ObjectId | string): Promise<IBarberService[]> {
    return BarberServiceModel.find({ barberId, isActive: true })
      .populate('serviceId', 'name description price durationMinutes')
      .exec();
  }

  async findByBarberAndService(
    barberId: Types.ObjectId | string,
    serviceId: Types.ObjectId | string,
  ): Promise<IBarberService | null> {
    return BarberServiceModel.findOne({ barberId, serviceId }).exec();
  }

  async barberOffersService(
    barberId: Types.ObjectId | string,
    serviceId: Types.ObjectId | string,
  ): Promise<boolean> {
    const exists = await BarberServiceModel.exists({ barberId, serviceId, isActive: true });
    return exists !== null;
  }
}

export const barberServiceRepository = new BarberServiceRepository();
