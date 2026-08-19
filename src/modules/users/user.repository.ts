import { Types } from 'mongoose';
import { UserModel, IUser } from './user.model';
import { UserRole, UserStatus } from '../../common/constants/roles';
import { PaginationQuery } from '../../common/types/global';
import { buildPaginatedResult, getSkip } from '../../common/utils/pagination';

export class UserRepository {
  async create(data: {
    name: string;
    email: string;
    phone: string;
    passwordHash: string;
    role: UserRole;
    location?: {
      type: 'Point';
      coordinates: [number, number];
    };
    locationUpdatedAt?: Date;
  }): Promise<IUser> {
    return UserModel.create(data);
  }

  async findById(id: Types.ObjectId | string): Promise<IUser | null> {
    return UserModel.findById(id).exec();
  }

  async findByEmail(email: string): Promise<IUser | null> {
    return UserModel.findByEmail(email);
  }

  async findByEmailWithPassword(email: string): Promise<IUser | null> {
    return UserModel.findOne({ email: email.toLowerCase() })
      .select('+passwordHash +refreshTokenHash')
      .exec();
  }

  async findByPhone(phone: string): Promise<IUser | null> {
    return UserModel.findOne({ phone }).exec();
  }

  async findByIdentifier(identifier: string): Promise<IUser | null> {
    return UserModel.findByIdentifier(identifier);
  }

  async setPasswordResetOtp(
    userId: Types.ObjectId | string,
    otpHash: string,
    otpRaw: string,
    expiresAt: Date,
  ): Promise<void> {
    await UserModel.findByIdAndUpdate(userId, {
      $set: {
        passwordResetOtp: otpHash,
        passwordResetOtpRaw: otpRaw,
        passwordResetOtpExpiresAt: expiresAt,
        passwordResetOtpAttempts: 0,
      },
    }).exec();
  }

  async incrementResetOtpAttempts(userId: Types.ObjectId | string): Promise<void> {
    await UserModel.findByIdAndUpdate(userId, {
      $inc: { passwordResetOtpAttempts: 1 },
    }).exec();
  }

  async setPasswordResetToken(
    userId: Types.ObjectId | string,
    resetToken: string,
  ): Promise<void> {
    await UserModel.findByIdAndUpdate(userId, {
      $set: {
        passwordResetToken: resetToken,
        passwordResetOtp: undefined,
        passwordResetOtpRaw: undefined,
      },
    }).exec();
  }

  async resetPassword(
    userId: Types.ObjectId | string,
    passwordHash: string,
  ): Promise<void> {
    await UserModel.findByIdAndUpdate(userId, {
      $set: {
        passwordHash,
        passwordResetOtp: undefined,
        passwordResetOtpRaw: undefined,
        passwordResetOtpExpiresAt: undefined,
        passwordResetOtpAttempts: 0,
        passwordResetToken: undefined,
        refreshTokenHash: null,
      },
    }).exec();
  }

  async updateById(
    id: Types.ObjectId | string,
    data: Partial<IUser>,
  ): Promise<IUser | null> {
    return UserModel.findByIdAndUpdate(id, { $set: data }, { new: true }).exec();
  }

  async setRefreshToken(
    userId: Types.ObjectId | string,
    refreshTokenHash: string | null,
  ): Promise<void> {
    await UserModel.findByIdAndUpdate(userId, {
      $set: { refreshTokenHash },
    }).exec();
  }

  async updateStatus(
    userId: Types.ObjectId | string,
    status: UserStatus,
  ): Promise<IUser | null> {
    return UserModel.findByIdAndUpdate(
      userId,
      { $set: { status } },
      { new: true },
    ).exec();
  }

  async findAll(
    filter: Record<string, unknown>,
    pagination: PaginationQuery,
  ) {
    const { page = 1, limit = 20, sortBy = 'createdAt', sortOrder = 'desc' } = pagination;
    const skip = getSkip(page, limit);
    const sort = { [sortBy]: sortOrder === 'asc' ? 1 : -1 } as Record<string, 1 | -1>;

    const [data, total] = await Promise.all([
      UserModel.find(filter).sort(sort).skip(skip).limit(limit).exec(),
      UserModel.countDocuments(filter).exec(),
    ]);

    return buildPaginatedResult(data, total, page, limit);
  }
}

export const userRepository = new UserRepository();
