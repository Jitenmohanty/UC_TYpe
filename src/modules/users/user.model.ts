import mongoose, { Document, Schema, Model } from 'mongoose';
import bcrypt from 'bcrypt';
import { UserRole, UserStatus } from '../../common/constants/roles';

export interface IUser extends Document {
  _id: mongoose.Types.ObjectId;
  name: string;
  email: string;
  phone: string;
  passwordHash: string;
  role: UserRole;
  status: UserStatus;
  profileImage?: string;
  location?: {
    type: 'Point';
    coordinates: [number, number];
  };
  locationUpdatedAt?: Date;
  refreshTokenHash?: string;
  passwordResetOtp?: string;
  passwordResetOtpRaw?: string;
  passwordResetOtpExpiresAt?: Date;
  passwordResetOtpAttempts?: number;
  passwordResetToken?: string;
  createdAt: Date;
  updatedAt: Date;
  comparePassword(candidatePassword: string): Promise<boolean>;
}

interface IUserModel extends Model<IUser> {
  findByEmail(email: string): Promise<IUser | null>;
  findByIdentifier(identifier: string): Promise<IUser | null>;
}

const userSchema = new Schema<IUser>(
  {
    name: { type: String, required: true, trim: true, maxlength: 100 },
    email: {
      type: String,
      required: true,
      unique: true,
      lowercase: true,
      trim: true,
      match: [/^\S+@\S+\.\S+$/, 'Invalid email format'],
    },
    phone: {
      type: String,
      required: true,
      unique: true,
      trim: true,
      match: [/^\+?[1-9]\d{7,14}$/, 'Invalid phone number'],
    },
    passwordHash: { type: String, required: true, select: false },
    role: { type: String, enum: Object.values(UserRole), required: true },
    status: {
      type: String,
      enum: Object.values(UserStatus),
      default: UserStatus.ACTIVE,
    },
    profileImage: { type: String },
    location: {
      type: {
        type: String,
        enum: ['Point'],
      },
      coordinates: {
        type: [Number],
        validate: {
          validator: (v: number[]) =>
            v.length === 2 && v[0] >= -180 && v[0] <= 180 && (v[1] ?? 0) >= -90 && (v[1] ?? 0) <= 90,
          message: 'Invalid GeoJSON coordinates [longitude, latitude]',
        },
      },
    },
    locationUpdatedAt: { type: Date },
    refreshTokenHash: { type: String, select: false },
    passwordResetOtp: { type: String, select: false },
    passwordResetOtpRaw: { type: String, select: false },
    passwordResetOtpExpiresAt: { type: Date },
    passwordResetOtpAttempts: { type: Number, default: 0 },
    passwordResetToken: { type: String, select: false },
  },
  {
    timestamps: true,
    toJSON: {
      transform(_doc, ret) {
        const r = ret as Record<string, unknown>;
        delete r['passwordHash'];
        delete r['refreshTokenHash'];
        delete r['passwordResetOtp'];
        delete r['passwordResetOtpRaw'];
        delete r['passwordResetToken'];
        delete r['__v'];
        return ret;
      },
    },
  },
);

// ─── Indexes ─────────────────────────────────────────────────────────────────
userSchema.index({ role: 1, status: 1 });
userSchema.index({ location: '2dsphere' }, { sparse: true });

// ─── Static methods ───────────────────────────────────────────────────────────
userSchema.statics.findByEmail = function (email: string) {
  return this.findOne({ email: email.toLowerCase() }).select('+passwordHash');
};

userSchema.statics.findByIdentifier = function (identifier: string) {
  const cleanId = identifier.trim();
  return this.findOne({
    $or: [
      { email: cleanId.toLowerCase() },
      { phone: cleanId },
      { phone: cleanId.replace(/\s+/g, '') },
    ],
  }).select('+passwordHash +passwordResetOtp +passwordResetToken');
};

// ─── Instance methods ─────────────────────────────────────────────────────────
userSchema.methods.comparePassword = async function (
  candidatePassword: string,
): Promise<boolean> {
  return bcrypt.compare(candidatePassword, this.passwordHash as string);
};

export const UserModel = mongoose.model<IUser, IUserModel>('User', userSchema);
